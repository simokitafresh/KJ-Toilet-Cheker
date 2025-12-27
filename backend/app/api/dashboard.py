from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, and_
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional
from datetime import datetime, date, time, timedelta, timezone
import os
from app.api import deps
from app.core.config import settings
from app.models import ToiletCheck, MajorCheckpoint, Toilet, Staff, CheckImage, ClinicConfig
from app.schemas import (
    DashboardDayResponse, MajorCheckpointStatus, RealtimeAlert, TimelineItem,
    SimpleStatusResponse, ScheduledCheckStatus, RegularCheckStatus, SimpleTimelineItem
)

router = APIRouter()

# JST timezone
JST = timezone(timedelta(hours=9))


def parse_time(time_str: str) -> time:
    """Parse HH:MM string to time object"""
    h, m = map(int, time_str.split(":"))
    return time(h, m)


def to_jst(dt: datetime) -> datetime:
    """datetimeをJSTに変換"""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(JST)


def get_config(db: Session, key: str, default: str) -> str:
    """Get clinic config from DB with fallback to settings"""
    config = db.query(ClinicConfig).filter(ClinicConfig.key == key).first()
    return config.value if config else default


def calculate_scheduled_check_status(
    checks: List[ToiletCheck],
    start_time: time,
    deadline: time,
    now_jst: datetime,
    is_required: bool = True
) -> ScheduledCheckStatus:
    """
    朝チェック・午後チェックの状態を計算
    - 開始時刻から警告（黄色）
    - 期限を過ぎたらアラート（赤）
    - チェック完了したら時刻表示（OK/緑）
    - 開始時刻〜期限内のチェックのみ有効
    """
    time_range = f"{start_time.strftime('%H:%M')}〜{deadline.strftime('%H:%M')}"
    
    # この時間帯内のチェックを探す（開始時刻〜期限内のみ有効）
    matched_check = None
    for check in checks:
        check_jst = to_jst(check.checked_at)
        check_time = check_jst.time()
        # 開始時刻以降 かつ 期限以内 のチェックのみ有効
        if start_time <= check_time <= deadline:
            matched_check = check
            break
    
    if matched_check:
        # チェック完了 → OK（緑）+ 時刻表示
        check_jst = to_jst(matched_check.checked_at)
        check_time_str = check_jst.strftime("%H:%M")
        
        return ScheduledCheckStatus(
            status="ok",
            time=check_time_str,
            deadline=deadline.strftime("%H:%M"),
            time_range=time_range,
            is_required=is_required
        )
    else:
        # 未実施
        now_time = now_jst.time()
        if now_time < start_time:
            # 開始時刻前 → 待機中（グレー）
            status = "pending"
        elif now_time <= deadline:
            # 開始〜期限内 → 警告（黄色）
            status = "warning"
        else:
            # 期限超過 → アラート（赤）
            # ただし不要な場合は待機中のまま（またはdashboard側で「不要」と出すため警告以上にしない）
            if not is_required:
                status = "pending"
            else:
                status = "alert"
        
        return ScheduledCheckStatus(
            status=status,
            time=None,
            deadline=deadline.strftime("%H:%M"),
            time_range=time_range,
            is_required=is_required
        )


def calculate_elapsed_excluding_lunch(last_check_jst: datetime, now_jst: datetime) -> int:
    """
    昼休み (12:00-14:00) を除外した経過時間（分）を計算
    """
    lunch_start = time(12, 0)
    lunch_end = time(14, 0)
    
    total_minutes = 0
    current = last_check_jst
    
    while current < now_jst:
        current_time = current.time()
        
        # 昼休み中の場合はスキップ
        if lunch_start <= current_time < lunch_end:
            # 昼休み終了まで進める
            lunch_end_dt = datetime.combine(current.date(), lunch_end).replace(tzinfo=JST)
            if lunch_end_dt > now_jst:
                break
            current = lunch_end_dt
            continue
        
        # 次の1分を加算
        next_minute = current + timedelta(minutes=1)
        
        # 昼休み開始前で、次の1分が昼休み中なら昼休み開始まで
        if current_time < lunch_start and next_minute.time() >= lunch_start:
            lunch_start_dt = datetime.combine(current.date(), lunch_start).replace(tzinfo=JST)
            minutes_to_lunch = int((lunch_start_dt - current).total_seconds() / 60)
            total_minutes += minutes_to_lunch
            current = lunch_start_dt
            continue
        
        # 通常の1分加算
        if next_minute > now_jst:
            remaining = int((now_jst - current).total_seconds() / 60)
            total_minutes += remaining
            break
        
        total_minutes += 1
        current = next_minute
    
    return total_minutes


