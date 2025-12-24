import sys
import os
from datetime import datetime, time, timezone, timedelta

# Add app directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.api.dashboard import calculate_scheduled_check_status, JST

def test_skip_afternoon_logic():
    print("Testing Skip Afternoon Logic...")
    
    start_time = time(14, 0)
    deadline = time(14, 50)
    
    # 1. Required and passed deadline -> should be alert
    now_jst = datetime.combine(datetime.now().date(), time(15, 0)).replace(tzinfo=JST)
    status_required = calculate_scheduled_check_status(
        checks=[],
        start_time=start_time,
        deadline=deadline,
        now_jst=now_jst,
        is_required=True
    )
    print(f"Required (passed deadline): {status_required.status} (expected: alert)")
    assert status_required.status == "alert"
    
    # 2. Not required and passed deadline -> should be pending (no alert)
    status_not_required = calculate_scheduled_check_status(
        checks=[],
        start_time=start_time,
        deadline=deadline,
        now_jst=now_jst,
        is_required=False
    )
    print(f"Not Required (passed deadline): {status_not_required.status} (expected: pending)")
    assert status_not_required.status == "pending"
    assert status_not_required.is_required == False

    # 3. Not required and checked -> should be ok
    # Create a mock check and pass it (this is simplified as we're not using real DB objects here, 
    # but the logic in dashboard.py uses to_jst(check.checked_at))
    class MockCheck:
        def __init__(self, checked_at):
            self.checked_at = checked_at

    check_at = datetime.combine(datetime.now().date(), time(14, 30)).replace(tzinfo=JST)
    status_checked = calculate_scheduled_check_status(
        checks=[MockCheck(check_at)],
        start_time=start_time,
        deadline=deadline,
        now_jst=now_jst,
        is_required=False
    )
    print(f"Not Required (checked): {status_checked.status} (expected: ok)")
    assert status_checked.status == "ok"
    assert status_checked.is_required == False

    print("Verification Successful!")

if __name__ == "__main__":
    test_skip_afternoon_logic()
