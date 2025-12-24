import pytest
from datetime import datetime, timezone, timedelta, time
from app.models import ToiletCheck, Toilet, Staff, ClinicConfig
from app.core.config import settings

JST = timezone(timedelta(hours=9))

def test_reproduce_timezone_misalignment(client, db):
    # 1. Setup data
    toilet = Toilet(name="Test Toilet")
    staff = Staff(internal_name="Test Staff", icon_code="🐶")
    db.add(toilet)
    db.add(staff)
    db.commit()

    # 2. Record a check at 2025-12-25 03:00 JST
    # UTC: 2025-12-24 18:00:00
    check_time_jst = datetime(2025, 12, 25, 3, 0, 0, tzinfo=JST)
    check_time_utc = check_time_jst.astimezone(timezone.utc)
    
    check = ToiletCheck(
        toilet_id=toilet.id,
        staff_id=staff.id,
        checked_at=check_time_utc,
        status_type="NORMAL"
    )
    db.add(check)
    db.commit()

    # 3. Query dashboard for 2025-12-25
    response = client.get("/api/dashboard/simple-status?date_str=2025-12-25")
    assert response.status_code == 200
    data = response.json()
    
    # EXPECTATION: The check should be in the timeline
    assert len(data["timeline"]) > 0, f"Check at {check_time_jst} (JST) should be visible on 2025-12-25 dashboard"

def test_reproduce_weekday_indexing(client, db):
    # Setup clinic config: closed_days = "6" (Sunday in Python 0=Monday, 6=Sunday system)
    config = ClinicConfig(key="closed_days", value="6")
    db.add(config)
    db.commit()

    # 2024-12-22 is Sunday.
    # Python's target.weekday() for Sunday is 6.
    
    response = client.get("/api/dashboard/simple-status?date_str=2024-12-22")
    assert response.status_code == 200
    data = response.json()
    
    # EXPECTATION: is_closed should be True because Sunday (6) is in closed_days
    assert data["is_closed"] is True, "2024-12-22 (Sunday) should be detected as closed if closed_days='6'"
