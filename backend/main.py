import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from database import engine, Base
import models
from routes import router

Base.metadata.create_all(bind=engine)

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

app.include_router(router)


@app.get("/")
async def root():
    return {"message": "Nyay Setu API is running", "version": "1.0.0"}
