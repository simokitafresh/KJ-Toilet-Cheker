from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    internal_name = Column(String(100), nullable=False)
    icon_code = Column(String(50), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    checks = relationship("ToiletCheck", back_populates="staff")

class Toilet(Base):
    __tablename__ = "toilets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    floor = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    checks = relationship("ToiletCheck", back_populates="toilet")
    major_checkpoints = relationship("MajorCheckpoint", back_populates="target_toilet")
    # devices = relationship("Device", back_populates="assigned_toilet") # Not used yet

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_uuid = Column(String(255), unique=True, nullable=False)
    name = Column(String(100))
    assigned_toilet_id = Column(Integer, ForeignKey("toilets.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # assigned_toilet = relationship("Toilet", back_populates="devices")
    checks = relationship("ToiletCheck", back_populates="device")

class ToiletCheck(Base):
    __tablename__ = "toilet_checks"

    id = Column(Integer, primary_key=True, index=True)
    toilet_id = Column(Integer, ForeignKey("toilets.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    checked_at = Column(DateTime(timezone=True), nullable=False)
    interval_sec_from_prev = Column(Integer, nullable=True)
    status_type = Column(String(20), nullable=False) # NORMAL, TOO_SHORT, TOO_LONG
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    toilet = relationship("Toilet", back_populates="checks")
    device = relationship("Device", back_populates="checks")
    staff = relationship("Staff", back_populates="checks")
    images = relationship("CheckImage", back_populates="check", cascade="all, delete-orphan")

class CheckImage(Base):
    __tablename__ = "check_images"

    id = Column(Integer, primary_key=True, index=True)
    check_id = Column(Integer, ForeignKey("toilet_checks.id"), nullable=False)
    image_path = Column(String(500), nullable=False)
    image_type = Column(String(20), nullable=False) # sheet, overview, extra
    order_index = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    check = relationship("ToiletCheck", back_populates="images")

class MajorCheckpoint(Base):
    __tablename__ = "major_checkpoints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    target_toilet_id = Column(Integer, ForeignKey("toilets.id"), nullable=True) # NULL = All toilets
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    target_toilet = relationship("Toilet", back_populates="major_checkpoints")

class ClinicConfig(Base):
    __tablename__ = "clinic_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(String(500), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
