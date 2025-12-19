# Future-004: メイン画面の日本語化とナビゲーション改善

**作成日:** 2025-12-19  
**ステータス:** ✅ 実装完了  
**優先度:** 高

---

## 概要

メイン画面（ホーム画面）を日本語表記にし、各画面間のナビゲーションを改善する。

---

## 現状（ASIS）

### メイン画面
- 英語表記または技術的な表記が混在
- 各機能へのリンクがわかりにくい

### ナビゲーション
- 各画面からホーム画面へ戻る手段が不明確
- adminログインへの導線がない

---

## 目標（TOBE）

### メイン画面の構成

```
┌─────────────────────────────────────┐
│         トイレチェック管理           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │        📷 撮影              │   │
│  │   トイレチェックを記録する    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      📊 ダッシュボード       │   │
│  │   今日のチェック状況を確認    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      📖 ユーザーガイド       │   │
│  │   使い方を確認する           │   │
│  └─────────────────────────────┘   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│           🔐 管理者ログイン         │
│                                     │
└─────────────────────────────────────┘
```

### ボタン構成

| 項目 | 表示名 | リンク先 | 説明 |
|------|--------|----------|------|
| 1 | 📷 撮影 | `/capture` | トイレチェックを記録する |
| 2 | 📊 ダッシュボード | `/dashboard` | 今日のチェック状況を確認 |
| 3 | 📖 ユーザーガイド | `/guide` または外部リンク | 使い方を確認する |
| 4 | 🔐 管理者ログイン | `/admin` | 管理画面へ（Basic認証） |

### 各画面へのホームリンク追加

| 画面 | 現状 | 追加するもの |
|------|------|-------------|
| `/capture` | なし | **不要**（撮影フローを妨げない） |
| `/dashboard` | なし | 左上に「← ホーム」リンク |
| `/admin` | なし | 左上に「← ホーム」リンク |
| `/guide` | なし | 左上に「← ホーム」リンク |

---

## 実装詳細

### 1. ホーム画面（`/page.tsx`）

```tsx
// frontend/app/page.tsx

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">
        トイレチェック管理
      </h1>
      
      <div className="w-full max-w-sm space-y-4">
        {/* 撮影ボタン */}
        <Link href="/capture" className="block">
          <div className="bg-teal-600 text-white rounded-xl p-6 text-center shadow-lg hover:bg-teal-500 transition-colors">
            <div className="text-3xl mb-2">📷</div>
            <div className="text-xl font-bold">撮影</div>
            <div className="text-sm opacity-80">トイレチェックを記録する</div>
          </div>
        </Link>
        
        {/* ダッシュボードボタン */}
        <Link href="/dashboard" className="block">
          <div className="bg-blue-600 text-white rounded-xl p-6 text-center shadow-lg hover:bg-blue-500 transition-colors">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-xl font-bold">ダッシュボード</div>
            <div className="text-sm opacity-80">今日のチェック状況を確認</div>
          </div>
        </Link>
        
        {/* ユーザーガイドボタン */}
        <Link href="/guide" className="block">
          <div className="bg-slate-600 text-white rounded-xl p-6 text-center shadow-lg hover:bg-slate-500 transition-colors">
            <div className="text-3xl mb-2">📖</div>
            <div className="text-xl font-bold">ユーザーガイド</div>
            <div className="text-sm opacity-80">使い方を確認する</div>
          </div>
        </Link>
      </div>
      
      {/* 管理者ログイン */}
      <div className="mt-12">
        <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1">
          🔐 管理者ログイン
        </Link>
      </div>
    </div>
  );
}
```

### 2. 共通ヘッダーコンポーネント

```tsx
// frontend/components/HomeLink.tsx

import Link from 'next/link';

export function HomeLink() {
  return (
    <Link 
      href="/" 
      className="text-slate-600 hover:text-slate-800 flex items-center gap-1 text-sm"
    >
      ← ホーム
    </Link>
  );
}
```

### 3. 各画面への組み込み

```tsx
// 各ページのヘッダー部分に追加
import { HomeLink } from '@/components/HomeLink';

// レイアウト内
<header className="p-4">
  <HomeLink />
</header>
```

---

## ユーザーガイドページの実装

**方針:** 内部ページとして実装

```
/guide - 新規ページを作成
  - userguide-staff.md の内容をコンポーネント化
  - モバイルフレンドリーなデザイン
  - セクションごとに折りたたみ表示も検討
```

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `frontend/app/page.tsx` | ホーム画面を日本語化・リデザイン |
| `frontend/components/HomeLink.tsx` | 新規作成：ホームリンクコンポーネント |
| `frontend/app/dashboard/page.tsx` | ヘッダーにホームリンク追加 |
| `frontend/app/admin/page.tsx` | ヘッダーにホームリンク追加 |
| `frontend/app/guide/page.tsx` | 新規作成：ユーザーガイドページ |

---

## テスト項目

- [ ] ホーム画面が日本語で表示される
- [ ] 各ボタンから正しい画面に遷移する
- [ ] 各画面からホームに戻れる
- [ ] 管理者ログインボタンからadmin画面に遷移する
- [ ] モバイル表示で問題なく動作する
- [ ] PWAとしてホーム画面に追加した場合も正常動作

---

## 補足

### デザイン方針

- シンプルで直感的なUI
- 大きなタップ領域（モバイルファースト）
- 色分けで機能を区別
  - 撮影: ティール（メイン機能）
  - ダッシュボード: ブルー（閲覧機能）
  - ガイド: グレー（補助機能）
  - 管理者: 控えめなテキストリンク

### アクセシビリティ

- 十分なコントラスト比
- タップ領域は最低44x44px
- フォーカス状態の明確化
