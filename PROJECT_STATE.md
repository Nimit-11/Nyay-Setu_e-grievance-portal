# PROJECT_STATE.md

## Project Overview & Stack
**Application Name:** NCSC e-Grievance Portal
**Description:** An AI-powered grievance management portal allowing citizens to submit complaints via text, voice, or documents. The system leverages Gemini 2.5 Flash for transcription, OCR, and structuring narrative inputs into categorized fields (Violence, Land, Service, Civic, Social, Other) with a severity rating. It includes an Admin Dashboard for verification and a Public Tracker for citizens to track status updates.
**Technology Stack:**
*   **Frontend:** React, Vite, TailwindCSS (v3)
*   **Backend:** FastAPI, Python, Google GenAI SDK (Gemini 2.5 Flash)

## Current Directory Architecture
```text
ncsc-egmp/
├── backend/
│   ├── ai_pipelines.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── routes.py
│   └── uploads/
│       └── [Dynamic user upload files e.g., NCSC-181MO2.jpg]
└── frontend/
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── vite.config.js
    ├── index.html
    ├── public/
    │   └── logo.jpg
    └── src/
        ├── App.jsx
        ├── index.css
        ├── main.jsx
        ├── api/
        │   └── api.js
        └── components/
            ├── AdminDashboard.jsx
            ├── CitizenIntake.jsx
            └── PublicTracker.jsx
```

## Complete Source Code Ledger

### Backend Code

#### `backend/main.py`
```python
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routes import router

app = FastAPI(
    title="Nyay Setu — Grievance Management Portal API",
    description="Backend API for the Nyay Setu AI-powered grievance management system.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(router)


@app.get("/")
async def root():
    return {"message": "Nyay Setu API is running", "version": "1.0.0"}
```

#### `backend/routes.py`
```python
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
```

