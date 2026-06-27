# NCSC e-Grievance Management Portal

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Google Gemini AI](https://img.shields.io/badge/Google_Gemini_AI-8E75B2?style=flat-square&logo=google&logoColor=white)

> *An AI-driven, multi-modal grievance ingestion and lifecycle tracking system designed to bridge the gap between citizens and administrative resolution without bureaucratic hurdles.*

---

## 🌍 Project Overview & Social Impact

Citizens often face bureaucratic hurdles—complex forms, language barriers, and opaque tracking systems—when attempting to file critical grievances. **Nyay Setu** (Bridge of Justice) eliminates these roadblocks by offering a frictionless, AI-first portal. 

Citizens can simply speak, type, or upload an image of their grievance in their native language. The system's cognitive engine autonomously transcribes, translates, categorizes, and structures the data for authorities while providing the citizen with a transparent, highly interactive tracking lifecycle.

---

## ✨ Key Features

* **Multimodal Ingestion Pipeline**: Accepts text narratives, browser-based voice recordings (audio streaming), and drag-and-drop document uploads (JPG, PNG, PDF) with full multi-language support (English, Hindi, and regional Indian languages).
* **Deterministic AI Structuring**: Utilizes the Google Gemini 2.5 Flash model with JSON schema enforcement to extract key entities (`victim_name`, `home_address`), concisely summarize narratives, and intelligently map categories and severity levels.
* **Granular SLA Lifecycle Tracking**: Maintains an isolated, dual-layer tracking engine. It maps complex internal workflow states (6 granular stages including `Desk_Reviewed` and `Police_Dispatched`) to a simplified, transparent public timeline (4 verification milestones).
* **Interactive Admin Portal**: Features a dynamic Admin Dashboard with case sidebars, editable AI-extracted data cards, real-time status updates, and a color-coded vertical step tracker that dynamically highlights processing velocity and operational bottlenecks.

---

## 🧠 Architecture & Technical Workflow

The application leverages a real-time data flow linking the citizen's raw input directly to the administrative database via AI structuring:

1. **Ingestion**: The React frontend (`CitizenIntake.jsx`) captures audio blobs, image/pdf files, or text.
2. **OCR & Transcription**: The backend passes raw files directly to Gemini via `gemini_vision_ocr()` or `gemini_transcribe()` to extract pure textual narrative.
3. **Deterministic Structuring**: The unstructured text is fed into `gemini_structurer()`, enforcing a strict `GrievanceStructure` JSON schema to output categorized, standardized data fields.
4. **Routing & Database State**: FastAPI persists the structured grievance into a SQLite database, generating a secure ID (`NCSC-XXXXXX`) and initializing a JSON matrix of timeline timestamps.
5. **Dashboards & Tracking**: The Admin Portal (`AdminDashboard.jsx`) displays SLA velocities based on timestamp deltas, while the Public Tracker (`PublicTracker.jsx`) provides citizens with simplified progressive milestone verification.

---

## 🛠️ Tech Stack

* **Frontend**: React, Vite, Tailwind CSS (Custom design tokens, elevated card layouts, processing animations)
* **Backend**: FastAPI, Python, SQLAlchemy, Pydantic v2
* **Database**: SQLite (Configured for synchronous state management)
* **AI Engine**: Google GenAI SDK (`gemini-2.5-flash`)

---

## 🚀 Getting Started

### Prerequisites
* **Python 3.10+**
* **Node.js 18+**
* **Google AI Studio API Key** (for Gemini features)

### 1. Backend Setup

Navigate to the backend directory, create a virtual environment, and install dependencies:

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\Activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Set up your environment variables by creating a `.env` file in the `backend` directory:
```env
GEMINI_API_KEY="your_google_ai_studio_api_key_here"
```

Start the FastAPI server:
```bash
uvicorn main:app --reload
```
*The backend will be running at `http://127.0.0.1:8000`*

### 2. Frontend Setup

Open a new terminal, navigate to the frontend directory, and install the required Node packages:

```bash
cd frontend
npm install
```

Start the Vite development server:
```bash
npm run dev
```
*The frontend will be running at `http://localhost:5173` (or the port specified by Vite).*

---

## 🔌 API Reference

The backend provides a clean RESTful routing architecture for managing grievances:

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/complaints/submit` | Handles multimodal ingestion (text, voice, document uploads) |
| `GET` | `/api/v1/complaints/` | Fetches all active cases for the Admin Dashboard |
| `PUT` | `/api/v1/complaints/{id}` | Updates case state, overrides AI extraction, and triggers timestamp tracking |
| `GET` | `/api/v1/complaints/{id}/status` | Exposes public verification tracking timeline |