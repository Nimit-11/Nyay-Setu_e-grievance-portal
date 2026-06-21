import asyncio
import re
from typing import Optional


async def mock_whisper_transcribe(audio_data: str) -> str:
    await asyncio.sleep(1.5)
    return (
        "My name is Ramesh Kumar and I am a resident of 45 Gandhi Nagar, Hyderabad. "
        "I wish to report that my ancestral land measuring approximately 2 acres in "
        "Survey Number 134 has been illegally encroached upon by local authorities and "
        "a private builder. The encroachment started three months ago and despite multiple "
        "complaints to the local revenue office, no action has been taken. I am a member "
        "of a Scheduled Caste community and I believe this land grab is motivated by "
        "caste-based discrimination. I request the NCSC to urgently intervene and restore "
        "my rightful ownership of the property."
    )


async def mock_easyocr_extract(image_data: str) -> str:
    await asyncio.sleep(1.2)
    return (
        "To The Chairperson, National Commission for Scheduled Castes, New Delhi. "
        "Subject: Formal Complaint Regarding Caste-Based Discrimination at Government "
        "Office. Respected Sir/Madam, I, Sunita Devi, resident of 12 Ambedkar Colony, "
        "Pune, Maharashtra, wish to bring to your kind attention the persistent "
        "discrimination and atrocity I have been facing at the District Collector Office, "
        "Pune. On 15th March 2026, when I visited the office to submit my application for "
        "a Below Poverty Line certificate, the attending clerk refused to accept my "
        "documents and made derogatory remarks about my caste. Despite having all required "
        "documents, I was turned away while applicants from other communities were served "
        "promptly. This is a clear violation of the SC/ST Prevention of Atrocities Act. "
        "I humbly request an investigation into this matter. Yours faithfully, Sunita Devi."
    )


def _extract_victim_name(raw_text: str) -> Optional[str]:
    patterns = [
        r"(?:named|name is|I,|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _extract_address(raw_text: str) -> Optional[str]:
    patterns = [
        r"(?:resident of|address|residing at|located at)\s+(.+?)(?:\.|,\s*(?:wish|I |want|request|Subject))",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            return match.group(1).strip().rstrip(",")
    return None


async def mock_llm_structurer(raw_text: str) -> dict:
    await asyncio.sleep(2.0)

    text_lower = raw_text.lower()

    if any(keyword in text_lower for keyword in ["atrocity", "caste", "discrimination"]):
        category = "Atrocity"
        severity = "Critical"
    elif any(keyword in text_lower for keyword in ["land", "encroach", "property"]):
        category = "Land Dispute"
        severity = "High"
    elif any(keyword in text_lower for keyword in ["service", "pension", "transfer"]):
        category = "Service Matter"
        severity = "Medium"
    else:
        category = "Social/Economic"
        severity = "Low"

    victim_name = _extract_victim_name(raw_text)
    home_address = _extract_address(raw_text)

    basis = raw_text[:100].rstrip()
    if not basis.endswith("."):
        basis = basis.rsplit(" ", 1)[0] + "..."
    summary = (
        f"{basis} "
        f"This grievance has been classified as {category} with {severity} severity and requires prompt attention."
    )

    return {
        "victim_name": victim_name,
        "home_address": home_address,
        "summary": summary,
        "category": category,
        "severity": severity,
    }