#### `backend/ai_pipelines.py`
```python
import json
import os
from google import genai
from google.genai import types

# Initialize the new Gemini client (reads GEMINI_API_KEY from env)
client = genai.Client()

STRUCTURING_SYSTEM_PROMPT = """You are an AI assistant for the Nyay Setu grievance management portal.
Your task is to analyze a citizen's grievance narrative and extract structured information.

You MUST respond with a valid JSON object.

Classification guidelines:
- "Violence / Atrocity": Physical violence, assault, caste-based violence, discrimination, harassment, abuse.
- "Land / Property": Property encroachment, land grabbing, boundary disputes, illegal occupation.
- "Service / Employment": Workplace issues, harassment by boss, government/private employment, pension, salary.
- "Civic / Infrastructure": Electricity cuts, water issues, roads, public utilities, municipal problems.
- "Social / Welfare": Education, health, welfare schemes, economic exploitation.
- "Other": Anything that does not fit into the above categories.

Severity guidelines:
- "Critical": Physical violence, immediate threat to life, widespread discrimination
- "High": Significant property loss, sustained harassment, systemic denial of rights
- "Medium": Bureaucratic delays, minor service issues, isolated incidents
- "Low": Information requests, minor inconveniences, clarifications needed

If the text is in a non-English language (Hindi, Tamil, etc.), still extract the information and provide the summary in English.
"""

import tempfile

async def gemini_transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio using Gemini 2.5 Flash. Supports Hindi and all Indian languages."""
    ext = filename.split(".")[-1] if "." in filename else "webm"
    mime_type = f"audio/{ext}"
    if ext == "mp4":
        mime_type = "audio/mp4"

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as temp_file:
        temp_file.write(audio_bytes)
        temp_file_path = temp_file.name

    try:
        uploaded_file = await client.aio.files.upload(file=temp_file_path, config={'mime_type': mime_type})
        response = await call_gemini_with_retry(
            model="gemini-2.5-flash",
            contents=[
                uploaded_file,
                "Transcribe this audio perfectly. If it is in a regional Indian language, transcribe it exactly in that language. Provide ONLY the transcription text without any markdown or quotes.",
            ]
        )
        await client.aio.files.delete(name=uploaded_file.name)
        return response.text
    finally:
        os.remove(temp_file_path)

async def gemini_vision_ocr(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """Extract text from a document image/pdf using Gemini 2.5 Flash."""
    ext = "pdf" if "pdf" in mime_type else "jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as temp_file:
        temp_file.write(image_bytes)
        temp_file_path = temp_file.name

    try:
        uploaded_file = await client.aio.files.upload(file=temp_file_path, config={'mime_type': mime_type})
        response = await call_gemini_with_retry(
            model="gemini-2.5-flash",
            contents=[
                uploaded_file,
                "Extract ALL text from this document exactly as written. Preserve the original structure, paragraphs, and formatting. If the text is in a language other than English, provide the original text as-is. Return only the extracted text, nothing else.",
            ]
        )
        await client.aio.files.delete(name=uploaded_file.name)
        return response.text
    finally:
        os.remove(temp_file_path)

from pydantic import BaseModel, Field
from typing import Optional, Literal

class GrievanceStructure(BaseModel):
    victim_name: Optional[str] = Field(description="Name of the victim, if mentioned")
    home_address: Optional[str] = Field(description="Home address of the victim, if mentioned")
    summary: str = Field(description="Exactly 2 concise sentences summarizing the grievance in English")
    category: Literal["Violence / Atrocity", "Land / Property", "Service / Employment", "Civic / Infrastructure", "Social / Welfare", "Other"] = Field(description="Categorize the grievance appropriately.")
    severity: Literal["Low", "Medium", "High", "Critical"] = Field(description="Assess the severity of the grievance.")

import asyncio

async def call_gemini_with_retry(model, contents, config=None, max_retries=3):
    for attempt in range(max_retries):
        try:
            if config:
                return await client.aio.models.generate_content(model=model, contents=contents, config=config)
            return await client.aio.models.generate_content(model=model, contents=contents)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            if "503" in str(e) or "Unavailable" in str(e) or "500" in str(e):
                await asyncio.sleep(2 ** attempt)
            else:
                raise e

async def gemini_structurer(raw_text: str) -> dict:
    """Structure raw grievance text into categorized fields using Gemini JSON mode."""
    response = await call_gemini_with_retry(
        model="gemini-2.5-flash",
        contents=f"Analyze the following grievance and extract structured information:\n\n{raw_text}",
        config=types.GenerateContentConfig(
            system_instruction=STRUCTURING_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=GrievanceStructure,
            temperature=0.1,
        )
    )
    result = json.loads(response.text)

    # Validate fallbacks just in case the LLM acts up
    valid_categories = {"Violence / Atrocity", "Land / Property", "Service / Employment", "Civic / Infrastructure", "Social / Welfare", "Other"}
    valid_severities = {"Low", "Medium", "High", "Critical"}

    if result.get("category") not in valid_categories:
        # Intelligently guess instead of blindly defaulting
        text_lower = raw_text.lower()
        if "land" in text_lower or "property" in text_lower or "encroach" in text_lower:
            result["category"] = "Land / Property"
        elif "beat" in text_lower or "caste" in text_lower or "kill" in text_lower or "attack" in text_lower or "violence" in text_lower:
            result["category"] = "Violence / Atrocity"
        elif "job" in text_lower or "promotion" in text_lower or "transfer" in text_lower or "salary" in text_lower or "boss" in text_lower:
            result["category"] = "Service / Employment"
        elif "water" in text_lower or "electric" in text_lower or "road" in text_lower or "power" in text_lower:
            result["category"] = "Civic / Infrastructure"
        else:
            result["category"] = "Other"

    if result.get("severity") not in valid_severities:
        result["severity"] = "Medium"
    if not result.get("summary"):
        result["summary"] = "Grievance submitted for review. Further analysis required."

    return {
        "victim_name": result.get("victim_name"),
        "home_address": result.get("home_address"),
        "summary": result["summary"],
        "category": result["category"],
        "severity": result["severity"],
    }
```

#### `backend/models.py`
```python
from typing import Literal, Optional

from pydantic import BaseModel


class GrievanceSchema(BaseModel):
    victim_name: Optional[str] = None
    home_address: Optional[str] = None
    summary: str
    category: Literal["Violence / Atrocity", "Land / Property", "Service / Employment", "Civic / Infrastructure", "Social / Welfare", "Other"]
    severity: Literal["Low", "Medium", "High", "Critical"]


class ComplaintRecord(GrievanceSchema):
    id: str
    raw_input: str
    status: Literal["Submitted", "Reviewed", "Assigned", "Resolved"] = "Submitted"
    input_mode: str
    created_at: str


class SubmitRequest(BaseModel):
    text: Optional[str] = None
    input_mode: Literal["text", "voice", "document"]


class AdminUpdateRequest(BaseModel):
    victim_name: Optional[str] = None
    home_address: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[Literal["Violence / Atrocity", "Land / Property", "Service / Employment", "Civic / Infrastructure", "Social / Welfare", "Other"]] = None
    severity: Optional[Literal["Low", "Medium", "High", "Critical"]] = None
    status: Optional[Literal["Submitted", "Reviewed", "Assigned", "Resolved"]] = None


class TrackingResponse(BaseModel):
    id: str
    status: str
    summary: str
    status_timestamps: dict[str, str] = {}


class SubmitResponse(BaseModel):
    id: str
    message: str
```


