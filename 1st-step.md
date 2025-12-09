# 1st Step: 新アラートシステム実装プラン

## 概要

トイレチェックのダッシュボードをシンプル化し、時間ベースの🟢〇/🟡△/🔴×アラートシステムを実装する。
**既存のMajorCheckpointテーブル・RealtimeAlertは廃止し、新システムに置き換える。**

## 前提条件

- **トイレ**: 1つのみを想定
- **営業時間**: 8:00〜21:00
- **昼休み**: 12:00〜14:00（定期チェック判定を一時停止）

## 目標

- **一目で状況がわかる**シンプルなダッシュボード
- 時間ベースの自動判定（朝8:50、午後14:50、1時間ごと）
- 不要な情報を削減し、必要な情報のみ表示

---

## チェックルール詳細

### 時間帯定義

| チェック種別 | 開始時刻 | 期限 | 説明 |
|-------------|---------|------|------|
| **朝チェック** | 8:00 | 8:50 | 開院前の清掃確認 |
| **午後チェック** | 14:00 | 14:50 | 午後開院前の清掃確認 |
| **定期チェック** | 8:50 | 21:00 | 約1時間ごとの定期確認 |

### 判定ロジック

#### 朝チェック (8:00〜8:50)
| 状態 | 条件 | 表示 |
|------|------|------|
| ⏳ 待機中 | 8:00より前 | `⏳ 待機中` |
| 🟡 Warning | 8:00〜8:50（未チェック時） | `🟡 警告` |
| 🔴 Alert | 8:50以降（未チェック時） | `🔴 未` |
| 🟢 OK | チェック完了（時刻問わず） | `🟢 8:55` |

#### 午後チェック (14:00〜14:50)
| 状態 | 条件 | 表示 |
|------|------|------|
| ⏳ 待機中 | 14:00より前 | `⏳ 待機中` |
| 🟡 Warning | 14:00〜14:50（未チェック時） | `🟡 警告` |
| 🔴 Alert | 14:50以降（未チェック時） | `🔴 未` |
| 🟢 OK | チェック完了（時刻問わず） | `🟢 14:55` |

**ポイント**:
- 開始時刻（8:00/14:00）から黄色警告でスタート
- 期限（8:50/14:50）を過ぎると赤アラート
- チェック完了すれば、期限後でも緑OK＋時刻表示

#### 定期チェック (8:50〜21:00)
| 状態 | 条件 | 表示 |
|------|------|------|
| 🟢 OK | 前回から60分以内 | `🟢 前回から45分` |
| 🟡 Warning | 前回から60〜120分 | `🟡 前回から75分` |
| 🔴 Alert | 前回から120分以上 | `🔴 前回から130分` |

**定期チェックの特別ルール**:
- 起点: 8:50（朝チェック期限後）
- 昼休み (12:00〜14:00): 経過時間カウントを一時停止
- 終了: 21:00以降は判定しない（翌日リセット）

---

## 実装タスク

### Phase 1: バックエンド（API変更）

#### 1.1 既存機能の廃止
- `MajorCheckpoint`テーブル → 使用停止（データは残す）
- 既存の`/dashboard/day`エンドポイント → 新エンドポイントに置き換え

#### 1.2 新エンドポイント追加
**ファイル**: `backend/app/api/dashboard.py`

```python
@router.get("/simple-status")
def get_simple_status(db: Session = Depends(get_db)):
    """
    シンプルなアラート状態を返す（トイレ1つ前提）
    """
```

**レスポンス形式**:
```json
{
    "date": "2025-12-09",
    "current_time": "10:30",
    "morning_check": {
        "status": "ok",
        "time": "08:45",
        "deadline": "08:50",
        "time_range": "08:00〜08:50"
    },
    "afternoon_check": {
        "status": "pending",
        "time": null,
        "deadline": "14:50",
        "time_range": "14:00〜14:50"
    },
    "regular_check": {
        "status": "warning",
        "minutes_elapsed": 75,
        "next_check_in": -15,
        "threshold": 60,
        "is_active": true
    },
    "last_check_at": "2025-12-09T09:15:00+09:00"
}
```

