# トイレチェック管理システム 仕様書（完全版 v2）

**構成：Why（目的）／What（要件）／How（詳細仕様）**  
**実装技術：Next.js (PWA) + FastAPI（Python） + Render（Starter + Disk + Postgres）**  
**更新日：フェーズA最終確定版**

---

# 1. WHY（なぜ作るのか／背景と目的）

## 1-1. 現場の問題

- トイレチェックは原則1時間に1回行う規則だが、忙しさのため抜け漏れ・未実施が発生している
- 紙のチェック表では書き忘れ、証拠が残らない、管理者がリアルタイムに状況把握できない問題がある
- 「誰がやった／やっていない」に焦点を当てると摩擦が生じるため、目的は「ちゃんと行われたか」の可視化に絞る

## 1-2. なぜ本システムが必要なのか

- トイレチェックの定時実施を継続させる仕組みが必要
- スタッフ操作をストレス0・10秒以内にしないと継続できない
- 管理者側はDay / Week / Monthの3視点で閲覧できる必要がある
- 重要時間帯（開院前／昼前後／閉院前）を確実に監視したい

## 1-3. 本システムの最重要ゴール

1. 撮影＝実施証拠を強制し、抜け漏れを減らす
2. ダッシュボードで未実施を赤表示し、誰でも状況把握
3. 管理者がルール（主要チェック時間帯）を自分で調整可能
4. 半匿名アイコン方式で、スタッフの心理的負担を減らす

---

# 2. WHAT（何を作るか／必要機能）

## 2-1. システム構成（3つの独立ページ）

### ① 撮影用PWA `/capture`（認証なし・スタッフ利用）

- ボタン1つ → 撮影 → アイコン選択 → 自動送信
- 操作10秒以内
- 2枚必須（チェックシート＋全景）
- 3枚以上撮影してもそのまま保存（余分は`extra`扱い）
- 完全公開（URLを知っていればアクセス可）

### ② ダッシュボード `/dashboard`（認証なし・閲覧専用）

- スタッフ & 管理者 共通
- Day / Week / Monthの3タブ表示
- サムネイル（アイコンサイズ）表示
- スタッフアイコン（撮影者）表示
- サムネイルクリック → オーバーレイで拡大
- 完全公開（URLを知っていればアクセス可）

### ③ 管理画面 `/admin`（Basic認証・管理者専用）

- 診療時間の設定
- 主要チェックポイント（MAJOR）の管理
- スタッフアイコン管理
- タイムライン表示範囲の設定
- Basic認証の認証情報はRenderの環境変数で管理

## 2-2. チェックの分類ロジック

### （A）45〜90分ルール

- 前回から45〜90分以内 → 正常（緑）
- 45分未満 → TOO_SHORT（黄）
- 90分超過 → TOO_LONG（赤）

### （B）75分・90分アラート（リアルタイム）

- 75分経過 → ⚠️（警告）
- 90分経過 → 🔴（アラート）

### （C）主要チェックポイント（MAJOR）

管理者設定画面で調整可能。デフォルト値：

| 区分 | 時間帯 |
|------|--------|
| 開院前 | 08:30–08:50 |
| 午前終了時 | 12:00–13:00 |
| 午後開始前 | 14:40–14:50 |
| 閉院時 | 19:30–20:30 |

この時間帯に1件もチェックがなければアラート（赤）。

**注意：診療時間と主要チェックポイントは別概念として管理する。**  
例：診療時間が09:00開院でも、「開院前チェック」は08:30-08:50として独立設定可能。

## 2-3. スタッフは「アイコンのみ」選択

### Why

- 名前を出すと心理負担が大きくなる
- 目的は「実施の有無」であり「個人追跡」ではない

### What

- スタッフはアイコンのみタップ
- 間違えても修正機能なし
- admin画面でinternal_nameとiconを紐付け

## 2-4. 写真の扱い

- 撮影枚数：最低2枚（チェックシート・全景）
- 多く撮影してもOK（全部保存）
- サムネイルは最初の2枚のみ利用
- 拡大表示では主要2枚＋必要ならextraも将来追加可
- 保持期間：無期限（当面は自動削除なし）

## 2-5. タイムゾーン