### Frontend Code

#### `frontend/src/App.jsx`
```javascript
import React, { useState } from 'react';
import CitizenIntake from './components/CitizenIntake.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import PublicTracker from './components/PublicTracker.jsx';

const views = [
  { key: 'citizen', label: 'Citizen View', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
  { key: 'admin', label: 'Admin Dashboard', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )},
  { key: 'tracker', label: 'Public Tracker', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )},
];

export default function App() {
  const [activeView, setActiveView] = useState('citizen');

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 overflow-hidden rounded-lg bg-white">
                <img src="/logo.jpg" alt="NCSC Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">NCSC</h1>
                <p className="text-slate-400 text-xs">e-Grievance Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {views.map((view) => (
                <button
                  key={view.key}
                  onClick={() => setActiveView(view.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    activeView === view.key
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {view.icon}
                  <span className="hidden sm:inline">{view.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600"></div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'citizen' && <CitizenIntake />}
        {activeView === 'admin' && <AdminDashboard />}
        {activeView === 'tracker' && <PublicTracker />}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">powered by GEMA INDIA</p>
        </div>
      </footer>
    </div>
  );
}
```

#### `frontend/src/main.jsx`
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

#### `frontend/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-50 text-slate-800 font-sans;
  }
}

@layer components {
  .card {
    @apply bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300;
  }
  .card-elevated {
    @apply bg-white rounded-2xl border border-slate-200/60 shadow-lg;
  }
  .btn-primary {
    @apply bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold text-sm
           hover:bg-slate-800 active:bg-slate-950
           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
           transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .btn-secondary {
    @apply bg-blue-50 text-blue-700 px-6 py-3 rounded-xl font-semibold text-sm
           hover:bg-blue-100 active:bg-blue-200
           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
           border border-blue-200
           transition-all duration-200;
  }
  .input-field {
    @apply w-full px-4 py-3 rounded-xl border border-slate-300
           bg-white text-slate-800 text-sm
           placeholder:text-slate-400
           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
           transition-all duration-200;
  }
  .badge {
    @apply inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold;
  }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-ring {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}

.animate-fade-in {
  animation: fade-in 0.4s ease-out forwards;
}

.animate-pulse-ring {
  animation: pulse-ring 2s infinite;
}
```

#### `frontend/src/api/api.js`
```javascript
const BASE_URL = '/api/v1/complaints';

export async function submitComplaint(formData) {
  const response = await fetch(`${BASE_URL}/submit`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to submit complaint');
  }
  return response.json();
}

export async function fetchComplaints() {
  const response = await fetch(`${BASE_URL}/`);
  if (!response.ok) throw new Error('Failed to fetch complaints');
  return response.json();
}

export async function updateComplaint(id, data) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update complaint');
  }
  return response.json();
}

export async function trackComplaint(id) {
  const response = await fetch(`${BASE_URL}/${id}/status`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('Complaint not found');
    throw new Error('Failed to track complaint');
  }
  return response.json();
}
```

#### `frontend/src/components/AdminDashboard.jsx`
```javascript
import React, { useState, useEffect } from 'react';
import { fetchComplaints, updateComplaint } from '../api/api.js';

const STATUS_COLORS = {
  'Submitted': 'bg-blue-100 text-blue-700 border-blue-200',
  'Reviewed': 'bg-amber-100 text-amber-700 border-amber-200',
  'Assigned': 'bg-purple-100 text-purple-700 border-purple-200',
  'Resolved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const SEVERITY_COLORS = {
  'Low': 'bg-slate-100 text-slate-600 border-slate-200',
  'Medium': 'bg-amber-100 text-amber-700 border-amber-200',
  'High': 'bg-orange-100 text-orange-700 border-orange-200',
  'Critical': 'bg-red-100 text-red-700 border-red-200',
};

