import random
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ai_pipelines import gemini_structurer, gemini_vision_ocr, gemini_transcribe
from models import AdminUpdateRequest, SubmitResponse, TrackingResponse

router = APIRouter(prefix="/api/v1/complaints", tags=["Complaints"])

complaints_db: list[dict] = []


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
):
    complaint_id = generate_id()
    file_url = None

    if input_mode == "text":
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text is required for text mode.")
        raw_text = text.strip()
    elif input_mode == "voice":
        if not audio_file:
            raise HTTPException(status_code=400, detail="Audio file is required for voice mode.")
        audio_bytes = await audio_file.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty.")
        
        # Save file persistently
        ext = audio_file.filename.split('.')[-1] if audio_file.filename and '.' in audio_file.filename else 'webm'
        filename = f"{complaint_id}.{ext}"
        filepath = f"uploads/{filename}"
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        file_url = f"http://localhost:8000/uploads/{filename}"

        raw_text = await gemini_transcribe(audio_bytes, audio_file.filename or "audio.webm")
    elif input_mode == "document":
        if not document_file:
            raise HTTPException(status_code=400, detail="Document file is required for document mode.")
        doc_bytes = await document_file.read()
        if len(doc_bytes) == 0:
            raise HTTPException(status_code=400, detail="Document file is empty.")
        
        # Save file persistently
        ext = document_file.filename.split('.')[-1] if document_file.filename and '.' in document_file.filename else 'jpg'
        filename = f"{complaint_id}.{ext}"
        filepath = f"uploads/{filename}"
        with open(filepath, "wb") as f:
            f.write(doc_bytes)
        file_url = f"http://localhost:8000/uploads/{filename}"

        content_type = document_file.content_type or "image/jpeg"
        raw_text = await gemini_vision_ocr(doc_bytes, content_type)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported input_mode: {input_mode}")

    structured = await gemini_structurer(raw_text)

    record = {
        "id": complaint_id,
        "raw_input": raw_text,
        "input_mode": input_mode,
        "file_url": file_url,
        "created_at": datetime.now().isoformat(),
        "status": "Submitted",
        "victim_name": structured["victim_name"],
        "home_address": structured["home_address"],
        "summary": structured["summary"],
        "category": structured["category"],
        "severity": structured["severity"],
        "status_timestamps": {"Submitted": datetime.now().isoformat()},
    }
    complaints_db.append(record)

    return SubmitResponse(
        id=complaint_id,
        message=f"Complaint {complaint_id} submitted successfully via {input_mode} input.",
    )


@router.get("", response_model=list[dict])
@router.get("/", response_model=list[dict], include_in_schema=False)
async def list_complaints():
    return complaints_db


@router.put("/{complaint_id}", response_model=dict)
async def update_complaint(complaint_id: str, update: AdminUpdateRequest):
    for record in complaints_db:
        if record["id"] == complaint_id:
            update_data = update.model_dump(exclude_none=True)
            for field, value in update_data.items():
                if field == "status" and record.get("status") != value:
                    record.setdefault("status_timestamps", {})[value] = datetime.now().isoformat()
                record[field] = value
            return record

    raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found.")


@router.get("/{complaint_id}/status", response_model=TrackingResponse)
async def track_complaint(complaint_id: str):
    for record in complaints_db:
        if record["id"] == complaint_id:
            return TrackingResponse(
                id=record["id"],
                status=record["status"],
                summary=record["summary"],
                status_timestamps=record.get("status_timestamps", {}),
            )

    raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found.")