- 日本時間（Asia/Tokyo）固定
- 他のタイムゾーン変換は不要
- 画面表示・ロジック・保存時刻すべてJST想定

## 2-6. トイレの初期設定

- 初期登録：1箇所
- 最大：2箇所（admin画面から追加可能）
- 将来的な拡張も考慮した設計とする

---

# 3. HOW（詳細仕様：画面設計／API／DB／処理ロジック）

## 3-1. 画面仕様（Next.js）

### 3-1-1. `/capture`（撮影用PWA）

#### 画面構成

- 大ボタン「撮影して記録」
- 最終チェック時刻（任意表示）

#### 撮影フロー

1. 撮影ボタンタップ
2. ネイティブカメラ起動 → 連続撮影（最低2枚）
3. 撮影後すぐ「スタッフアイコン選択画面」に遷移
4. アイコンタップ → 即アップロード開始
5. トースト表示「記録しました」
6. 自動でメイン画面に戻る

#### 注意点

- 確認画面なし
- 削除ややり直し機能は持たない（運用簡素化のため）

### 3-1-2. `/dashboard`（閲覧用）

#### 共通機能

- 日付選択
- トイレ選択（2箇所以上ある場合）
- Day / Week / Month 切り替え

#### Dayビュー仕様

**(A) 主要チェックポイント一覧（画面上部）**

| ラベル | 状態 | 最終チェック時刻 |
|--------|------|------------------|
| 開院前 | ✅ | 08:45 |
| 午前終了時 | 🔴 未実施 | - |
| 午後開始前 | ⏳ まだ | - |
| 閉院時 | 🔴 | - |

状態の意味：
- ⏳（まだ時間前）
- ✅（時間帯内に1件以上）
- 🔴（時間帯終了後もゼロ件）

**(B) リアルタイム75/90分アラートボックス**

```
⚠️ 1Fトイレ：前回から78分経過（そろそろチェック）
🔴 1Fトイレ：前回から95分経過（要対応）
```

**(C) 1日タイムライン**

- 表示時間範囲：admin画面で設定可能（デフォルト例：07:00〜22:00）
- 1時間刻みの表示
- 色分け：緑（正常）、黄（短すぎ）、赤（長すぎor未実施）
- アイコン（撮影者）表示
- サムネイル（アイコンサイズ）表示
- タップ → モーダルで主要2枚を拡大表示

#### Weekビュー

- 1週間の実施率ヒートマップ
- 日付クリックでDayへ遷移

#### Monthビュー

- カレンダービュー
- 日別の実施率を色で表示

### 3-1-3. `/admin`（管理画面・Basic認証）

#### 診療時間設定

- 開院時刻
- 昼休み開始・終了
- 閉院時刻

※診療時間と主要チェックポイントは別概念として独立管理

#### 主要チェックポイント設定（MAJOR）

編集可能項目：
- ラベル名
- 開始時刻 / 終了時刻
- 対象トイレ（すべて or 個別）
- 有効/無効
- 新規追加・削除

#### タイムライン表示設定

- 表示開始時刻（デフォルト：07:00）
- 表示終了時刻（デフォルト：22:00）

#### スタッフアイコン管理

- internal_name（本名）入力 ※UI非表示
- icon_code（表示アイコン）選択
- is_active ON/OFF
- 並び順編集

#### トイレ管理

- 名前
- 有効/無効
- 最大2箇所まで登録可能

## 3-2. データモデル（PostgreSQL）

### staff

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PRIMARY KEY | |
| internal_name | VARCHAR(100) | 本名（UI非表示） |
| icon_code | VARCHAR(50) | 絵文字コード |
| is_active | BOOLEAN DEFAULT TRUE | 論理削除用 |
| display_order | INTEGER | 並び順 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**削除方針：論理削除のみ（is_active=false）。物理削除は行わない。**

### toilets

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PRIMARY KEY | |
| name | VARCHAR(100) | 表示名 |
| floor | VARCHAR(50) | 階数など |
| is_active | BOOLEAN DEFAULT TRUE | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### devices

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PRIMARY KEY | |
| device_uuid | VARCHAR(255) UNIQUE | 端末識別子 |
| name | VARCHAR(100) | 端末名（任意） |
| assigned_toilet_id | INTEGER NULL | FK toilets（未使用） |
| created_at | TIMESTAMP | |

