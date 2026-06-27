import json
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Initialize the new Gemini client (reads GEMINI_API_KEY from env)
load_dotenv(override=True)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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
            print(f"Error calling Gemini API: {e}")
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
