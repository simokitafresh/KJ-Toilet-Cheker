from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import os
import shutil
import logging
from app.api import deps
from app.models import ToiletCheck, CheckImage, Toilet, Staff, Device
from app.schemas import CheckResponse
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=CheckResponse)
def create_check(
    toilet_id: int = Form(...),
    staff_id: int = Form(...),
    device_uuid: str = Form(...),
    images: List[UploadFile] = File(...),
    db: Session = Depends(deps.get_db)
):
    try:
        # 1. Validation
        if len(images) < 2:
            raise HTTPException(status_code=400, detail="At least 2 images are required")

        # Verify toilet and staff exist
        toilet = db.query(Toilet).filter(Toilet.id == toilet_id).first()
        if not toilet:
            raise HTTPException(status_code=404, detail="Toilet not found")
        
        staff = db.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")

        # Handle Device (Create if not exists)
        device = db.query(Device).filter(Device.device_uuid == device_uuid).first()
        if not device:
            device = Device(device_uuid=device_uuid, name="Unknown Device")
            db.add(device)
            db.commit()
            db.refresh(device)

        # 2. Status Calculation
        # Get previous check for this toilet
        prev_check = db.query(ToiletCheck)\
            .filter(ToiletCheck.toilet_id == toilet_id)\
            .order_by(desc(ToiletCheck.checked_at))\
            .first()

        current_time = datetime.now(timezone.utc)
        interval_sec = None
        status_type = "NORMAL"

        if prev_check:
            # Ensure prev_check.checked_at is aware
            prev_at = prev_check.checked_at
            if prev_at.tzinfo is None:
                prev_at = prev_at.replace(tzinfo=timezone.utc)
            
            delta = current_time - prev_at
            interval_sec = int(delta.total_seconds())
            
            # Logic:
            # < 45 min (2700s) -> TOO_SHORT
            # 45-90 min (2700-5400s) -> NORMAL
            # > 90 min (5400s) -> TOO_LONG
            
            if interval_sec < 2700:
                status_type = "TOO_SHORT"
            elif interval_sec > 5400:
                status_type = "TOO_LONG"
            else:
                status_type = "NORMAL"
        else:
            # First check ever
            status_type = "NORMAL"


        # 3. Create Check Record
        new_check = ToiletCheck(
            toilet_id=toilet_id,
            device_id=device.id,
            staff_id=staff_id,
            checked_at=current_time,
            interval_sec_from_prev=interval_sec,
            status_type=status_type
        )
        db.add(new_check)
        db.commit()
        db.refresh(new_check)

        # 4. Save Images
        # Directory: /var/data/toilet-images/YYYY/MM/DD/{check_id}/
        date_path = current_time.strftime("%Y/%m/%d")
        save_dir = os.path.join(settings.IMAGE_STORAGE_PATH, date_path, str(new_check.id))
        os.makedirs(save_dir, exist_ok=True)

        check_images = []
        for idx, img in enumerate(images):
            # Determine image type
            if idx == 0:
                img_type = "sheet"
            elif idx == 1:
                img_type = "overview"
            else:
                img_type = "extra"
            
            filename = f"{idx}_{img_type}.jpg"
            file_path = os.path.join(save_dir, filename)
            
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(img.file, buffer)
                
            # Create DB record
            db_image = CheckImage(
                check_id=new_check.id,
                image_path=file_path,
                image_type=img_type,
                order_index=idx
            )
            db.add(db_image)
            check_images.append(db_image)
        
        db.commit()
        
        return new_check

    except Exception as e:
        logger.error(f"Error creating check: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[CheckResponse])
def get_checks(
    date: str, # YYYY-MM-DD
    toilet_id: Optional[int] = None,
    db: Session = Depends(deps.get_db)
):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    query = db.query(ToiletCheck).filter(
        func.date(ToiletCheck.checked_at) == target_date
    )

    if toilet_id:
        query = query.filter(ToiletCheck.toilet_id == toilet_id)

    return query.order_by(desc(ToiletCheck.checked_at)).all()
