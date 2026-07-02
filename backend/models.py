from sqlalchemy import Column, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.mutable import MutableDict, MutableList
from database import Base

class DBCitizen(Base):
    __tablename__ = "citizens"

    aadhaar_no = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    mobile_number = Column(String, nullable=False)
    home_address = Column(String, nullable=True)

    complaints = relationship("DBComplaint", back_populates="citizen")


class DBComplaint(Base):
    __tablename__ = "complaints"

    id = Column(String, primary_key=True, index=True)
    aadhaar_no = Column(String, ForeignKey("citizens.aadhaar_no"))
    raw_input = Column(Text)
    input_mode = Column(String)
    file_url = Column(String, nullable=True)
    created_at = Column(String)
    status = Column(String)
    internal_status = Column(String, default="Submitted")
    victim_name = Column(String, nullable=True)
    home_address = Column(String, nullable=True)
    summary = Column(Text)
    category = Column(String)
    severity = Column(String)
    status_timestamps = Column(MutableDict.as_mutable(JSON), default={})
    nudge_timestamps = Column(MutableList.as_mutable(JSON), default=[])

    citizen = relationship("DBCitizen", back_populates="complaints")
