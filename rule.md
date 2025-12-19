# トイレチェック判定ルール

## 朝チェック

### 現在の実装（✅ 実装済み: 2025-12-19）
- 対象時間: **8:00〜8:50** のチェックのみ朝チェックとして認識
- 8:51以降にチェックしても朝チェックとしては**無効**
- 期限超過時はダッシュボードに「朝チェックなし」（🔴アラート）を表示

### 変更前の問題
- 対象時間: 8:00〜14:00 のチェックが朝チェックとして認識されていた
- 期限超過後（8:51以降）にチェックしてもOK扱いになっていた
- ダッシュボードに「朝チェックなし」が正しく表示されなかった

### WHY（なぜ変更が必要か）
- 朝の清掃確認は診療開始前に完了している必要がある
- 時間を過ぎてからのチェックは朝チェックとしての意味がない
- 正確な運用状況の把握と管理のため

### WHAT（何を変更するか）
1. 朝チェック対象の時間帯を `8:00〜14:00` → `8:00〜8:50` に限定
2. 期限（8:50）を過ぎたチェックは朝チェックとしてカウントしない
3. 期限超過後も未チェックの場合はアラート状態を維持

### HOW（どう実装するか）
```python
# backend/app/api/dashboard.py

# 朝チェック判定（8:00〜8:50のチェックのみ対象）
morning_checks = [c for c in normal_checks 
                  if morning_start <= to_jst(c.checked_at).time() <= morning_deadline]

# calculate_scheduled_check_status関数内
# 開始時刻以降 かつ 期限以内 のチェックのみ有効
if start_time <= check_time <= deadline:
    matched_check = check
```

---

## 午後チェック

### 現在の実装（✅ 実装済み: 2025-12-19）
- 対象時間: **14:00〜14:50** のチェックのみ午後チェックとして認識
- 14:51以降にチェックしても午後チェックとしては**無効**
- 期限超過時はダッシュボードに「午後チェックなし」（🔴アラート）を表示

### 変更前の問題
- 対象時間: 14:00以降のすべてのチェックが午後チェックとして認識されていた
- 時間制限がなく、夕方以降のチェックも午後チェック扱いだった

### WHY（なぜ変更が必要か）
- 午後の清掃確認は午後の診療が本格化する前に完了している必要がある
- 遅い時間のチェックは午後チェックとしての意味がない
- 正確な運用状況の把握と管理のため

### WHAT（何を変更するか）
1. 午後チェック対象の時間帯を `14:00〜` → `14:00〜14:50` に限定
2. 期限（14:50）を過ぎたチェックは午後チェックとしてカウントしない
3. 期限超過後も未チェックの場合はアラート状態を維持

### HOW（どう実装するか）
```python
# backend/app/api/dashboard.py

# 午後チェック判定（14:00〜14:50のチェックのみ対象）
afternoon_checks = [c for c in normal_checks 
                    if afternoon_start <= to_jst(c.checked_at).time() <= afternoon_deadline]

# calculate_scheduled_check_status関数内
# 開始時刻以降 かつ 期限以内 のチェックのみ有効
if start_time <= check_time <= deadline:
    matched_check = check
```

---

## 判定結果の表示

| ステータス | 条件 | ダッシュボード表示 |
|-----------|------|------------------|
| 待機中（グレー） | 現在時刻 < 開始時刻 | 時間帯表示のみ |
| 警告（黄色） | 開始時刻 ≤ 現在時刻 ≤ 期限 & 未チェック | ⚠️ 未実施 |
| アラート（赤） | 現在時刻 > 期限 & 未チェック | 🔴 チェックなし |
| OK（緑） | 時間帯内にチェック完了 | ✅ HH:MM |

---

## 設定値

| 項目 | 開始時刻 | 期限 |
|------|---------|------|
| 朝チェック | 08:00 | 08:50 |
| 午後チェック | 14:00 | 14:50 |

※ 設定値は `backend/app/core/config.py` で管理

---

## 稼働時間設定

### ASIS（現状）
- 管理画面（設定タブ）で診療時間の開始・終了を設定可能
- 設定値は `HH:MM` 形式の文字列として `ClinicConfig` テーブルに保存
- バックエンドでJST変換済みの現在時刻と比較

### TOBE（あるべき姿）
- 現状維持（正しく動作している）

