from sqlalchemy import Column, String, Text, LargeBinary, JSON
from sqlalchemy.ext.mutable import MutableDict
from database import Base

class DBComplaint(Base):
    __tablename__ = "complaints"

    id = Column(String, primary_key=True, index=True)
    raw_input = Column(Text)
    input_mode = Column(String)
    file_url = Column(String, nullable=True)
    created_at = Column(String)
    status = Column(String)
    victim_name = Column(String, nullable=True)
    home_address = Column(String, nullable=True)
    summary = Column(Text)
    category = Column(String)
    severity = Column(String)
    status_timestamps = Column(MutableDict.as_mutable(JSON), default={})
