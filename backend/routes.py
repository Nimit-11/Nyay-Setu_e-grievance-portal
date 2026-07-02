import random
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends, Response
from sqlalchemy.orm import Session

from ai_pipelines import gemini_structurer, gemini_vision_ocr, gemini_transcribe
from schemas import AdminUpdateRequest, SubmitResponse, TrackingResponse, CitizenResponse
from database import get_db
from models import DBComplaint, DBCitizen

router = APIRouter(prefix="/api/v1/complaints", tags=["Complaints"])

def generate_id() -> str:
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=6))
    return f"NCSC-{suffix}"

@router.post("/submit", response_model=SubmitResponse, status_code=201)
async def submit_complaint(
    input_mode: str = Form(...),
    aadhaar_no: str = Form(...),
    text: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    document_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    citizen = db.query(DBCitizen).filter(DBCitizen.aadhaar_no == aadhaar_no).first()
    if not citizen:
        raise HTTPException(status_code=404, detail=f"Citizen with Aadhaar {aadhaar_no} not found.")

    complaint_id = generate_id()
    file_url = None

    if input_mode == "text":
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text is required for text mode.")
        raw_text = text.strip()
    elif input_mode == "voice":
        if not audio_file:
            raise HTTPException(status_code=400, detail="Audio file is required for voice mode.")
        file_bytes_data = await audio_file.read()
        if len(file_bytes_data) == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty.")
        
        ext = "webm"
        if audio_file.filename and "." in audio_file.filename:
            ext = audio_file.filename.split(".")[-1]
        
        file_path = f"stored_media/{complaint_id}.{ext}"
        with open(file_path, "wb") as f:
            f.write(file_bytes_data)
            
        file_url = f"http://localhost:8000/static/{complaint_id}.{ext}"
        raw_text = await gemini_transcribe(file_bytes_data, audio_file.filename or "audio.webm")
    elif input_mode == "document":
        if not document_file:
            raise HTTPException(status_code=400, detail="Document file is required for document mode.")
        file_bytes_data = await document_file.read()
        if len(file_bytes_data) == 0:
            raise HTTPException(status_code=400, detail="Document file is empty.")
        
        ext = "jpg"
        if document_file.filename and "." in document_file.filename:
            ext = document_file.filename.split(".")[-1]
            
        file_path = f"stored_media/{complaint_id}.{ext}"
        with open(file_path, "wb") as f:
            f.write(file_bytes_data)
            
        file_url = f"http://localhost:8000/static/{complaint_id}.{ext}"
        mime_type = document_file.content_type or "image/jpeg"
        raw_text = await gemini_vision_ocr(file_bytes_data, mime_type)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported input_mode: {input_mode}")

    structured = await gemini_structurer(raw_text)

    new_complaint = DBComplaint(
        id=complaint_id,
        aadhaar_no=aadhaar_no,
        raw_input=raw_text,
        input_mode=input_mode,
        file_url=file_url,
        created_at=datetime.now().isoformat(),
        status="Submitted",
        internal_status="Submitted",
        victim_name=structured.get("victim_name"),
        home_address=structured.get("home_address"),
        summary=structured.get("summary"),
        category=structured.get("category"),
        severity=structured.get("severity"),
        status_timestamps={"Submitted": datetime.now().isoformat()},
        nudge_timestamps=[]
    )
    
    db.add(new_complaint)
    db.commit()

    return SubmitResponse(
        id=complaint_id,
        message=f"Complaint {complaint_id} submitted successfully.",
    )

@router.get("/grouped", response_model=list[CitizenResponse])
async def list_complaints_grouped(db: Session = Depends(get_db)):
    citizens = db.query(DBCitizen).all()
    result = []
    for cit in citizens:
        complaints = []
        for c in cit.complaints:
            complaints.append({
                "id": c.id,
                "aadhaar_no": c.aadhaar_no,
                "raw_input": c.raw_input,
                "file_url": c.file_url,
                "input_mode": c.input_mode,
                "created_at": c.created_at,
                "status": c.status,
                "internal_status": c.internal_status,
                "victim_name": c.victim_name,
                "home_address": c.home_address,
                "summary": c.summary,
                "category": c.category,
                "severity": c.severity,
                "status_timestamps": c.status_timestamps or {},
                "nudge_timestamps": c.nudge_timestamps or [],
            })
        result.append(CitizenResponse(
            aadhaar_no=cit.aadhaar_no,
            name=cit.name,
            mobile_number=cit.mobile_number,
            home_address=cit.home_address,
            complaints=complaints
        ))
    return result

@router.post("/{complaint_id}/nudge", response_model=dict)
async def nudge_complaint(complaint_id: str, db: Session = Depends(get_db)):
    record = db.query(DBComplaint).filter(DBComplaint.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found.")
    
    current_date = datetime.now().strftime("%d/%m/%Y")
    nudge_entry = f"{current_date}|{record.status}"
    
    # Need to create a new list to trigger SQLAlchemy's mutable json update correctly
    nudges = list(record.nudge_timestamps) if record.nudge_timestamps else []
    nudges.append(nudge_entry)
    record.nudge_timestamps = nudges
    
    db.commit()
    return {"message": "Nudge logged successfully.", "nudge_timestamps": record.nudge_timestamps}


@router.get("/{complaint_id}/status", response_model=TrackingResponse)
async def track_complaint(complaint_id: str, db: Session = Depends(get_db)):
    record = db.query(DBComplaint).filter(DBComplaint.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found.")

    return TrackingResponse(
        id=record.id,
        status=record.status,
        internal_status=record.internal_status,
        summary=record.summary,
        created_at=record.created_at,
        status_timestamps=record.status_timestamps or {},
        nudge_timestamps=record.nudge_timestamps or [],
    )

@router.put("/{complaint_id}", response_model=dict)
async def update_complaint(complaint_id: str, update: AdminUpdateRequest, db: Session = Depends(get_db)):
    record = db.query(DBComplaint).filter(DBComplaint.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found.")

    update_data = update.model_dump(exclude_none=True)
    
    # Handle phone number which belongs to citizen
    if "phone_number" in update_data:
        record.citizen.mobile_number = update_data.pop("phone_number")

    for field, value in update_data.items():
        if field == "internal_status":
            if record.internal_status != value:
                ts = dict(record.status_timestamps or {})
                ts[value] = datetime.now().isoformat()
                
                # public map
                public_map = {
                    "Submitted": "Submitted",
                    "Desk_Reviewed": "Reviewed",
                    "Jurisdiction_Routed": "Assigned",
                    "Police_Dispatched": "Assigned",
                    "Field_Investigating": "Assigned",
                    "Resolved": "Resolved"
                }
                new_public = public_map.get(value, "Submitted")
                if new_public != record.status:
                    record.status = new_public
                    ts[new_public] = datetime.now().isoformat()
                
                record.status_timestamps = ts
        
        setattr(record, field, value)
    
    db.commit()
    db.refresh(record)
    
    return {"id": record.id}

@router.get("/citizen/{aadhaar_no}", response_model=CitizenResponse)
async def get_citizen(aadhaar_no: str, db: Session = Depends(get_db)):
    cit = db.query(DBCitizen).filter(DBCitizen.aadhaar_no == aadhaar_no).first()
    if not cit:
        raise HTTPException(status_code=404, detail="Citizen not found.")
    
    complaints = []
    for c in cit.complaints:
        complaints.append({
            "id": c.id,
            "aadhaar_no": c.aadhaar_no,
            "raw_input": c.raw_input,
            "file_url": c.file_url,
            "input_mode": c.input_mode,
            "created_at": c.created_at,
            "status": c.status,
            "internal_status": c.internal_status,
            "victim_name": c.victim_name,
            "home_address": c.home_address,
            "summary": c.summary,
            "category": c.category,
            "severity": c.severity,
            "status_timestamps": c.status_timestamps or {},
            "nudge_timestamps": c.nudge_timestamps or [],
        })
    
    return CitizenResponse(
        aadhaar_no=cit.aadhaar_no,
        name=cit.name,
        mobile_number=cit.mobile_number,
        home_address=cit.home_address,
        complaints=complaints
    )
