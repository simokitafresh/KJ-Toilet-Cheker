"""
テスト: 朝チェック・午後チェックの判定ロジック

rule.md に基づくテストケース:
- 朝チェック: 8:00〜8:50 のみ有効
- 午後チェック: 14:00〜14:50 のみ有効
- 期限外のチェックは無効
"""

import pytest
from datetime import datetime, time, timezone, timedelta
from unittest.mock import MagicMock

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.api.dashboard import calculate_scheduled_check_status, to_jst

# JST timezone
JST = timezone(timedelta(hours=9))


def create_mock_check(hour: int, minute: int, day: int = 19, month: int = 12, year: int = 2025):
    """モックのToiletCheckオブジェクトを作成"""
    mock = MagicMock()
    # JSTの時刻をUTCに変換して設定
    jst_dt = datetime(year, month, day, hour, minute, tzinfo=JST)
    utc_dt = jst_dt.astimezone(timezone.utc)
    mock.checked_at = utc_dt.replace(tzinfo=None)  # naive UTCとして保存
    return mock


class TestMorningCheck:
    """朝チェック判定のテスト"""
    
    morning_start = time(8, 0)
    morning_deadline = time(8, 50)
    
    def test_check_at_0810_should_be_ok(self):
        """8:10にチェック → OK"""
        checks = [create_mock_check(8, 10)]
        now_jst = datetime(2025, 12, 19, 9, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.morning_start, self.morning_deadline, now_jst
        )
        
        assert result.status == "ok"
        assert result.time == "08:10"
    
    def test_check_at_0800_should_be_ok(self):
        """8:00ちょうどにチェック → OK（境界値）"""
        checks = [create_mock_check(8, 0)]
        now_jst = datetime(2025, 12, 19, 9, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.morning_start, self.morning_deadline, now_jst
        )
        
        assert result.status == "ok"
        assert result.time == "08:00"
    
    def test_check_at_0850_should_be_ok(self):
        """8:50ちょうどにチェック → OK（境界値）"""
        checks = [create_mock_check(8, 50)]
        now_jst = datetime(2025, 12, 19, 9, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.morning_start, self.morning_deadline, now_jst
        )
        
        assert result.status == "ok"
        assert result.time == "08:50"
    
    def test_check_at_0851_should_not_count(self):
        """8:51にチェック → 朝チェックとして無効（期限超過）"""
        checks = [create_mock_check(8, 51)]
        now_jst = datetime(2025, 12, 19, 9, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.morning_start, self.morning_deadline, now_jst
        )
        
        # 期限超過後のチェックは無効なので、alertになるべき
        assert result.status == "alert"
        assert result.time is None
    
    def test_check_at_0745_should_not_count(self):
        """7:45にチェック → 朝チェックとして無効（開始前）"""
        checks = [create_mock_check(7, 45)]
        now_jst = datetime(2025, 12, 19, 9, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.morning_start, self.morning_deadline, now_jst
        )
        
        # 開始前のチェックは無効なので、alertになるべき
        assert result.status == "alert"
        assert result.time is None
    
    def test_no_check_before_start_should_be_pending(self):
        """7:30時点でチェックなし → pending（待機中）"""
        checks = []
        now_jst = datetime(2025, 12, 19, 7, 30, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.morning_start, self.morning_deadline, now_jst
        )
        
        assert result.status == "pending"
    
    def test_no_check_during_window_should_be_warning(self):
        """8:30時点でチェックなし → warning（警告）"""
        checks = []
        now_jst = datetime(2025, 12, 19, 8, 30, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.morning_start, self.morning_deadline, now_jst
        )
        
        assert result.status == "warning"
    
    def test_no_check_after_deadline_should_be_alert(self):
        """9:00時点でチェックなし → alert（アラート）"""
        checks = []
        now_jst = datetime(2025, 12, 19, 9, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.morning_start, self.morning_deadline, now_jst
        )
        
        assert result.status == "alert"


class TestAfternoonCheck:
    """午後チェック判定のテスト"""
    
    afternoon_start = time(14, 0)
    afternoon_deadline = time(14, 50)
    
    def test_check_at_1410_should_be_ok(self):
        """14:10にチェック → OK"""
        checks = [create_mock_check(14, 10)]
        now_jst = datetime(2025, 12, 19, 15, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.afternoon_start, self.afternoon_deadline, now_jst
        )
        
        assert result.status == "ok"
        assert result.time == "14:10"
    
    def test_check_at_1400_should_be_ok(self):
        """14:00ちょうどにチェック → OK（境界値）"""
        checks = [create_mock_check(14, 0)]
        now_jst = datetime(2025, 12, 19, 15, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.afternoon_start, self.afternoon_deadline, now_jst
        )
        
        assert result.status == "ok"
        assert result.time == "14:00"
    
    def test_check_at_1450_should_be_ok(self):
        """14:50ちょうどにチェック → OK（境界値）"""
        checks = [create_mock_check(14, 50)]
        now_jst = datetime(2025, 12, 19, 15, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.afternoon_start, self.afternoon_deadline, now_jst
        )
        
        assert result.status == "ok"
        assert result.time == "14:50"
    
    def test_check_at_1451_should_not_count(self):
        """14:51にチェック → 午後チェックとして無効（期限超過）"""
        checks = [create_mock_check(14, 51)]
        now_jst = datetime(2025, 12, 19, 15, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.afternoon_start, self.afternoon_deadline, now_jst
        )
        
        # 期限超過後のチェックは無効なので、alertになるべき
        assert result.status == "alert"
        assert result.time is None
    
    def test_check_at_1700_should_not_count(self):
        """17:00にチェック → 午後チェックとして無効"""
        checks = [create_mock_check(17, 0)]
        now_jst = datetime(2025, 12, 19, 18, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, self.afternoon_start, self.afternoon_deadline, now_jst
        )
        
        # 期限超過後のチェックは無効
        assert result.status == "alert"
        assert result.time is None


class TestTimeRange:
    """time_rangeの確認"""
    
    def test_time_range_format(self):
        """time_rangeが正しいフォーマットで返される"""
        checks = []
        now_jst = datetime(2025, 12, 19, 7, 0, tzinfo=JST)
        
        result = calculate_scheduled_check_status(
            checks, time(8, 0), time(8, 50), now_jst
        )
        
        assert result.time_range == "08:00〜08:50"
