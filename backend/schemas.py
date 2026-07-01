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
    aadhaar_no: str
    raw_input: str
    file_url: Optional[str] = None
    status: Literal["Submitted", "Reviewed", "Assigned", "Resolved"] = "Submitted"
    internal_status: str = "Submitted"
    input_mode: str
    created_at: str
    nudge_timestamps: list[str] = []


class CitizenResponse(BaseModel):
    aadhaar_no: str
    name: str
    mobile_number: str
    home_address: Optional[str] = None
    complaints: list[ComplaintRecord] = []


class SubmitRequest(BaseModel):
    aadhaar_no: str
    text: Optional[str] = None
    input_mode: Literal["text", "voice", "document"]


class AdminUpdateRequest(BaseModel):
    victim_name: Optional[str] = None
    phone_number: Optional[str] = None
    home_address: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[Literal["Violence / Atrocity", "Land / Property", "Service / Employment", "Civic / Infrastructure", "Social / Welfare", "Other"]] = None
    severity: Optional[Literal["Low", "Medium", "High", "Critical"]] = None
    status: Optional[str] = None
    internal_status: Optional[str] = None


class TrackingResponse(BaseModel):
    id: str
    status: str
    internal_status: str = "Submitted"
    summary: str
    created_at: str
    status_timestamps: dict[str, str] = {}
    nudge_timestamps: list[str] = []


class SubmitResponse(BaseModel):
    id: str
    message: str
