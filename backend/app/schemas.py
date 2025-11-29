from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, time

# --- Staff ---
class StaffBase(BaseModel):
    internal_name: str
    icon_code: str
    display_order: Optional[int] = 0
    is_active: Optional[bool] = True

class StaffCreate(StaffBase):
    pass

class StaffUpdate(BaseModel):
    internal_name: Optional[str] = None
    icon_code: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

class Staff(StaffBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Toilet ---
class ToiletBase(BaseModel):
    name: str
    floor: Optional[str] = None
    is_active: Optional[bool] = True

class ToiletCreate(ToiletBase):
    pass

class ToiletUpdate(BaseModel):
    name: Optional[str] = None
    floor: Optional[str] = None
    is_active: Optional[bool] = None

class Toilet(ToiletBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Check ---
class CheckImage(BaseModel):
    image_path: str
    image_type: str
    order_index: int

    model_config = ConfigDict(from_attributes=True)

class CheckCreate(BaseModel):
    toilet_id: int
    staff_id: int
    device_uuid: str

class CheckResponse(BaseModel):
    id: int
    toilet_id: int
    staff_id: int
    checked_at: datetime
    status_type: str
    images: List[CheckImage]
    
    # Relationships
    staff: Optional[Staff] = None
    toilet: Optional[Toilet] = None

    model_config = ConfigDict(from_attributes=True)

# --- Major Checkpoint ---
class MajorCheckpointBase(BaseModel):
    name: str
    start_time: time
    end_time: time
    target_toilet_id: Optional[int] = None
    is_active: Optional[bool] = True
    display_order: Optional[int] = 0

class MajorCheckpointCreate(MajorCheckpointBase):
    pass

class MajorCheckpointUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    target_toilet_id: Optional[int] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None

class MajorCheckpoint(MajorCheckpointBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Clinic Config ---
class ClinicConfigBase(BaseModel):
    key: str
    value: str

class ClinicConfigUpdate(BaseModel):
    value: str

class ClinicConfig(ClinicConfigBase):
    id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Dashboard ---
class MajorCheckpointStatus(BaseModel):
    name: str
    status: str # pending, completed, missed
    last_check_time: Optional[str] = None # HH:MM

class RealtimeAlert(BaseModel):
    toilet_name: str
    minutes_elapsed: int
    alert_level: str # warning, alert

class TimelineItem(BaseModel):
    id: int
    checked_at: datetime
    staff_icon: str
    status_type: str
    thumbnails: List[str]

class DashboardDayResponse(BaseModel):
    major_checkpoints: List[MajorCheckpointStatus]
    realtime_alerts: List[RealtimeAlert]
    timeline: List[TimelineItem]