### WHY（なぜ正しく動作しているか）
1. 時刻は純粋な文字列（`"07:00"`）として保存され、タイムゾーン情報を持たない
2. バックエンドで `to_jst()` により現在時刻をJSTに変換してから比較
3. 比較は `time` オブジェクト同士で行われるため、タイムゾーンの影響を受けない

### WHAT（処理の流れ）
1. フロントエンド: `<input type="time">` で `"07:00"` を入力
2. API: `POST /api/admin/settings?key=business_hours_start` で保存
3. DB: `ClinicConfig(key="business_hours_start", value="07:00")`
4. 使用時: `parse_time("07:00")` → `time(7, 0)` に変換
5. 比較: `now_jst.time()` と比較（JST変換済み）

### HOW（実装箇所）
```python
# backend/app/api/dashboard.py

def get_business_hours_status(now: datetime, target: date) -> tuple:
    start_str = get_config("business_hours_start", settings.BUSINESS_HOURS_START)
    end_str = get_config("business_hours_end", settings.BUSINESS_HOURS_END)
    start = parse_time(start_str)   # time(7, 0)
    end = parse_time(end_str)       # time(22, 0)
    current = now.time()            # now は now_jst（JST変換済み）
    
    if current < start:
        return True, "☀️ おはよう..."  # 診療開始前
    elif current > end:
        return True, "🌙 お疲れさま..."  # 診療終了後
```

---

## 稼働曜日設定（休診日）

### ASIS（現状）
- 管理画面で休診曜日をボタンで選択
- 曜日番号をカンマ区切り文字列として保存（例: `"0,6"`）
- `config.py` のコメントに誤記あり（`0=Sunday` → 実際は `0=Monday`）

### TOBE（あるべき姿）
- 現状維持（正しく動作している）
- コメントの誤記を修正すべき

### WHY（なぜ正しく動作しているか）
フロントエンドとバックエンドで曜日番号が一致している：

| 曜日 | フロントエンド（配列index） | Python `weekday()` |
|------|---------------------------|-------------------|
| 月曜日 | 0 | 0 |
| 火曜日 | 1 | 1 |
| 水曜日 | 2 | 2 |
| 木曜日 | 3 | 3 |
| 金曜日 | 4 | 4 |
| 土曜日 | 5 | 5 |
| 日曜日 | 6 | 6 |

### WHAT（処理の流れ）
1. フロントエンド: `['月', '火', '水', '木', '金', '土', '日']` の index で曜日を管理
2. 保存: `closedDays.join(',')` → `"5,6"`（土日休診の場合）
3. バックエンド: `target.weekday() in closed_days` で判定

### HOW（実装箇所）
```tsx
// frontend/app/admin/page.tsx
{['月', '火', '水', '木', '金', '土', '日'].map((name, idx) => (
    <button onClick={() => toggleClosedDay(idx)} ...>
        {name}
    </button>
))}
```

```python
# backend/app/api/dashboard.py
def is_closed_day(target: date) -> bool:
    closed_days_str = get_config("closed_days", settings.CLOSED_DAYS).strip()
    closed_days = [int(d.strip()) for d in closed_days_str.split(",")]
    return target.weekday() in closed_days  # 0=月曜, 6=日曜
```

---

## 注意事項

### config.py のコメント（✅ 修正済み: 2025-12-19）

```python
# 修正後（正しい）
CLOSED_DAYS: str = "0"  # 0=Monday, 6=Sunday
```

**現在の設定**: `"0"` は**月曜日**が休診日として扱われる。
日曜日を休診日にしたい場合は `"6"` に変更が必要。

---

## テスト

テストファイル: `backend/tests/test_scheduled_check.py`

```bash
cd backend
python -m pytest tests/test_scheduled_check.py -v
```

### テストケース（14件）

| テスト | 期待結果 |
|-------|---------|
| 8:00にチェック | ✅ OK |
| 8:10にチェック | ✅ OK |
| 8:50にチェック | ✅ OK（境界値） |
| 8:51にチェック | 🔴 無効（アラート継続） |
| 7:45にチェック | 🔴 無効（時間帯前） |
| 14:00にチェック | ✅ OK |
| 14:10にチェック | ✅ OK |
| 14:50にチェック | ✅ OK（境界値） |
| 14:51にチェック | 🔴 無効（アラート継続） |
| 17:00にチェック | 🔴 無効（アラート継続） |