def calculate_regular_check_status(
    last_check: Optional[ToiletCheck],
    now_jst: datetime
) -> RegularCheckStatus:
    """
    定期チェックの状態を計算
    """
    regular_start = parse_time(settings.REGULAR_CHECK_START)
    regular_end = parse_time(settings.REGULAR_CHECK_END)
    threshold = settings.REGULAR_CHECK_INTERVAL_MINUTES
    
    now_time = now_jst.time()
    is_active = regular_start <= now_time <= regular_end
    
    if not last_check:
        # チェックなし - 営業開始からの経過時間
        if is_active:
            start_dt = datetime.combine(now_jst.date(), regular_start).replace(tzinfo=JST)
            elapsed = calculate_elapsed_excluding_lunch(start_dt, now_jst)
        else:
            elapsed = 0
    else:
        last_check_jst = to_jst(last_check.checked_at)
        elapsed = calculate_elapsed_excluding_lunch(last_check_jst, now_jst)
    
    # ステータス判定
    if elapsed <= threshold:
        status = "ok"
    elif elapsed <= threshold * 2:
        status = "warning"
    else:
        status = "alert"
    
    return RegularCheckStatus(
        status=status,
        minutes_elapsed=elapsed,
        next_check_in=threshold - elapsed,
        threshold=threshold,
        is_active=is_active
    )

def detect_and_insert_missed_checkpoints(db: Session, target_date: date, now_jst: datetime) -> None:
    """
    時間帯が終了した主要チェックポイントで未実施のものを検出し、
    MISSED_MAJORレコードを自動挿入する
    """
    # 本日のみ処理（過去日は処理しない）
    if target_date != now_jst.date():
        return
    
    # アクティブな主要チェックポイントを取得
    checkpoints = db.query(MajorCheckpoint).filter(MajorCheckpoint.is_active == True).all()
    
    for cp in checkpoints:
        # 時間帯が終了していない場合はスキップ
        if now_jst.time() <= cp.end_time:
            continue
        
        # この時間帯のチェックを検索
        start_dt_jst = datetime.combine(target_date, cp.start_time).replace(tzinfo=JST)
        end_dt_jst = datetime.combine(target_date, cp.end_time).replace(tzinfo=JST)
        
        existing_check = db.query(ToiletCheck).filter(
            and_(
                ToiletCheck.checked_at >= start_dt_jst.astimezone(timezone.utc),
                ToiletCheck.checked_at <= end_dt_jst.astimezone(timezone.utc)
            )
        ).first()
        
        if existing_check:
            continue  # チェック済み
        
        # 既にMISSED_MAJORレコードが挿入されていないか確認
        existing_missed = db.query(ToiletCheck).filter(
            func.date(ToiletCheck.checked_at) == target_date,
            ToiletCheck.major_checkpoint_id == cp.id,
            ToiletCheck.status_type == "MISSED_MAJOR"
        ).first()
        
        if existing_missed:
            continue  # 既に挿入済み
        
        # MISSED_MAJORレコードを挿入
        # トイレIDはチェックポイントのtarget_toilet_idを使用、なければデフォルト1
        toilet_id = cp.target_toilet_id or 1
        
        missed_check = ToiletCheck(
            toilet_id=toilet_id,
            staff_id=None,  # スタッフなし
            major_checkpoint_id=cp.id,
            checked_at=end_dt_jst.astimezone(timezone.utc),  # 時間帯終了時刻
            status_type="MISSED_MAJOR"
        )
        db.add(missed_check)
    
    db.commit()


