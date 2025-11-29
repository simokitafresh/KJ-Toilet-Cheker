# トイレチェック管理システム - アーキテクチャ詳細

**バージョン:** フェーズA最終版  
**更新日:** 2024年

---

## 目次

1. [システム全体構成](#1-システム全体構成)
2. [ページ構成とルーティング](#2-ページ構成とルーティング)
3. [データベース設計](#3-データベース設計)
4. [API設計](#4-api設計)
5. [撮影フロー](#5-撮影フロー)
6. [ステータス判定ロジック](#6-ステータス判定ロジック)
7. [主要チェックポイント（MAJOR）](#7-主要チェックポイントmajor)
8. [スタッフアイコン](#8-スタッフアイコン)
9. [画像保存](#9-画像保存)
10. [技術スタック](#10-技術スタック)

---

## 1. システム全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                 クライアント（ブラウザ/PWA）                    │
├─────────────────┬─────────────────┬─────────────────────────┤
│   /capture      │   /dashboard    │        /admin           │
│   撮影用PWA     │   閲覧用        │        管理画面         │
│   (認証なし)    │   (認証なし)    │     (Basic認証)         │
└────────┬────────┴────────┬────────┴────────────┬────────────┘
         │                 │                     │
         └─────────────────┼─────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Render Platform                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js (Starter Plan)                  │   │
│  │              App Router / RSC / PWA                  │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │ API Call                          │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FastAPI (Starter Plan)                  │   │
│  │              Python 3.11+ / Basic Auth               │   │
│  └──────────┬───────────────────────────┬──────────────┘   │
│             │                           │                   │
│             ▼                           ▼                   │
│  ┌──────────────────┐      ┌──────────────────────────┐    │
│  │    PostgreSQL    │      │      Render Disk         │    │
│  │  (Render Postgres)│      │  /var/data/toilet-images │    │
│  └──────────────────┘      └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 構成要素

| コンポーネント | 役割 | プラン |
|---------------|------|--------|
| Next.js | フロントエンド・PWA | Render Starter |
| FastAPI | バックエンドAPI | Render Starter |
| PostgreSQL | データベース | Render Postgres |
| Render Disk | 画像ストレージ | Disk |

---

## 2. ページ構成とルーティング

### ルート構成

```
/
├── /capture      # 撮影用PWA（スタッフ向け）
├── /dashboard    # 閲覧用（スタッフ・管理者共通）
└── /admin        # 管理画面（管理者専用）
```

### ページ詳細

| パス | 認証 | 用途 | 主な機能 |
|------|------|------|----------|
| `/capture` | なし | スタッフ撮影 | カメラ起動→撮影→アイコン選択→送信 |
| `/dashboard` | なし | 閲覧専用 | Day/Week/Month表示、アラート確認 |
| `/admin` | Basic認証 | 管理者専用 | 設定変更、スタッフ/トイレ管理 |

### 各ページの構成

#### /capture（撮影用PWA）
- 撮影ボタン
- アイコン選択画面
- 送信完了トースト

#### /dashboard（閲覧用）
- Day View（タイムライン、主要チェックポイント、リアルタイムアラート）
- Week View（ヒートマップ）
- Month View（カレンダー）

#### /admin（管理画面）
- 診療時間設定
- 主要チェックポイント（MAJOR）設定
- スタッフ管理
- トイレ管理
- タイムライン表示設定

---

## 3. データベース設計

### ER図（テキスト表現）

```
staff ──────────────┐
  │                 │
  │ 1:N             │
  ▼                 │
toilet_checks ◄─────┤
  │                 │
  │ 1:N             │
  ▼                 │
check_images        │
                    │
toilets ────────────┤
  │                 │
  │ 1:N             │
  ├─────────────────┤
  │                 │
  ▼                 ▼
major_checkpoints  devices
                    │
                    │ 1:N
                    ▼
               toilet_checks

clinic_config（独立）
```

### テーブル定義

#### staff（スタッフ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PRIMARY KEY | |
| internal_name | VARCHAR(100) | NOT NULL | 本名（UI非表示） |
| icon_code | VARCHAR(50) | NOT NULL, UNIQUE | 絵文字コード |
| is_active | BOOLEAN | DEFAULT TRUE | 論理削除用 |
| display_order | INTEGER | | 並び順 |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

**削除方針:** 論理削除のみ（is_active=false）。物理削除は行わない。

#### toilets（トイレ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PRIMARY KEY | |
| name | VARCHAR(100) | NOT NULL | 表示名 |
| floor | VARCHAR(50) | | 階数など |
| is_active | BOOLEAN | DEFAULT TRUE | |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

**制約:** 最大2箇所まで登録可能

#### devices（端末）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PRIMARY KEY | |
| device_uuid | VARCHAR(255) | UNIQUE, NOT NULL | 端末識別子 |
| name | VARCHAR(100) | | 端末名（任意） |
| assigned_toilet_id | INTEGER | FK toilets, NULL | 未使用 |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**用途:** ログ記録用。どの端末から送信されたかの履歴として保存。現時点ではトイレとの紐付け機能は未使用。

#### toilet_checks（チェック記録）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PRIMARY KEY | |
| toilet_id | INTEGER | FK toilets, NOT NULL | |
| device_id | INTEGER | FK devices, NULL | |
| staff_id | INTEGER | FK staff, NOT NULL | |
| checked_at | TIMESTAMP | NOT NULL | チェック日時（JST） |
| interval_sec_from_prev | INTEGER | NULL | 前回からの秒数 |
| status_type | VARCHAR(20) | NOT NULL | NORMAL/TOO_SHORT/TOO_LONG |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### check_images（チェック画像）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PRIMARY KEY | |
| check_id | INTEGER | FK toilet_checks, NOT NULL | |
| image_path | VARCHAR(500) | NOT NULL | ファイルパス |
| image_type | VARCHAR(20) | NOT NULL | sheet/overview/extra |
| order_index | INTEGER | NOT NULL | 並び順 |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### major_checkpoints（主要チェックポイント）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PRIMARY KEY | |
| name | VARCHAR(100) | NOT NULL | ラベル名 |
| start_time | TIME | NOT NULL | 開始時刻 |
| end_time | TIME | NOT NULL | 終了時刻 |
| target_toilet_id | INTEGER | FK toilets, NULL | NULL=全トイレ |
| is_active | BOOLEAN | DEFAULT TRUE | |
| display_order | INTEGER | | |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

#### clinic_config（システム設定）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PRIMARY KEY | |
| key | VARCHAR(100) | UNIQUE, NOT NULL | 設定キー |
| value | VARCHAR(500) | NOT NULL | 設定値 |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

**設定キー一覧:**

| key | 説明 | デフォルト例 |
|-----|------|-------------|
| opening_time | 開院時刻 | 09:00 |
| break_start | 昼休み開始 | 12:00 |
| break_end | 昼休み終了 | 13:00 |
| closing_time | 閉院時刻 | 20:00 |
| timeline_start | タイムライン表示開始 | 07:00 |
| timeline_end | タイムライン表示終了 | 22:00 |

---

## 4. API設計

### 公開API（認証なし）

#### チェック記録

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | `/api/checks` | チェック記録（画像アップロード） |
| GET | `/api/checks` | チェック一覧取得 |

**POST /api/checks リクエスト:**
```json
{
  "toilet_id": 1,
  "device_uuid": "uuid-string",
  "staff_id": 1,
  "images": [File, File, ...]  // multipart/form-data
}
```

**POST /api/checks 処理フロー:**
1. 画像検証（最低2枚）
2. image_type判定（1枚目=sheet、2枚目=overview、3枚目以降=extra）
3. 前回チェックからのinterval計算
4. status_type判定（NORMAL/TOO_SHORT/TOO_LONG）
5. DB保存
6. 画像をディスクに保存

**GET /api/checks パラメータ:**
- `date`: YYYY-MM-DD（必須）
- `toilet_id`: int（任意）

#### ダッシュボード

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/dashboard/day` | Day View データ |
| GET | `/api/dashboard/week` | Week View データ |
| GET | `/api/dashboard/month` | Month View データ |

**GET /api/dashboard/day レスポンス:**
```json
{
  "major_checkpoints": [
    {
      "name": "開院前",
      "status": "completed",  // pending/completed/missed
      "last_check_time": "08:45"
    }
  ],
  "realtime_alerts": [
    {
      "toilet_name": "1Fトイレ",
      "minutes_elapsed": 78,
      "alert_level": "warning"  // warning/alert
    }
  ],
  "timeline": [
    {
      "id": 1,
      "checked_at": "2024-01-15T09:30:00",
      "staff_icon": "🐶",
      "status_type": "NORMAL",
      "thumbnails": ["url1", "url2"]
    }
  ]
}
```

#### マスタデータ

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/toilets` | トイレ一覧 |
| GET | `/api/staff` | スタッフ一覧（アイコンのみ） |

### 管理API（Basic認証必須）

#### 設定

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/admin/settings` | 全設定取得 |
| POST | `/api/admin/settings` | 設定更新 |

#### スタッフ管理

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/admin/staff` | スタッフ一覧（本名含む） |
| POST | `/api/admin/staff` | スタッフ追加 |
| PATCH | `/api/admin/staff/{id}` | スタッフ更新 |
| DELETE | `/api/admin/staff/{id}` | スタッフ論理削除 |

#### 主要チェックポイント管理

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/admin/major-checkpoints` | 一覧取得 |
| POST | `/api/admin/major-checkpoints` | 追加 |
| PATCH | `/api/admin/major-checkpoints/{id}` | 更新 |
| DELETE | `/api/admin/major-checkpoints/{id}` | 削除 |

#### トイレ管理

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/admin/toilets` | 一覧取得 |
| POST | `/api/admin/toilets` | 追加（最大2件） |
| PATCH | `/api/admin/toilets/{id}` | 更新 |

---

## 5. 撮影フロー

### シーケンス

```
スタッフ          /capture (PWA)      ネイティブカメラ      FastAPI          PostgreSQL       Render Disk
   │                   │                    │                  │                  │                │
   │ 「撮影して記録」   │                    │                  │                  │                │
   │ タップ            │                    │                  │                  │                │
   │──────────────────>│                    │                  │                  │                │
   │                   │                    │                  │                  │                │
   │                   │ input[type=file]   │                  │                  │                │
   │                   │ 起動               │                  │                  │                │
   │                   │───────────────────>│                  │                  │                │
   │                   │                    │                  │                  │                │
   │                   │                    │ カメラUI表示     │                  │                │
   │<──────────────────────────────────────│                  │                  │                │
   │                   │                    │                  │                  │                │
   │ 2枚以上撮影       │                    │                  │                  │                │
   │──────────────────────────────────────>│                  │                  │                │
   │                   │                    │                  │                  │                │
   │                   │ 画像ファイル返却   │                  │                  │                │
   │                   │<───────────────────│                  │                  │                │
   │                   │                    │                  │                  │                │
   │                   │ Canvas縮小         │                  │                  │                │
   │                   │ (1280px, 75%)      │                  │                  │                │
   │                   │                    │                  │                  │                │
   │ アイコン選択画面  │                    │                  │                  │                │
   │<──────────────────│                    │                  │                  │                │
   │                   │                    │                  │                  │                │
   │ アイコンタップ    │                    │                  │                  │                │
   │──────────────────>│                    │                  │                  │                │
   │                   │                    │                  │                  │                │
   │                   │ POST /api/checks   │                  │                  │                │
   │                   │──────────────────────────────────────>│                  │                │
   │                   │                    │                  │                  │                │
   │                   │                    │                  │ 画像検証         │                │
   │                   │                    │                  │ interval計算     │                │
   │                   │                    │                  │ status判定       │                │
   │                   │                    │                  │                  │                │
   │                   │                    │                  │ INSERT           │                │
   │                   │                    │                  │─────────────────>│                │
   │                   │                    │                  │                  │                │
   │                   │                    │                  │ 画像保存         │                │
   │                   │                    │                  │────────────────────────────────>│
   │                   │                    │                  │                  │                │
   │                   │ 200 OK             │                  │                  │                │
   │                   │<──────────────────────────────────────│                  │                │
   │                   │                    │                  │                  │                │
   │ トースト          │                    │                  │                  │                │
   │ 「記録しました」  │                    │                  │                  │                │
   │<──────────────────│                    │                  │                  │                │
   │                   │                    │                  │                  │                │
   │                   │ メイン画面に       │                  │                  │                │
   │                   │ 自動戻り           │                  │                  │                │
```

### 10秒ルール

- **目標:** 撮影ボタン → 完了まで10秒以内
- **確認画面なし**
- **やり直し機能なし**

---

## 6. ステータス判定ロジック

### 判定フロー

```
新規チェック
    │
    ▼
前回チェック取得
    │
    ▼
┌───────────────┐
│ 前回あり？    │
└───────┬───────┘
        │
   No ──┴── Yes
   │        │
   ▼        ▼
NORMAL   interval計算（秒）
(NULL)      │
            ▼
      ┌─────────────────┐
      │ < 2700秒?       │
      │ (45分未満)      │
      └────────┬────────┘
               │
          Yes ─┴─ No
          │       │
          ▼       ▼
     TOO_SHORT  ┌─────────────────┐
     (黄)       │ <= 5400秒?      │
                │ (90分以内)      │
                └────────┬────────┘
                         │
                    Yes ─┴─ No
                    │       │
                    ▼       ▼
                 NORMAL  TOO_LONG
                 (緑)    (赤)
```

### ステータス一覧

| ステータス | 色 | 条件 |
|-----------|-----|------|
| NORMAL | 🟢 緑 | 45〜90分以内 |
| TOO_SHORT | 🟡 黄 | 45分未満 |
| TOO_LONG | 🔴 赤 | 90分超過 |

### リアルタイムアラート

| 経過時間 | アラート |
|----------|----------|
| 75分経過 | ⚠️ 警告表示 |
| 90分経過 | 🔴 アラート表示 |

---

## 7. 主要チェックポイント（MAJOR）

### デフォルト設定

| ラベル | 時間帯 | 説明 |
|--------|--------|------|
| 開院前 | 08:30–08:50 | 開院準備として必須 |
| 午前終了時 | 12:00–13:00 | 昼休み前の確認 |
| 午後開始前 | 14:40–14:50 | 午後診療開始前 |
| 閉院時 | 19:30–20:30 | 閉院時の最終確認 |

**注意:** 診療時間と主要チェックポイントは別概念として独立管理

### 状態判定ロジック

```
現在時刻
    │
    ▼
┌───────────────┐
│ 時間帯前？    │
└───────┬───────┘
        │
   Yes ─┴─ No
   │       │
   ▼       ▼
⏳ まだ  ┌───────────────┐
        │ 時間帯内？    │
        └───────┬───────┘
                │
           Yes ─┴─ No
           │       │
           ▼       ▼
     ┌──────────┐ ┌──────────────┐
     │チェック  │ │チェック      │
     │あり？    │ │あった？      │
     └────┬─────┘ └──────┬───────┘
          │              │
     Yes ─┴─ No     Yes ─┴─ No
     │       │      │       │
     ▼       ▼      ▼       ▼
  ✅ 完了  ⏳ まだ  ✅ 完了  🔴 未実施
```

### 状態一覧

| 状態 | 意味 |
|------|------|
| ⏳ まだ | 時間帯前 |
| ✅ 完了 | 時間帯内に1件以上のチェックあり |
| 🔴 未実施 | 時間帯終了後もチェックなし |

---

## 8. スタッフアイコン

### アイコン一覧（20種類）

```
🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯
🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉
```

### 運用ルール

1. **ユニーク制約:** 各スタッフに1つのアイコンを割り当て（重複不可）
2. **表示範囲:** 撮影画面・ダッシュボードにはアイコンのみ表示
3. **紐付け確認:** admin画面でのみ internal_name との紐付けを確認可能

### 目的

- 名前を出すと心理負担が大きくなる
- 目的は「実施の有無」であり「個人追跡」ではない
- 半匿名方式でスタッフの心理的負担を軽減

---

## 9. 画像保存

### 処理フロー

```
┌─────────────────────────────────────────────┐
│              クライアント                    │
├─────────────────────────────────────────────┤
│  撮影画像        Canvas縮小        縮小画像  │
│  (オリジナル) ──> (1280px/75%) ──> (100-200KB)│
└──────────────────────┬──────────────────────┘
                       │ Upload
                       ▼
┌─────────────────────────────────────────────┐
│               サーバ                         │
├─────────────────────────────────────────────┤
│  画像受信 ──> 検証(最低2枚) ──> ディスク保存 │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│            Render Disk                       │
├─────────────────────────────────────────────┤
│  /var/data/toilet-images/YYYY/MM/DD/check_id/│
└─────────────────────────────────────────────┘
```

### ディレクトリ構成

```
/var/data/toilet-images/
└── 2024/
    └── 01/
        └── 15/
            └── 42/                 # check_id
                ├── 0_sheet.jpg     # チェックシート
                ├── 1_overview.jpg  # 全景
                └── 2_extra.jpg     # 追加（オプション）
```

### 画像タイプ

| order_index | image_type | 説明 |
|-------------|------------|------|
| 0 | sheet | チェックシート |
| 1 | overview | 全景 |
| 2以降 | extra | 追加画像（オプション） |

### 縮小仕様

| 項目 | 値 |
|------|-----|
| 処理場所 | クライアント側（Canvas） |
| 最大サイズ | 長辺1280px |
| 品質 | JPEG 75% |
| 結果サイズ | 100〜200KB/枚 |

### 容量見積もり

| 単位 | 容量 |
|------|------|
| 1チェック | 200〜800KB |
| 1日（10回） | 2〜8MB |
| 1ヶ月 | 60〜240MB |
| **保持期間** | **無期限** |

---

## 10. 技術スタック

### フロントエンド

| 技術 | 用途 |
|------|------|
| Next.js 14+ | フレームワーク（App Router） |
| React Server Components | サーバーサイドレンダリング |
| next-pwa | PWA対応 |
| TailwindCSS | スタイリング |

### バックエンド

| 技術 | 用途 |
|------|------|
| FastAPI | APIフレームワーク |
| Python 3.11+ | 言語 |
| SQLAlchemy | ORM |
| Pydantic | バリデーション |
| Pillow | 画像処理 |

### データベース

| 技術 | 用途 |
|------|------|
| PostgreSQL | RDBMS |
| Render Postgres | ホスティング |

**タイムゾーン:** Asia/Tokyo固定

### インフラ

| 技術 | 用途 |
|------|------|
| Render (Starter Plan) | ホスティング |
| Render Disk | 画像ストレージ |
| 環境変数 | Basic認証情報管理 |

### 認証

| 画面 | 認証方式 |
|------|----------|
| /capture | なし |
| /dashboard | なし |
| /admin | Basic認証 |

**環境変数:**
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

---

## 補足：フロントエンド技術方針

### 状態管理

React Server Components (RSC) + クライアントコンポーネントの最小限利用

### 選定理由

1. `/capture`: フォーム送信とカメラ操作のみ → 最小限のクライアント状態
2. `/dashboard`: データ取得・表示がメイン → RSCでサーバーサイドフェッチが効率的
3. `/admin`: CRUD操作 → Server Actionsで簡潔に実装可能
4. JavaScriptバンドルサイズ削減 → PWAモバイル端末で有利
5. 外部状態管理ライブラリ不要（Redux/Zustand等は使わない）

### 使い分け

| ページ | Server Component | Client Component |
|--------|------------------|------------------|
| /capture | レイアウト | カメラ操作、フォーム、トースト |
| /dashboard | データフェッチ、初期表示 | タブ切替、モーダル、リアルタイム更新 |
| /admin | データフェッチ、フォーム処理 | フォームバリデーション、UI状態 |

---

## 補足：カメラ実装方式

### 採用方式

```html
<input
  type="file"
  accept="image/*"
  capture="environment"
  multiple
  onChange={handleImageCapture}
/>
```

### 選定理由

1. **実装の単純さ:** 数行のHTMLで完結
2. **信頼性:** 全端末で安定動作（iOS Safari含む）
3. **ユーザー体験:** ユーザーが慣れた標準カメラUIを使用
4. **10秒ルール適合:** 余計なカスタムUIがない

---

*このドキュメントはフェーズA最終版として確定しています。*
