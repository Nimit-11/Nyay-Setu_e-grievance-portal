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
