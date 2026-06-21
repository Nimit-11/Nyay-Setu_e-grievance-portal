# Nyay Setu – AI-Powered Grievance Management Portal

An AI-powered grievance management platform that enables citizens to submit complaints through text, voice recordings, or uploaded documents.

The system leverages Google's Gemini 2.5 Flash model for:

- Speech-to-Text Transcription
- OCR Document Processing
- Intelligent Complaint Structuring
- Automated Classification
- Severity Assessment

The platform also provides an Admin Review Dashboard and a Public Complaint Tracking System.

---

## Features

### Citizen Complaint Submission

- Text-based complaint filing
- Voice complaint submission
- Document/Image complaint upload
- Automatic complaint ID generation

### AI Processing Pipeline

- Gemini 2.5 Flash transcription
- OCR extraction from documents
- Structured information extraction
- Complaint categorization
- Severity scoring

### Admin Dashboard

- Review AI-generated summaries
- Edit extracted information
- Update complaint status
- Track complaint lifecycle

### Public Tracker

- Track complaint status using complaint ID
- View processing progress
- Real-time status updates

---

## Tech Stack

### Frontend

- React
- Vite
- TailwindCSS

### Backend

- FastAPI
- Python

### AI Layer

- Google Gemini 2.5 Flash
- Google GenAI SDK

---

## System Architecture

![Architecture](docs/architecture.png)

---

## Project Structure

```text
Nyay-Setu-AI-Grievance-Portal
│
├── backend
│   ├── main.py
│   ├── routes.py
│   ├── models.py
│   ├── ai_pipelines.py
│   └── requirements.txt
│
├── frontend
│   ├── src
│   ├── public
│   ├── package.json
│   └── vite.config.js
│
├── screenshots
│
├── docs
│
├── .gitignore
├── LICENSE
└── README.md