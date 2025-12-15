# Future Improvements (future-002.md)

日付ナビゲーション機能の追加について

---

## 📅 F003: 過去の記録への日付ナビゲーション

**優先度:** 高  
**ステータス:** ✅ 実装済み  
**実装方針:** フロントエンド＋バックエンド対応

### 概要
現在は当日の状況しか確認できないが、過去の日付に移動して履歴を確認できるようにする。

---

### As-Is（現状）

```
┌─────────────────────────────────────────────────────┐
│  📊 本日のチェック履歴                                │
├─────────────────────────────────────────────────────┤
│  15:20  🟢 通常チェック  🐱                           │
│  14:10  🟢 通常チェック  🐶                           │
│  13:30  🟢 通常チェック  🐱                           │
│  ︙                                                   │
└─────────────────────────────────────────────────────┘

※ 当日のデータのみ表示
※ 過去の記録を確認する手段がない
```

---

### To-Be（改善後）

```
┌─────────────────────────────────────────────────────┐
│  ◀ 前日    📅 2024年12月15日（日）    翌日 ▶         │
│                                      [📍今日に戻る]   │
├─────────────────────────────────────────────────────┤
│  📊 チェック履歴                                      │
├─────────────────────────────────────────────────────┤
│  15:20  🟢 通常チェック  🐱                           │
│  14:10  🟢 通常チェック  🐶                           │
│  13:30  🟢 通常チェック  🐱                           │
│  ︙                                                   │
└─────────────────────────────────────────────────────┘

※ ヘッダーに日付を表示
※ 矢印ボタンで前日/翌日に移動可能
※ 「今日に戻る」ボタンで即座に今日の画面へ
```

---

### 実装詳細

#### 1. ヘッダーに日付表示
```tsx
// DateNavigation.tsx
<header className="flex items-center justify-between p-4 bg-white shadow">
    <button onClick={goToPrevDay}>◀ 前日</button>
    <div className="text-center">
        <span className="text-lg font-bold">
            📅 {formatDate(selectedDate)}
        </span>
    </div>
    <button onClick={goToNextDay} disabled={isToday}>翌日 ▶</button>
</header>
```

#### 2. 「今日に戻る」ボタン
- 当日以外を表示中のみ表示
- 画面右下にフローティングボタンとして配置

```tsx
{!isToday && (
    <button 
        className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg"
        onClick={goToToday}
    >
        📍 今日に戻る
    </button>
)}
```

#### 3. バックエンドAPI
```python
# 日付パラメータを受け取るように変更
@router.get("/dashboard/day/{date}")
async def get_dashboard_day(date: str):  # YYYY-MM-DD形式
    target_date = parse_date(date)
    return get_checks_for_date(target_date)
```

---

## ⏱️ F004: 自動で今日に戻る（アイドルタイムアウト）

**優先度:** 中  
**ステータス:** ✅ 実装済み  
**実装方針:** フロントエンドのみ

### 概要
過去の日付を閲覧中、一定時間（例: 1分）操作がなければ自動的に今日の画面に戻る。

---

### As-Is（現状）

```
❌ 過去日を表示したまま放置
   ↓
   次に見た人が「今日のデータ」と勘違いする危険性
```

---

### To-Be（改善後）

```
📅 2024年12月10日 を表示中
   ↓
   60秒間操作なし
   ↓
🔄 自動で今日（2024年12月15日）に切り替え
   ↓
   通知: 「自動で今日に戻りました」（トースト表示）
```

---

### 実装詳細

#### 1. アイドル検出
```tsx
// useIdleTimeout.ts
const IDLE_TIMEOUT = 60 * 1000; // 60秒

export function useIdleTimeout(callback: () => void, enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        
        let timer: NodeJS.Timeout;
        
        const resetTimer = () => {
            clearTimeout(timer);
            timer = setTimeout(callback, IDLE_TIMEOUT);
        };
        
        // マウス/タッチ/キーボード操作を監視
        const events = ['mousemove', 'touchstart', 'keydown', 'scroll'];
        events.forEach(e => window.addEventListener(e, resetTimer));
        
        resetTimer(); // 初期化
        
        return () => {
            clearTimeout(timer);
            events.forEach(e => window.removeEventListener(e, resetTimer));
        };
    }, [callback, enabled]);
}
```

#### 2. ダッシュボードへの適用
```tsx
// Dashboard.tsx
const [selectedDate, setSelectedDate] = useState(new Date());
const isToday = isSameDay(selectedDate, new Date());

// 今日以外を表示中のときのみタイマー有効
useIdleTimeout(() => {
    setSelectedDate(new Date());
    showToast('自動で今日に戻りました');
}, !isToday);
```

#### 3. タイムアウト時間の設定
- デフォルト: 60秒
- 設定画面で変更可能にする（オプション）

---

## 📝 メモ

- F003とF004は連携して実装する
- 未来の日付には移動できないように制限
- カレンダーピッカーも将来的に検討（日付を直接選択）