**用途：ログ記録用。どの端末から送信されたかの履歴として保存。**  
**現時点ではトイレとの紐付け機能は未使用。**

### toilet_checks

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PRIMARY KEY | |
| toilet_id | INTEGER NOT NULL | FK toilets |
| device_id | INTEGER NULL | FK devices |
| staff_id | INTEGER NOT NULL | FK staff |
| checked_at | TIMESTAMP NOT NULL | チェック日時（JST） |
| interval_sec_from_prev | INTEGER NULL | 前回からの秒数 |
| status_type | VARCHAR(20) | NORMAL/TOO_SHORT/TOO_LONG |
| created_at | TIMESTAMP | |

### check_images

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PRIMARY KEY | |
| check_id | INTEGER NOT NULL | FK toilet_checks |
| image_path | VARCHAR(500) | ファイルパス |
| image_type | VARCHAR(20) | sheet/overview/extra |
| order_index | INTEGER | 並び順 |
| created_at | TIMESTAMP | |

### major_checkpoints（主要チェックポイント）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PRIMARY KEY | |
| name | VARCHAR(100) | ラベル名 |
| start_time | TIME | 開始時刻 |
| end_time | TIME | 終了時刻 |
| target_toilet_id | INTEGER NULL | NULL=全トイレ、指定=特定 |
| is_active | BOOLEAN DEFAULT TRUE | |
| display_order | INTEGER | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### clinic_config（診療時間・システム設定）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PRIMARY KEY | |
| key | VARCHAR(100) UNIQUE | 設定キー |
| value | VARCHAR(500) | 設定値 |
| updated_at | TIMESTAMP | |

設定キー例：
- `opening_time`: 開院時刻
- `break_start`: 昼休み開始
- `break_end`: 昼休み終了
- `closing_time`: 閉院時刻
- `timeline_start`: タイムライン表示開始時刻
- `timeline_end`: タイムライン表示終了時刻

## 3-3. API設計（FastAPI）

### 撮影系（認証なし）

#### POST `/api/checks`

リクエスト：
- toilet_id: int
- device_uuid: str
- staff_id: int
- images: List[UploadFile]（複数画像）

処理：
1. 画像検証（最低2枚）
2. image_type判定（1枚目=sheet、2枚目=overview、3枚目以降=extra）
3. 前回チェックからのinterval計算
4. status_type判定（NORMAL/TOO_SHORT/TOO_LONG）
5. DB保存
6. 画像をディスクに保存

#### GET `/api/checks`

パラメータ：
- date: str (YYYY-MM-DD)
- toilet_id: int (optional)

#### GET `/api/dashboard/day`

パラメータ：
- date: str (YYYY-MM-DD)
- toilet_id: int (optional)

レスポンス：
- major_checkpoints: 主要チェックポイント状態一覧
- realtime_alerts: 75/90分アラート
- timeline: タイムラインデータ

#### GET `/api/dashboard/week`

パラメータ：
- start_date: str (YYYY-MM-DD)
- toilet_id: int (optional)

#### GET `/api/dashboard/month`

パラメータ：
- year: int
- month: int
- toilet_id: int (optional)

#### GET `/api/toilets`

トイレ一覧取得

#### GET `/api/staff`

有効なスタッフ一覧（アイコン選択用）

### 管理系（Basic認証必須）

#### GET `/api/admin/settings`

全設定取得

#### POST `/api/admin/settings`

設定更新

#### GET `/api/admin/staff`

スタッフ一覧（internal_name含む）

#### POST `/api/admin/staff`

スタッフ追加

#### PATCH `/api/admin/staff/{id}`

スタッフ更新

#### DELETE `/api/admin/staff/{id}`

スタッフ論理削除（is_active=false）

#### GET `/api/admin/major-checkpoints`

主要チェックポイント一覧

#### POST `/api/admin/major-checkpoints`

追加

#### PATCH `/api/admin/major-checkpoints/{id}`

更新

#### DELETE `/api/admin/major-checkpoints/{id}`

削除

#### GET `/api/admin/toilets`

トイレ一覧

#### POST `/api/admin/toilets`

追加（最大2件まで）

#### PATCH `/api/admin/toilets/{id}`

更新

## 3-4. スタッフアイコン仕様