@router.get("/simple-status", response_model=SimpleStatusResponse)
def get_simple_status(
    date_str: Optional[str] = None,  # YYYY-MM-DD format, defaults to today
    db: Session = Depends(deps.get_db)
):
    """
    シンプルなアラート状態を返す（トイレ1つ前提）
    date_str: 対象日付（省略時は今日）
    """
    now_utc = datetime.now(timezone.utc)
    now_jst = now_utc.astimezone(JST)

    # 対象日付を決定
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        target_date = now_jst.date()
    
    is_today = target_date == now_jst.date()
    is_future = target_date > now_jst.date()
    
    # 未来の日付は許可しない
    if is_future:
        raise HTTPException(status_code=400, detail="Future dates are not allowed")
    
    # 未実施チェックポイントを検出・挿入（今日のみ）
    if is_today:
        detect_and_insert_missed_checkpoints(db, target_date, now_jst)
    
    # 対象日の開始と終了（JST）をUTCに変換して範囲指定で取得
    start_jst = datetime.combine(target_date, time.min).replace(tzinfo=JST)
    end_jst = start_jst + timedelta(days=1)
    
    # 対象日のチェックを取得（MISSED_MAJOR含む）
    day_checks = db.query(ToiletCheck).options(
        joinedload(ToiletCheck.staff),
        joinedload(ToiletCheck.major_checkpoint),
        selectinload(ToiletCheck.images)
    ).filter(
        and_(
            ToiletCheck.checked_at >= start_jst.astimezone(timezone.utc),
            ToiletCheck.checked_at < end_jst.astimezone(timezone.utc)
        )
    ).order_by(ToiletCheck.checked_at).all()
    
    # 通常チェックのみ抽出（状態判定用）
    normal_checks = [c for c in day_checks if c.status_type != "MISSED_MAJOR"]
    
    # 時刻設定を取得
    morning_start = parse_time(settings.MORNING_CHECK_START)
    morning_deadline = parse_time(settings.MORNING_CHECK_DEADLINE)
    afternoon_start = parse_time(settings.AFTERNOON_CHECK_START)
    afternoon_deadline = parse_time(settings.AFTERNOON_CHECK_DEADLINE)
    
    # 朝チェック判定（8:00〜8:50のチェックのみ対象）
    morning_checks = [c for c in normal_checks 
                      if morning_start <= to_jst(c.checked_at).time() <= morning_deadline]
    
    # 過去日の場合は「1日の終わり」として判定
    if is_today:
        reference_jst = now_jst
    else:
        # 過去日：その日の23:59として判定
        reference_jst = datetime.combine(target_date, time(23, 59)).replace(tzinfo=JST)
    
    morning_status = calculate_scheduled_check_status(
        morning_checks, morning_start, morning_deadline, reference_jst
    )
    
    # 午後チェック判定（14:00〜14:50のチェックのみ対象）
    afternoon_checks = [c for c in normal_checks 
                        if afternoon_start <= to_jst(c.checked_at).time() <= afternoon_deadline]
    
    # 午後チェックが不要な曜日か判定
    def is_afternoon_skip_day(target: date) -> bool:
        skip_days_str = get_config(db, "afternoon_check_skip_days", "").strip()
        if not skip_days_str:
            return False
        try:
            skip_days = [int(d.strip()) for d in skip_days_str.split(",")]
            return target.weekday() in skip_days
        except ValueError:
            return False

    is_afternoon_required = not is_afternoon_skip_day(target_date)

    afternoon_status = calculate_scheduled_check_status(
        afternoon_checks, afternoon_start, afternoon_deadline, reference_jst, 
        is_required=is_afternoon_required
    )
    
    # 定期チェック判定（通常チェックのみ）
    last_check = normal_checks[-1] if normal_checks else None
    if is_today:
        regular_status = calculate_regular_check_status(last_check, now_jst)
    else:
        # 過去日：定期チェックは非アクティブ
        regular_status = RegularCheckStatus(
            status="ok",
            minutes_elapsed=0,
            next_check_in=0,
            threshold=settings.REGULAR_CHECK_INTERVAL_MINUTES,
            is_active=False
        )
    
    # タイムライン作成（新しい順、MISSED_MAJOR含む）
    timeline = []
    for check in reversed(day_checks):
        check_jst = to_jst(check.checked_at)
        
        # MISSED_MAJORの場合は特別表示
        if check.status_type == "MISSED_MAJOR":
            cp_name = check.major_checkpoint.name if check.major_checkpoint else "チェック"
            staff_icon = "⚠️"
            display_time = f"{check_jst.strftime('%H:%M')} {cp_name}未"
        else:
            staff_icon = check.staff.icon_code if check.staff else "❓"
            display_time = check_jst.strftime("%H:%M")
        
        # Generate thumbnail URLs
        thumbs = []
        sorted_images = sorted(check.images, key=lambda x: x.order_index)
        for img in sorted_images[:2]:  # First 2 images
            rel_path = os.path.relpath(img.image_path, settings.IMAGE_STORAGE_PATH)
            rel_path = rel_path.replace("\\", "/")
            url = f"/images/{rel_path}"
            thumbs.append(url)
        
        timeline.append(SimpleTimelineItem(
            check_id=check.id,
            time=display_time,
            staff_icon=staff_icon,
            thumbnails=thumbs,
            is_missed=(check.status_type == "MISSED_MAJOR")
        ))
    
    # 最終チェック時刻（通常チェックのみ）
    last_check_at = None
    if last_check:
        last_check_at = to_jst(last_check.checked_at).isoformat()
    
    # 過去日のcurrent_timeは空
    display_time = now_jst.strftime("%H:%M") if is_today else ""
    
    
    # F003: 休診日判定
    def is_closed_day(target: date) -> bool:
        closed_days_str = get_config(db, "closed_days", settings.CLOSED_DAYS).strip()
        if not closed_days_str:
            return False
        try:
            closed_days = [int(d.strip()) for d in closed_days_str.split(",")]
            # Pythonのweekday()は 0=月曜, 6=日曜
            return target.weekday() in closed_days
        except ValueError:
            return False
    
    is_closed = is_closed_day(target_date)
    
    # F004: 診療時間外判定
    def get_business_hours_status(now: datetime, target: date) -> tuple:
        """Returns (is_outside_hours, message)"""
        # 過去日は診療時間内扱い
        if target != now.date():
            return False, None
        
        start_str = get_config(db, "business_hours_start", settings.BUSINESS_HOURS_START)
        end_str = get_config(db, "business_hours_end", settings.BUSINESS_HOURS_END)
        start = parse_time(start_str)
        end = parse_time(end_str)
        current = now.time()
        
        if current < start:
            # 朝（診療開始前）
            return True, f"☀️ おはようございます！今日もよろしくお願いします！ 診療開始: {start_str}"
        elif current > end:
            # 夜（診療終了後）
            return True, f"🌙 お疲れさまでした！ゆっくりお休みください 診療時間: {start_str}〜{end_str}"
        else:
            return False, None
    
    is_outside_hours, business_message = get_business_hours_status(now_jst, target_date)
    
    return SimpleStatusResponse(
        date=target_date.isoformat(),
        current_time=display_time,
        morning_check=morning_status,
        afternoon_check=afternoon_status,
        regular_check=regular_status,
        last_check_at=last_check_at,
        timeline=timeline,
        is_closed=is_closed,
        is_outside_hours=is_outside_hours,
        business_message=business_message
    )


