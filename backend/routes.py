import random
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends, Response
from sqlalchemy.orm import Session

from ai_pipelines import gemini_structurer, gemini_vision_ocr, gemini_transcribe
from schemas import AdminUpdateRequest, SubmitResponse, TrackingResponse
from database import get_db
from models import DBComplaint

router = APIRouter(prefix="/api/v1/complaints", tags=["Complaints"])

def generate_id() -> str:
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=6))
    return f"NCSC-{suffix}"

@router.post("/submit", response_model=SubmitResponse, status_code=201)
async def submit_complaint(
    input_mode: str = Form(...),
    text: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    document_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    complaint_id = generate_id()
    
    file_bytes_data = None
    file_mime_type_data = None
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
        
        file_mime_type_data = audio_file.content_type or "audio/webm"
        file_url = f"http://localhost:8000/api/v1/complaints/{complaint_id}/file"

        raw_text = await gemini_transcribe(file_bytes_data, audio_file.filename or "audio.webm")
    elif input_mode == "document":
        if not document_file:
            raise HTTPException(status_code=400, detail="Document file is required for document mode.")
        file_bytes_data = await document_file.read()
        if len(file_bytes_data) == 0:
            raise HTTPException(status_code=400, detail="Document file is empty.")
        
        file_mime_type_data = document_file.content_type or "image/jpeg"
        file_url = f"http://localhost:8000/api/v1/complaints/{complaint_id}/file"

        raw_text = await gemini_vision_ocr(file_bytes_data, file_mime_type_data)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported input_mode: {input_mode}")

    structured = await gemini_structurer(raw_text)

    new_complaint = DBComplaint(
        id=complaint_id,
        raw_input=raw_text,
        input_mode=input_mode,
        file_url=file_url,
        file_bytes=file_bytes_data,
        file_mime_type=file_mime_type_data,
        created_at=datetime.now().isoformat(),
        status="Submitted",
        victim_name=structured.get("victim_name"),
        home_address=structured.get("home_address"),
        summary=structured.get("summary"),
        category=structured.get("category"),
        severity=structured.get("severity"),
        status_timestamps={"Submitted": datetime.now().isoformat()}
    )
    
    db.add(new_complaint)
    db.commit()

    return SubmitResponse(
        id=complaint_id,
        message=f"Complaint {complaint_id} submitted successfully via {input_mode} input.",
    )

@router.get("", response_model=list[dict])
@router.get("/", response_model=list[dict], include_in_schema=False)
async def list_complaints(db: Session = Depends(get_db)):
    complaints = db.query(DBComplaint).all()
    result = []
    for c in complaints:
        c_dict = {
            "id": c.id,
            "raw_input": c.raw_input,
            "input_mode": c.input_mode,
            "file_url": c.file_url,
            "created_at": c.created_at,
            "status": c.status,
            "victim_name": c.victim_name,
            "home_address": c.home_address,
            "summary": c.summary,
            "category": c.category,
            "severity": c.severity,
            "status_timestamps": c.status_timestamps,
        }
        result.append(c_dict)
    return result

@router.put("/{complaint_id}", response_model=dict)
async def update_complaint(complaint_id: str, update: AdminUpdateRequest, db: Session = Depends(get_db)):
    record = db.query(DBComplaint).filter(DBComplaint.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found.")

    update_data = update.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if field == "status" and record.status != value:
            if record.status_timestamps is None:
                record.status_timestamps = {}
            record.status_timestamps[value] = datetime.now().isoformat()
        setattr(record, field, value)
    
    db.commit()
    db.refresh(record)
    
    return {
        "id": record.id,
        "raw_input": record.raw_input,
        "input_mode": record.input_mode,
        "file_url": record.file_url,
        "created_at": record.created_at,
        "status": record.status,
        "victim_name": record.victim_name,
        "home_address": record.home_address,
        "summary": record.summary,
        "category": record.category,
        "severity": record.severity,
        "status_timestamps": record.status_timestamps,
    }

@router.get("/{complaint_id}/status", response_model=TrackingResponse)
async def track_complaint(complaint_id: str, db: Session = Depends(get_db)):
    record = db.query(DBComplaint).filter(DBComplaint.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found.")

    return TrackingResponse(
        id=record.id,
        status=record.status,
        summary=record.summary,
        status_timestamps=record.status_timestamps or {},
    )

@router.get("/{complaint_id}/file")
async def get_complaint_file(complaint_id: str, db: Session = Depends(get_db)):
    record = db.query(DBComplaint).filter(DBComplaint.id == complaint_id).first()
    if not record or not record.file_bytes:
        raise HTTPException(status_code=404, detail=f"File not found for complaint {complaint_id}.")
    
    return Response(content=record.file_bytes, media_type=record.file_mime_type)