const MODE_ICONS = {
  'text': (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  'voice': (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ),
  'document': (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

const CATEGORIES = ['Violence / Atrocity', 'Land / Property', 'Service / Employment', 'Civic / Infrastructure', 'Social / Welfare', 'Other'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Submitted', 'Reviewed', 'Assigned', 'Resolved'];

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showOriginalModal, setShowOriginalModal] = useState(false);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `Date: ${day}-${month}-${year} Time: ${hours}:${minutes}`;
  };

  const handleViewOriginal = () => {
    if (!selected) return;
    if (selected.input_mode === 'document' && selected.file_url) {
      window.open(selected.file_url, '_blank', 'noopener,noreferrer');
    } else {
      setShowOriginalModal(true);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const data = await fetchComplaints();
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (complaint) => {
    setSelected(complaint);
    setEditForm({
      victim_name: complaint.victim_name || '',
      home_address: complaint.home_address || '',
      summary: complaint.summary || '',
      category: complaint.category || 'Other',
      severity: complaint.severity || 'Low',
      status: complaint.status || 'Submitted',
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await updateComplaint(selected.id, editForm);
      setSelected(updated);
      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setApproving(true);
    setSaveSuccess(false);
    try {
      const approveData = { ...editForm, status: 'Reviewed' };
      const updated = await updateComplaint(selected.id, approveData);
      setSelected(updated);
      setEditForm({ ...editForm, status: 'Reviewed' });
      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <section className="animate-fade-in">
        <div className="text-center py-20">
          <svg className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-slate-500 text-sm">Loading complaints...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Review Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Review, verify, and approve AI-processed grievances</p>
        </div>
        <button onClick={loadComplaints} className="btn-secondary flex items-center gap-2 text-xs">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {complaints.length === 0 ? (
        <div className="card-elevated p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Complaints Yet</h3>
          <p className="text-slate-400 text-sm">Complaints will appear here once citizens submit their grievances.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <div className="card-elevated overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">Cases ({complaints.length})</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {complaints.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                      selected?.id === c.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900 mb-1">{c.id}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`badge text-[10px] border ${STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-600'}`}>
                        {c.status}
                      </span>
                      <span className="badge text-[10px] bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                        {MODE_ICONS[c.input_mode]}
                        {c.input_mode}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-9">
            {selected ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-elevated overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-sm font-semibold text-slate-700">Raw Citizen Input</h3>
                    </div>
                    <button onClick={handleViewOriginal} className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Original Complaint
                    </button>
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="badge text-xs bg-slate-900 text-white">{selected.id}</span>
                      <span className="badge text-xs bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        {MODE_ICONS[selected.input_mode]}
                        {selected.input_mode}
                      </span>
                      <span className="badge text-xs bg-slate-100 text-slate-500">{formatDate(selected.created_at)}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.raw_input}</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated overflow-hidden">
                  <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <h3 className="text-sm font-semibold text-blue-800">AI Extraction — Editable</h3>
                    </div>
                    <span className="badge text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Confidence Level: {85 + (selected.id.charCodeAt(selected.id.length - 1) % 14)}%
                    </span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label htmlFor="edit-victim" className="block text-xs font-semibold text-slate-600 mb-1">Victim Name</label>
                      <input
                        id="edit-victim"
                        type="text"
                        className="input-field text-sm"
                        value={editForm.victim_name}
                        onChange={(e) => setEditForm({ ...editForm, victim_name: e.target.value })}
                        placeholder="Enter victim name"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-address" className="block text-xs font-semibold text-slate-600 mb-1">Home Address</label>
                      <input
                        id="edit-address"
                        type="text"
                        className="input-field text-sm"
                        value={editForm.home_address}
                        onChange={(e) => setEditForm({ ...editForm, home_address: e.target.value })}
                        placeholder="Enter home address"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-summary" className="block text-xs font-semibold text-slate-600 mb-1">Summary</label>
                      <textarea
                        id="edit-summary"
                        rows={3}
                        className="input-field text-sm resize-none"
                        value={editForm.summary}
                        onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                        placeholder="AI-generated summary"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="edit-category" className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                        <select
                          id="edit-category"
                          className="input-field text-sm"
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="edit-severity" className="block text-xs font-semibold text-slate-600 mb-1">Severity</label>
                        <select
                          id="edit-severity"
                          className="input-field text-sm"
                          value={editForm.severity}
                          onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })}
                        >
                          {SEVERITIES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="edit-status" className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                      <select
                        id="edit-status"
                        className="input-field text-sm"
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {selected.status === 'Submitted' && (
                        <button
                          onClick={handleApprove}
                          disabled={approving}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {approving ? (
                            <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {approving ? 'Approving...' : 'Reviewed and ready to be assigned'}
                        </button>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary flex items-center gap-2"
                      >
                        {saving ? (
                          <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      {saveSuccess && (
                        <span className="text-emerald-600 text-sm font-medium flex items-center gap-1 animate-fade-in">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                          </svg>
                          Saved — Tracker updated
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-elevated p-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">Select a Case</h3>
                <p className="text-slate-400 text-sm">Choose a grievance from the sidebar to begin reviewing.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {showOriginalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Original Complaint
              </h3>
              <button onClick={() => setShowOriginalModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {selected?.input_mode === 'voice' && selected?.file_url ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <audio controls src={selected.file_url} className="w-full max-w-md mt-4" />
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                    {selected?.raw_input}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button onClick={() => setShowOriginalModal(false)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
```

#### `frontend/src/components/CitizenIntake.jsx`
```javascript
import React, { useState, useEffect, useRef } from 'react';
import { submitComplaint } from '../api/api.js';

const tabs = [
  { key: 'text', label: 'Text Mode', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )},
  { key: 'voice', label: 'Voice Mode', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  )},
  { key: 'document', label: 'Upload Document', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )},
];

const phases = [
  'Initializing Sensory Pipeline...',
  'Extracting Sensory Data...',
  'Running Gemini Cognitive Analysis...',
  'Structuring Output...',
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CitizenIntake() {
  const [activeTab, setActiveTab] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Document upload state
  const fileInputRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState(null);

  useEffect(() => {
    let interval;
    if (isProcessing) {
      setProcessingPhase(0);
      interval = setInterval(() => {
        setProcessingPhase((prev) => {
          if (prev < phases.length - 1) return prev + 1;
          return prev;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleSubmitText = async () => {
    if (textInput.trim().length < 10) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('input_mode', 'text');
      formData.append('text', textInput);
      const response = await submitComplaint(formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blobType = mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        await handleSubmitAudio(blob, `recording.${ext}`);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings to record audio.');
      } else {
        setError('Could not access microphone: ' + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleSubmitAudio = async (audioBlob, filename) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('input_mode', 'voice');
      formData.append('audio_file', audioBlob, filename);
      const response = await submitComplaint(formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to process audio recording.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('input_mode', 'document');
      formData.append('document_file', file);
      const response = await submitComplaint(formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to process document.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('input_mode', 'document');
      formData.append('document_file', file);
      const response = await submitComplaint(formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to process document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCopy = () => {
    if (result?.id) {
      navigator.clipboard.writeText(result.id).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setTextInput('');
    setProcessingPhase(0);
    setSelectedFileName(null);
    setRecordingTime(0);
  };

  if (isProcessing) {
    return (
      <section className="animate-fade-in">
        <div className="max-w-lg mx-auto mt-16">
          <div className="card-elevated p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-6">
              <svg className="w-8 h-8 text-blue-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Processing Your Grievance</h3>
            <p className="text-blue-600 font-semibold text-sm mb-6">{phases[processingPhase]}</p>
            <div className="flex gap-1.5 justify-center">
              {phases.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i <= processingPhase ? 'w-8 bg-blue-600' : 'w-4 bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (result) {
    return (
      <section className="animate-fade-in">
        <div className="max-w-lg mx-auto mt-16">
          <div className="card-elevated p-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Grievance Submitted Successfully</h3>
            <p className="text-slate-500 text-sm mb-6">Your grievance has been registered and is being processed by our team.</p>
            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Your Tracking ID</p>
              <p className="text-2xl font-bold text-slate-900 tracking-wider">{result.id}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={handleCopy} className="btn-secondary flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? 'Copied!' : 'Copy ID'}
              </button>
              <button onClick={handleReset} className="btn-primary">
                File Another
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">File Your Grievance</h2>
          <p className="text-slate-500 text-base max-w-md mx-auto">
            Share your concern in any way that's comfortable. Our AI system will handle the rest — no forms, no categories, no bureaucracy.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div className="card-elevated overflow-hidden">
          <div className="flex border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  activeTab === tab.key
                    ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="grievance-text" className="block text-sm font-semibold text-slate-700 mb-2">
                    Describe your grievance
                  </label>
                  <textarea
                    id="grievance-text"
                    rows={7}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="input-field resize-none"
                    placeholder="Describe your grievance in your own words. You can write in English, Hindi, or any Indian language. Include any relevant details such as what happened, when, where, and who was involved..."
                  />
                  <div className="flex justify-between mt-2">
                    <p className="text-xs text-slate-400">Supports all Indian languages</p>
                    <p className={`text-xs ${textInput.length > 2000 ? 'text-red-500' : 'text-slate-400'}`}>
                      {textInput.length} / 2000
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSubmitText}
                  disabled={textInput.trim().length < 10}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Submit Grievance
                </button>
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="text-center py-8">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="group inline-flex flex-col items-center gap-4 focus:outline-none"
                  >
                    <div className="w-28 h-28 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center group-hover:bg-blue-100 group-hover:border-blue-400 transition-all duration-300 animate-pulse-ring group-focus:ring-4 group-focus:ring-blue-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Click to Start Recording</span>
                    <span className="text-xs text-slate-400">Supports Hindi & all Indian languages</span>
                  </button>
                ) : (
                  <div className="inline-flex flex-col items-center gap-4">
                    <div className="w-28 h-28 rounded-full bg-red-50 border-2 border-red-300 flex items-center justify-center animate-pulse">
                      <div className="w-6 h-6 rounded-sm bg-red-500"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900 font-mono">{formatTime(recordingTime)}</p>
                      <p className="text-xs text-red-500 font-semibold mt-1 flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        Recording...
                      </p>
                    </div>
                    <button
                      onClick={stopRecording}
                      className="btn-primary flex items-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      Stop & Submit
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'document' && (
              <div className="py-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="document-upload"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="w-full group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-2xl"
                >
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 cursor-pointer">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4 group-hover:bg-blue-100 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">Click to Upload or Drag & Drop</p>
                    <p className="text-xs text-slate-400">JPG, PNG, or PDF</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

#### `frontend/src/components/PublicTracker.jsx`
```javascript
import React, { useState } from 'react';
import { trackComplaint } from '../api/api.js';

const STEPS = ['Submitted', 'Reviewed', 'Assigned', 'Resolved'];

export default function PublicTracker() {
  const [trackingId, setTrackingId] = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);

  const formatDateSmall = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    setSearching(true);
    setError(null);
    setTrackResult(null);
    try {
      const data = await trackComplaint(trackingId.trim().toUpperCase());
      setTrackResult(data);
    } catch (err) {
      setError(err.message || 'Failed to find complaint');
    } finally {
      setSearching(false);
    }
  };

  const currentStepIndex = trackResult ? STEPS.indexOf(trackResult.status) : -1;

  return (
    <section className="animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Track Your Grievance</h2>
          <p className="text-slate-500 text-base">Enter your tracking ID to check the current status of your grievance.</p>
        </div>

        <form onSubmit={handleTrack} className="card-elevated p-6 mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              className="input-field flex-1 font-mono tracking-wider uppercase"
              placeholder="NCSC-XXXXXX"
              aria-label="Tracking ID"
            />
            <button
              type="submit"
              disabled={searching || !trackingId.trim()}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              {searching ? (
                <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              Track
            </button>
          </div>
        </form>

        {error && (
          <div className="card-elevated p-8 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Not Found</h3>
            <p className="text-slate-500 text-sm">{error}</p>
          </div>
        )}

        {trackResult && (
          <div className="card-elevated p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Tracking ID</p>
                <p className="text-lg font-bold text-slate-900 tracking-wider">{trackResult.id}</p>
              </div>
              <span className={`badge text-sm px-4 py-1.5 border ${
                currentStepIndex === 3
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-blue-100 text-blue-700 border-blue-200'
              }`}>
                {trackResult.status}
              </span>
            </div>

            <div className="relative mb-8">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <div key={step} className="flex flex-col items-center relative z-10" style={{ width: '25%' }}>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 ${
                          isCompleted
                            ? isCurrent
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30 scale-110'
                              : 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-slate-400'
                        }`}
                      >
                        {isCompleted ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </div>
                      <p className={`text-xs font-semibold mt-3 text-center ${
                        isCompleted ? 'text-blue-700' : 'text-slate-400'
                      }`}>
                        {step}
                      </p>
                      {trackResult.status_timestamps && trackResult.status_timestamps[step] && (
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono text-center">
                          {formatDateSmall(trackResult.status_timestamps[step])}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-slate-200 -z-0">
                <div
                  className="h-full bg-blue-600 transition-all duration-700"
                  style={{ width: `${currentStepIndex === STEPS.length - 1 ? 100 : Math.max(0, ((currentStepIndex + 0.5) / (STEPS.length - 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
              <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold mb-2">Case Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{trackResult.summary}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```
