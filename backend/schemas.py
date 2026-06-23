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
