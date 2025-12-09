from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.api import deps
from app.models import Staff, Toilet, MajorCheckpoint, ClinicConfig
from app.schemas import (
    StaffCreate, StaffUpdate, Staff as StaffSchema,
    ToiletCreate, ToiletUpdate, Toilet as ToiletSchema,
    MajorCheckpointCreate, MajorCheckpointUpdate, MajorCheckpoint as MajorCheckpointSchema,
    ClinicConfig as ClinicConfigSchema, ClinicConfigUpdate
)

router = APIRouter(dependencies=[Depends(deps.get_current_admin)])

# --- Staff ---
class StaffReorderRequest(BaseModel):
    staff_ids: List[int]

@router.get("/staff", response_model=List[StaffSchema])
def get_admin_staff(
    include_inactive: bool = Query(False, description="Include inactive staff"),
    db: Session = Depends(deps.get_db)
):
    query = db.query(Staff)
    if not include_inactive:
        query = query.filter(Staff.is_active == True)
    return query.order_by(Staff.display_order).all()

@router.post("/staff", response_model=StaffSchema)
def create_staff(staff: StaffCreate, db: Session = Depends(deps.get_db)):
    db_staff = Staff(**staff.model_dump())
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    return db_staff

@router.patch("/staff/{staff_id}", response_model=StaffSchema)
def update_staff(staff_id: int, staff_in: StaffUpdate, db: Session = Depends(deps.get_db)):
    db_staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    update_data = staff_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_staff, key, value)
    
    db.commit()
    db.refresh(db_staff)
    return db_staff

@router.delete("/staff/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(deps.get_db)):
    db_staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    db_staff.is_active = False
    db.commit()
    return {"ok": True}

@router.post("/staff/reorder")
def reorder_staff(request: StaffReorderRequest, db: Session = Depends(deps.get_db)):
    for index, staff_id in enumerate(request.staff_ids):
        db_staff = db.query(Staff).filter(Staff.id == staff_id).first()
        if db_staff:
            db_staff.display_order = index + 1
    db.commit()
    return {"ok": True}

# --- Toilets ---
@router.get("/toilets", response_model=List[ToiletSchema])
def get_admin_toilets(db: Session = Depends(deps.get_db)):
    return db.query(Toilet).all()

@router.post("/toilets", response_model=ToiletSchema)
def create_toilet(toilet: ToiletCreate, db: Session = Depends(deps.get_db)):
    count = db.query(Toilet).count()
    if count >= 2:
        raise HTTPException(status_code=400, detail="Max 2 toilets allowed")
    
    db_toilet = Toilet(**toilet.model_dump())
    db.add(db_toilet)
    db.commit()
    db.refresh(db_toilet)
    return db_toilet

@router.patch("/toilets/{toilet_id}", response_model=ToiletSchema)
def update_toilet(toilet_id: int, toilet_in: ToiletUpdate, db: Session = Depends(deps.get_db)):
    db_toilet = db.query(Toilet).filter(Toilet.id == toilet_id).first()
    if not db_toilet:
        raise HTTPException(status_code=404, detail="Toilet not found")
    
    update_data = toilet_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_toilet, key, value)
    
    db.commit()
    db.refresh(db_toilet)
    return db_toilet

# --- Major Checkpoints ---
@router.get("/major-checkpoints", response_model=List[MajorCheckpointSchema])
def get_major_checkpoints(db: Session = Depends(deps.get_db)):
    return db.query(MajorCheckpoint).order_by(MajorCheckpoint.display_order).all()

@router.post("/major-checkpoints", response_model=MajorCheckpointSchema)
def create_major_checkpoint(checkpoint: MajorCheckpointCreate, db: Session = Depends(deps.get_db)):
    db_cp = MajorCheckpoint(**checkpoint.model_dump())
    db.add(db_cp)
    db.commit()
    db.refresh(db_cp)
    return db_cp

@router.patch("/major-checkpoints/{cp_id}", response_model=MajorCheckpointSchema)
def update_major_checkpoint(cp_id: int, cp_in: MajorCheckpointUpdate, db: Session = Depends(deps.get_db)):
    db_cp = db.query(MajorCheckpoint).filter(MajorCheckpoint.id == cp_id).first()
    if not db_cp:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    
    update_data = cp_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_cp, key, value)
    
    db.commit()
    db.refresh(db_cp)
    return db_cp

@router.delete("/major-checkpoints/{cp_id}")
def delete_major_checkpoint(cp_id: int, db: Session = Depends(deps.get_db)):
    db_cp = db.query(MajorCheckpoint).filter(MajorCheckpoint.id == cp_id).first()
    if not db_cp:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    
    db.delete(db_cp)
    db.commit()
    return {"ok": True}

# --- Settings ---
@router.get("/settings", response_model=List[ClinicConfigSchema])
def get_settings(db: Session = Depends(deps.get_db)):
    return db.query(ClinicConfig).all()

@router.post("/settings", response_model=ClinicConfigSchema)
def update_setting(key: str, setting: ClinicConfigUpdate, db: Session = Depends(deps.get_db)):
    db_setting = db.query(ClinicConfig).filter(ClinicConfig.key == key).first()
    if not db_setting:
        # Create if not exists
        db_setting = ClinicConfig(key=key, value=setting.value)
        db.add(db_setting)
    else:
        db_setting.value = setting.value
    
    db.commit()
    db.refresh(db_setting)
    return db_setting