#### 1.3 判定ロジック実装

```python
def calculate_status(deadline: time, check_time: datetime | None, now: datetime) -> str:
    """
    deadline: 期限時刻
    check_time: 実際のチェック時刻（None=未実施）
    now: 現在時刻
    """
    warning_limit = deadline + timedelta(hours=1)
    
    if check_time:
        if check_time.time() <= deadline:
            return "ok"
        elif check_time.time() <= warning_limit:
            return "warning"
        else:
            return "alert"
    else:
        # 未実施
        if now.time() < deadline:
            return "pending"
        elif now.time() < warning_limit:
            return "warning"
        else:
            return "alert"

def calculate_regular_status(last_check: datetime, now: datetime) -> dict:
    """
    定期チェックの状態を計算（昼休み考慮）
    """
    # 昼休み時間を除外して経過時間を計算
    elapsed = calculate_elapsed_excluding_lunch(last_check, now)
    
    if elapsed <= 60:
        status = "ok"
    elif elapsed <= 120:
        status = "warning"
    else:
        status = "alert"
    
    return {
        "status": status,
        "minutes_elapsed": elapsed,
        "next_check_in": 60 - elapsed,  # マイナス=超過
        "threshold": 60,
        "is_active": time(8, 50) <= now.time() <= time(21, 0)
    }
```

#### 1.4 設定追加
**ファイル**: `backend/app/core/config.py`

```python
# 新アラートシステム設定
MORNING_CHECK_START = "08:00"
MORNING_CHECK_DEADLINE = "08:50"
AFTERNOON_CHECK_START = "14:00"
AFTERNOON_CHECK_DEADLINE = "14:50"
REGULAR_CHECK_START = "08:50"
REGULAR_CHECK_END = "21:00"
REGULAR_CHECK_INTERVAL_MINUTES = 60
LUNCH_BREAK_START = "12:00"
LUNCH_BREAK_END = "14:00"
```

---

### Phase 2: フロントエンド（新ダッシュボード）

#### 2.1 型定義追加
**ファイル**: `frontend/lib/types.ts`

```typescript
export interface SimpleStatus {
  date: string;
  current_time: string;
  morning_check: ScheduledCheckStatus;
  afternoon_check: ScheduledCheckStatus;
  regular_check: RegularCheckStatus;
  last_check_at: string | null;
}

export interface ScheduledCheckStatus {
  status: 'pending' | 'ok' | 'warning' | 'alert';
  time: string | null;
  deadline: string;
  time_range: string;
}

export interface RegularCheckStatus {
  status: 'ok' | 'warning' | 'alert';
  minutes_elapsed: number;
  next_check_in: number;
  threshold: number;
  is_active: boolean;
}
```

#### 2.2 API関数追加
**ファイル**: `frontend/lib/api.ts`

```typescript
async getSimpleStatus(): Promise<SimpleStatus> {
  const res = await fetch(`${API_BASE}/dashboard/simple-status`);
  return res.json();
}
```

#### 2.3 新ダッシュボードページ
**ファイル**: `frontend/app/dashboard/page.tsx`（既存を置き換え）

---

## 画面デザイン詳細

### カラーパレット

| 状態 | 背景色 | ボーダー | アイコン |
|------|--------|---------|---------|
| 🟢 OK | `bg-emerald-50` | `border-emerald-300` | `text-emerald-600` |
| 🟡 Warning | `bg-amber-50` | `border-amber-300` | `text-amber-600` |
| 🔴 Alert | `bg-red-50` | `border-red-300` | `text-red-600` |
| ⏳ Pending | `bg-slate-50` | `border-slate-200` | `text-slate-400` |

### 画面レイアウト（横3列 + 履歴）

