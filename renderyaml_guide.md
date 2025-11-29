# Render.yaml Configuration Guide & Best Practices

このガイドは、Render.yaml（Blueprint）を使用してアプリケーションをデプロイする際のベストプラクティスと、よくある落とし穴（特にネットワークと環境変数関連）をまとめたものです。

## 基本設定（Defaults）

*   **Region**: `singapore` (シンガポール) を優先的に使用します（Web Service, Database等）。
    *   ※ **Static Site** (`runtime: static`) はグローバルCDNで配信されるため、`region` 指定は不要です。
    *   ※ **Cron Job** もデフォルトで動作するため、明示的な指定は必須ではありません（現状の動作構成に基づく）。
*   **Plan**: `starter` をデフォルトとします（Web Service等）。
    *   ※ **Static Site** は指定なし（Free）で運用します。
    *   ※ **Cron Job** も指定なしで動作しています。

## 重要な教訓（Golden Rules）

### 1. フロントエンド（Static Site）からバックエンドへの接続
**ルール: 必ず「公開URL（Public URL）」を使用する**

フロントエンド（React, Next.jsなど）はユーザーのブラウザ上で実行されます。そのため、Render内部のネットワーク（Internal Network）にはアクセスできません。

*   ❌ **NG**: `fromService` で `property: host` や `hostport` を使用する。
    *   これらは `dm-signal-backend` や `dm-signal-backend:10000` のような内部アドレスに解決されますが、ブラウザからはアクセスできません。
*   ✅ **OK**: 公開URL（`https://app-name.onrender.com`）を直接指定する。

```yaml
  - type: web
    name: my-frontend
    envVars:
      - key: NEXT_PUBLIC_API_HOST
        value: https://my-backend.onrender.com  # 公開URLをハードコード
```

### 2. Cron Job からバックエンドへの接続
**ルール: 必ず「公開URL（Public URL）」を使用する**

RenderのCron Jobは独立したコンテナで実行されることが多く、他のサービスの内部ホスト名（Internal Hostname）を解決できない場合があります。

*   ❌ **NG**: 内部ホスト名でアクセスする。
    *   `curl http://my-backend:10000/api/...` → `Could not resolve host` エラーになります。
*   ✅ **OK**: 公開URL（HTTPS）でアクセスする。

```yaml
  - type: cron
    name: my-cron-job
    startCommand: curl -f -X POST https://my-backend.onrender.com/api/trigger
```

### 3. バックエンド間（Web Service to Web Service）の通信
**ルール: 「内部URL（Internal URL）」を使用する**

バックエンドサービス同士（例：APIサーバーからマイクロサービス、またはRedis/DBへの接続）は、Renderのプライベートネットワーク内で通信すべきです。

*   ✅ **OK**: `fromService` と `property: hostport` を使用する。
    *   高速で、インターネットを経由しないためセキュアです。通常は `http://` プロトコルを使用します。

## トラブルシューティング

| エラーメッセージ | 原因 | 対策 |
| :--- | :--- | :--- |
| `curl: (6) Could not resolve host: my-service` | Cron Job等から内部ホスト名でアクセスしようとしている。 | 公開URL (`https://...onrender.com`) に変更する。 |
| `Failed to fetch` (Frontend) | フロントエンドが内部URL (`http://my-service:10000`) に接続しようとしている。 | 環境変数を公開URLに設定し直す。 |
| `invalid service property: url` | `render.yaml` でサポートされていないプロパティを指定した。 | `host` または `hostport` を使用するか、値を直接記述する。 |

## 推奨される render.yaml 構成例

```yaml
services:
  # 1. Backend Service
  - type: web
    name: my-backend
    region: singapore # シンガポールリージョンを指定
    runtime: python
    plan: starter # Starterプランを指定
    # ...

  # 2. Frontend (Static Site)
  - type: web
    name: my-frontend
    runtime: static
    envVars:
      - key: NEXT_PUBLIC_API_URL
        value: https://my-backend.onrender.com # 公開URLを指定

  # 3. Cron Job
  - type: cron
    name: my-cron
    schedule: "0 12 * * *"
    startCommand: curl -f https://my-backend.onrender.com/api/cron-task # 公開URLを指定

## 非推奨・アンチパターン（Deprecated & Anti-Patterns）

以下の設定は古い、または誤解を招くため使用しないでください。

*   ❌ **`autoDeploy`**: 非推奨です。代わりに `autoDeployTrigger` を使用してください（値: `commit`, `checksPass`, `off`）。
*   ❌ **`redis`**: Redisインスタンスの定義には `keyvalue` を使用してください。
*   ❌ **`property: url`**: 存在しないプロパティです。内部接続には `hostport`、公開接続にはハードコードされたURLを使用してください。
*   ❌ **Dashboardでの手動変更**: `render.yaml` (Blueprint) を使用している場合、Dashboardでの変更は次回の同期で上書きされる可能性があります。`render.yaml` を正（Source of Truth）としてください。

## 最新情報（Latest Updates）

*   **`projects` / `ungrouped`**: 2025年10月以降、トップレベルで `projects` や `ungrouped` フィールドがサポートされ、より高度なリソース管理が可能になりました。
*   **Preview Environments**: `previews.generation` キーで `manual` または `automatic` を設定することで、プルリクエストごとのプレビュー環境を制御できます。

---
*情報取得日: 2025-11-29*
```