### アイコン種類

動物絵文字ベース、20種類を用意：

```
🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯
🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉
```

### 運用ルール

- 各スタッフに1つのアイコンを割り当て
- 同じアイコンを複数スタッフに割り当て不可（ユニーク制約）
- admin画面でのみinternal_nameとの紐付けを確認可能

## 3-5. 写真の保存と縮小

### クライアント側（Next.js）

- `<canvas>`利用でリサイズ
- 長辺1280pxへ縮小
- JPEG品質75%
- 縮小後にアップロード

### サーバ側（FastAPI）

- 受信画像が大きい場合は再縮小（Pillow使用）
- 保存パス：`/var/data/toilet-images/YYYY/MM/DD/{check_id}/`
- ファイル名：`{order_index}_{image_type}.jpg`

### 容量見積もり

- 1チェック：2〜4枚 × 100〜200KB = 200〜800KB
- 1日：1トイレ × 10回 = 約2〜8MB
- 1ヶ月：約60〜240MB
- 保持期間：無期限（当面は自動削除なし）

## 3-6. カメラ実装方式

### 採用方式

`<input type="file" accept="image/*" capture="environment" multiple>`

### 選定理由

1. 実装が単純（数行のHTMLで完結）
2. 全端末で安定動作（iOS Safari含む）
3. ユーザーが慣れた標準カメラUIを使用
4. 10秒ルールに適合（余計なカスタムUIなし）

### 実装詳細

```html
<input
  type="file"
  accept="image/*"
  capture="environment"
  multiple
  onChange={handleImageCapture}
/>
```

撮影後、クライアント側でcanvas縮小してからアップロード。

## 3-7. フロントエンド技術方針

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
| `/capture` | レイアウト | カメラ操作、フォーム、トースト |
| `/dashboard` | データフェッチ、初期表示 | タブ切替、モーダル、リアルタイム更新 |
| `/admin` | データフェッチ、フォーム処理 | フォームバリデーション、UI状態 |

## 3-8. 認証

### `/capture`, `/dashboard`

- 認証なし
- 完全公開（URLを知っていればアクセス可）
- 院内運用を想定しているが、技術的な制限は設けない

### `/admin`

- Basic認証
- 認証情報はRenderの環境変数で管理
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`

## 3-9. タイムゾーン

- すべてAsia/Tokyo（日本時間）
- DB保存も表示もロジックも日本時間固定
- 他TZ対応は不要

---

# 4. 実現すべきポイント（重要まとめ）

- ✔ 撮影は1タップ → 2枚撮影 → アイコン選択 → 自動送信
- ✔ スタッフ側に名前は見せない（アイコンのみ）
- ✔ adminのみ internal_name と icon の紐づけ管理
- ✔ Dayビューに主要チェックポイントと75/90分アラート
- ✔ 画像は2枚サムネ＋extraも保存
- ✔ すべて日本時間
- ✔ UIは極限まで簡単、確認画面なし
- ✔ 動物絵文字アイコン20種類
- ✔ トイレは1箇所（最大2箇所まで拡張可）
- ✔ 画像は無期限保持

---

# 5. 技術スタック確定

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Next.js 14+ (App Router, RSC) |
| PWA | next-pwa |
| バックエンド | FastAPI (Python 3.11+) |
| データベース | PostgreSQL (Render Postgres) |
| ファイルストレージ | Render Disk |
| ホスティング | Render (Starter Plan) |
| 認証 | Basic認証（admin のみ） |

---

# 6. 次フェーズ（フェーズB）へのつなぎ

フェーズBでは以下をコードレベルで実装：

1. プロジェクト構成（ディレクトリ構造）
2. Next.js
   - ページ構造
   - PWA設定
   - 各画面の実装
3. FastAPI
   - APIルーター実装
   - SQLAlchemyモデル
   - Pydanticスキーマ
4. 画像縮小処理
5. Basic認証ミドルウェア
6. デプロイ設定

---

# 変更履歴

| バージョン | 変更内容 |
|------------|----------|
| v1 | 初版作成 |
| v2 | Q&A回答反映：devices用途明記、論理削除方針、容量見積もり、保持期間、公開範囲、アイコン仕様、トイレ数、フロントエンド方針、カメラ実装方式、タイムライン設定 |