```
┌──────────────────────────────────────────────────────────────────┐
│  トイレチェック                                       10:30現在  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  朝 〜8:50   │  │ 午後 〜14:50 │  │    定期      │           │
│  │              │  │              │  │              │           │
│  │     🟢      │  │     ⏳      │  │     🟡      │           │
│  │    8:45     │  │    待機中    │  │   75分経過   │           │
│  │              │  │              │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  本日のチェック履歴                                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   時刻      担当                                                 │
│  ─────────────────                                               │
│   09:15    🧑                                                    │
│   08:45    👩                                                    │
│   ...                                                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### アラートボックス（横3列）

#### 基本構造
```
┌──────────────┐
│  ラベル      │  ← 小さめ (text-xs, slate-500)
│              │
│     🟢      │  ← 大アイコン (32px)
│    8:45     │  ← メイン情報 (text-lg, bold)
│              │
└──────────────┘
```

#### 各状態の表示

| 状態 | 朝チェック | 午後チェック | 定期チェック |
|------|-----------|-------------|-------------|
| OK | `🟢 8:45` | `🟢 14:40` | `🟢 45分` |
| Warning | `🟡 9:15` | `🟡 15:20` | `🟡 75分` |
| Alert | `🔴 未` | `🔴 未` | `🔴 130分` |
| Pending | `⏳ 待機中` | `⏳ 待機中` | - |

### 履歴テーブル（下部）

```
┌────────────────────────────────────────┐
│  本日のチェック履歴                    │
├────────┬───────────────────────────────┤
│  時刻  │  担当                         │
├────────┼───────────────────────────────┤
│  09:15 │  🧑                           │
│  08:45 │  👩                           │
│  08:00 │  🧔                           │
└────────┴───────────────────────────────┘
```

### コンポーネント構成

```tsx
// ページ構成
<div className="min-h-screen bg-slate-50 p-4">
  {/* ヘッダー */}
  <header className="flex justify-between mb-4">
    <h1>トイレチェック</h1>
    <span>10:30現在</span>
  </header>

  {/* アラートボックス 3列 */}
  <div className="grid grid-cols-3 gap-3 mb-6">
    <StatusBox type="morning" ... />
    <StatusBox type="afternoon" ... />
    <StatusBox type="regular" ... />
  </div>

  {/* 履歴テーブル */}
  <div className="bg-white rounded-lg border">
    <h2>本日のチェック履歴</h2>
    <table>
      <thead><tr><th>時刻</th><th>担当</th></tr></thead>
      <tbody>
        {timeline.map(item => (
          <tr><td>{item.time}</td><td>{item.staff_icon}</td></tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

### StatusBox コンポーネント

```tsx
interface StatusBoxProps {
  label: string;       // "朝 〜8:50" | "午後 〜14:50" | "定期"
  status: 'ok' | 'warning' | 'alert' | 'pending';
  display: string;     // "8:45" | "75分" | "待機中" | "未"
}

function StatusBox({ label, status, display }: StatusBoxProps) {
  const styles = {
    ok: 'bg-emerald-50 border-emerald-300',
    warning: 'bg-amber-50 border-amber-300',
    alert: 'bg-red-50 border-red-300 animate-pulse',
    pending: 'bg-slate-50 border-slate-200',
  };
  
  const icons = {
    ok: '🟢',
    warning: '🟡',
    alert: '🔴',
    pending: '⏳',
  };

  return (
    <div className={`p-3 rounded-lg border-2 text-center ${styles[status]}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl mb-1">{icons[status]}</div>
      <div className="text-lg font-bold">{display}</div>
    </div>
  );
}
```

### アニメーション

| 状態 | 効果 |
|------|------|
| Alert | `animate-pulse` (ボックス全体が点滅) |
| データ更新 | なし（30秒ごとに静かに更新） |

---

#### 2.4 自動更新機能
- **更新間隔**: 30秒ごとにAPIを再取得
- `minutes_elapsed`はフロントでリアルタイム計算も可

---

### Phase 3: クリーンアップ

#### 3.1 削除・無効化するファイル/コード
| 対象 | 対応 |
|------|------|
| `MajorCheckpoint`モデル | 使用停止（マイグレーション不要） |
| `/dashboard/day`エンドポイント | `/dashboard/simple-status`に置き換え |
| 旧ダッシュボードUI | 新UIに完全置き換え |
| 管理画面の「主要チェックポイント」 | 削除 or 非表示 |

#### 3.2 詳細履歴ページ（オプション）
- 「詳細履歴を見る」ボタンで既存タイムラインを表示
- `/dashboard/history` として分離

---

## ファイル変更一覧

| ファイル | 変更内容 | 状態 |
|---------|---------|------|
| `backend/app/api/dashboard.py` | 新エンドポイント追加、既存を置き換え | ✅ 完了 |
| `backend/app/core/config.py` | アラート設定追加 | ✅ 完了 |
| `backend/app/schemas.py` | 新レスポンススキーマ追加 | ✅ 完了 |
| `frontend/app/dashboard/page.tsx` | シンプルダッシュボードに置き換え | ✅ 完了 |
| `frontend/lib/types.ts` | 型定義追加 | ✅ 完了 |
| `frontend/lib/api.ts` | API関数追加 | ✅ 完了 |
| `frontend/app/admin/page.tsx` | 主要チェックポイント管理を削除 | 🔲 未着手 |

---

## 実装順序

```
1. バックエンド
   ✅ 1.1 config.py に設定追加
   ✅ 1.2 schemas.py に新スキーマ追加
   ✅ 1.3 dashboard.py に新エンドポイント追加
   🔲 1.4 動作確認 (curl/Swagger)

2. フロントエンド
   ✅ 2.1 types.ts に型追加
   ✅ 2.2 api.ts にAPI関数追加
   ✅ 2.3 dashboard/page.tsx を新UIに置き換え
   ✅ 2.4 自動更新実装
   🔲 2.5 動作確認

3. クリーンアップ
   🔲 3.1 管理画面から主要チェックポイント削除
   🔲 3.2 不要コード削除
```

---

## 想定工数

| フェーズ | 工数目安 | 状態 |
|---------|---------|------|
| Phase 1: バックエンド | 2-3時間 | ✅ 完了 |
| Phase 2: フロントエンド | 2-3時間 | ✅ 完了 |
| Phase 3: クリーンアップ | 1時間 | 🔲 未着手 |
| **合計** | **5-7時間** | |

---

## 注意事項

1. **タイムゾーン**: 日本時間 (JST, UTC+9) で全て判定
2. **日付境界**: 0:00でリセット（前日のチェックは引き継がない）
3. **昼休み**: 12:00-14:00は定期チェックの経過時間カウントを停止
4. **21時以降**: 定期チェック判定を停止（「営業時間外」表示）

---

## 実装チェックリスト

- [x] 既存 MajorCheckpoint → 廃止（新システムに置き換え）
- [x] 朝チェック: 8:00〜8:50（開始で警告、期限超過でアラート）
- [x] 午後チェック: 14:00〜14:50（開始で警告、期限超過でアラート）
- [x] チェック完了時: 期限後でもOK＋時刻表示
- [x] トイレ: 1つのみ想定
- [x] 定期チェック起点: 8:50
- [x] 終了時刻: 21:00
- [x] 昼休み: 12:00〜14:00（カウント停止）
- [x] 自動更新: 30秒間隔
- [x] to_jst()ヘルパー関数でタイムゾーン変換を統一
- [x] 午後チェック: 14:00〜14:50
- [x] トイレ: 1つのみ想定
- [x] 定期チェック起点: 8:50
- [x] 終了時刻: 21:00
- [x] 昼休み: 12:00〜14:00（カウント停止）
- [x] 自動更新: 30秒間隔
