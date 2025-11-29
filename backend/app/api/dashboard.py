from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_
from typing import List, Optional
from datetime import datetime, date, time, timedelta
import os
from app.api import deps
from app.core.config import settings
from app.models import ToiletCheck, MajorCheckpoint, Toilet, Staff, CheckImage
from app.schemas import DashboardDayResponse, MajorCheckpointStatus, RealtimeAlert, TimelineItem

router = APIRouter()

@router.get("/day", response_model=DashboardDayResponse)
def get_dashboard_day(
    date_str: str, # YYYY-MM-DD
    toilet_id: Optional[int] = None,
    db: Session = Depends(deps.get_db)
):
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # 1. Major Checkpoints Status
    major_checkpoints = db.query(MajorCheckpoint).filter(MajorCheckpoint.is_active == True).order_by(MajorCheckpoint.display_order).all()
    checkpoint_statuses = []
    
    # Get all checks for the day
    day_checks_query = db.query(ToiletCheck).filter(func.date(ToiletCheck.checked_at) == target_date)
    if toilet_id:
        day_checks_query = day_checks_query.filter(ToiletCheck.toilet_id == toilet_id)
    day_checks = day_checks_query.all()

    from datetime import timezone
    current_dt = datetime.now(timezone.utc)
    is_today = target_date == current_dt.date()

    for cp in major_checkpoints:
        # Filter checks within this checkpoint's time window
        # Note: This simple logic assumes time window is within the same day
        
        # Convert time to datetime for comparison
        start_dt = datetime.combine(target_date, cp.start_time)
        end_dt = datetime.combine(target_date, cp.end_time)
        
        matched_check = None
        for check in day_checks:
            # Check if check is within window
            # If toilet_id is specified in CP, filter by it. If CP.target_toilet_id is None, it applies to all (or any).
            # Logic: If CP targets specific toilet, only checks for that toilet count.
            # If CP targets ALL (None), any check counts? Or do we need checks for ALL toilets?
            # Spec says: "target_toilet_id: NULL=All toilets". 
            # Let's assume for Dashboard Day View (which might be filtered by toilet_id), 
            # if we are viewing a specific toilet, we only care about CPs for that toilet or ALL.
            
            if cp.target_toilet_id and cp.target_toilet_id != check.toilet_id:
                continue
            
            if start_dt <= check.checked_at <= end_dt:
                matched_check = check
                break
        
        status = "pending"
        last_check_time = None
        
        if matched_check:
            status = "completed"
            last_check_time = matched_check.checked_at.strftime("%H:%M")
        else:
            if is_today:
                if current_dt < start_dt:
                    status = "pending" # Future
                elif start_dt <= current_dt <= end_dt:
                    status = "pending" # Current window, not done yet
                else:
                    status = "missed" # Past window
            elif target_date < current_dt.date():
                status = "missed" # Past day
            else:
                status = "pending" # Future day

        checkpoint_statuses.append(MajorCheckpointStatus(
            name=cp.name,
            status=status,
            last_check_time=last_check_time
        ))

    # 2. Realtime Alerts (Only for today)
    alerts = []
    if is_today:
        # Get all active toilets
        toilets = db.query(Toilet).filter(Toilet.is_active == True).all()
        if toilet_id:
            toilets = [t for t in toilets if t.id == toilet_id]
            
        for toilet in toilets:
            # Get last check for this toilet
            last_check = db.query(ToiletCheck)\
                .filter(ToiletCheck.toilet_id == toilet.id)\
                .order_by(desc(ToiletCheck.checked_at))\
                .first()
            
            elapsed_minutes = 0
            if last_check:
                delta = current_dt - last_check.checked_at
                elapsed_minutes = int(delta.total_seconds() / 60)
            else:
                # No check ever? Or just today? 
                # Logic says "from previous check". If no check today, maybe check yesterday?
                # Let's assume "last check ever".
                pass 
                # If no check ever, maybe we should alert if it's been a long time since opening?
                # For simplicity, if no check exists, ignore or treat as very long?
                # Let's ignore for now to avoid noise on fresh install.

            if elapsed_minutes >= 90:
                alerts.append(RealtimeAlert(
                    toilet_name=toilet.name,
                    minutes_elapsed=elapsed_minutes,
                    alert_level="alert"
                ))
            elif elapsed_minutes >= 75:
                alerts.append(RealtimeAlert(
                    toilet_name=toilet.name,
                    minutes_elapsed=elapsed_minutes,
                    alert_level="warning"
                ))

    # 3. Timeline
    timeline = []
    # day_checks is already fetched
    # Sort by time desc
    sorted_checks = sorted(day_checks, key=lambda x: x.checked_at, reverse=True)
    
    for check in sorted_checks:
        # Get thumbnails (first 2 images)
        # We need to fetch images. They should be eager loaded or fetched here.
        # Since we didn't eager load, we access relationship (lazy load).
        # Be careful with N+1. For small N it's fine.
        
        # We need staff icon
        staff_icon = check.staff.icon_code if check.staff else "❓"
        
        # Images
        # We need public URLs for images.
        # Since we save to disk, we need a way to serve them.
        # We will need a StaticFiles mount in main.py.
        # URL format: /static/images/YYYY/MM/DD/{check_id}/{filename}
        
        # But wait, we stored absolute path in DB? Or full path?
        # In checks.py: image_path=file_path (full path)
        # We need to convert full path to URL.
        # Path: /var/data/toilet-images/YYYY/MM/DD/{check_id}/filename
        # URL: /images/YYYY/MM/DD/{check_id}/filename
        
        thumbs = []
        sorted_images = sorted(check.images, key=lambda x: x.order_index)
        for img in sorted_images[:2]: # First 2
            # Extract relative path from /var/data/toilet-images
            # Assuming settings.IMAGE_STORAGE_PATH is /var/data/toilet-images
            # We can just split by 'toilet-images' or similar.
            
            # Robust way:
            rel_path = os.path.relpath(img.image_path, settings.IMAGE_STORAGE_PATH)
            # Replace backslashes if windows (though we are on linux in render, locally windows)
            rel_path = rel_path.replace("\\", "/")
            url = f"/images/{rel_path}"
            thumbs.append(url)

        timeline.append(TimelineItem(
            id=check.id,
            checked_at=check.checked_at,
            staff_icon=staff_icon,
            status_type=check.status_type,
            thumbnails=thumbs
        ))

    return DashboardDayResponse(
        major_checkpoints=checkpoint_statuses,
        realtime_alerts=alerts,
        timeline=timeline
    )