def get_business_hours_status_logic(now_jst: datetime, target_date: date, db: Session) -> tuple:
    """Returns (is_outside_hours, message) - helper for other endpoints if needed"""
    # ... actually I'll just fix the existing one inside get_simple_status
    pass


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
    
    # 対象日の開始と終了（JST）をUTCに変換して範囲指定で取得
    start_jst = datetime.combine(target_date, time.min).replace(tzinfo=JST)
    end_jst = start_jst + timedelta(days=1)

    # Get all checks for the day within the JST range
    day_checks_query = db.query(ToiletCheck).options(
        joinedload(ToiletCheck.staff),
        selectinload(ToiletCheck.images)
    ).filter(
        and_(
            ToiletCheck.checked_at >= start_jst.astimezone(timezone.utc),
            ToiletCheck.checked_at < end_jst.astimezone(timezone.utc)
        )
    )
    if toilet_id:
        day_checks_query = day_checks_query.filter(ToiletCheck.toilet_id == toilet_id)
    day_checks = day_checks_query.all()

    current_dt = datetime.now(timezone.utc)
    is_today = target_date == current_dt.date()

    # current_dt is already defined above? No, wait. 
    # Use global JST defined at the top

    for cp in major_checkpoints:
        # Filter checks within this checkpoint's time window
        # Note: This simple logic assumes time window is within the same day
        
        # Convert time to datetime for comparison (Assume CP times are JST)
        start_dt = datetime.combine(target_date, cp.start_time).replace(tzinfo=JST)
        end_dt = datetime.combine(target_date, cp.end_time).replace(tzinfo=JST)
        
        matched_check = None
        for check in day_checks:
            # Check if check is within window
            if cp.target_toilet_id and cp.target_toilet_id != check.toilet_id:
                continue
            
            # Ensure check.checked_at is aware (UTC)
            check_at = check.checked_at
            if check_at.tzinfo is None:
                check_at = check_at.replace(tzinfo=timezone.utc)
            
            if start_dt <= check_at <= end_dt:
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
                last_at = last_check.checked_at
                if last_at.tzinfo is None:
                    last_at = last_at.replace(tzinfo=timezone.utc)
                delta = current_dt - last_at
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
