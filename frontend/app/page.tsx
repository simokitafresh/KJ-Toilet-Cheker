import Link from 'next/link';
import { Camera, LayoutDashboard, BookOpen, Lock } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-8 text-slate-700">トイレチェック管理</h1>

      <div className="grid gap-4 w-full max-w-sm">
        {/* 撮影ボタン */}
        <Link href="/capture" className="bg-teal-600 p-6 rounded-xl text-center hover:bg-teal-500 transition-colors text-white shadow-lg">
          <div className="flex justify-center mb-2">
            <Camera size={36} />
          </div>
          <div className="text-xl font-bold">撮影</div>
          <div className="text-sm text-teal-100">トイレチェックを記録する</div>
        </Link>

        {/* ダッシュボードボタン */}
        <Link href="/dashboard" className="bg-blue-600 p-6 rounded-xl text-center hover:bg-blue-500 transition-colors text-white shadow-lg">
          <div className="flex justify-center mb-2">
            <LayoutDashboard size={36} />
          </div>
          <div className="text-xl font-bold">ダッシュボード</div>
          <div className="text-sm text-blue-100">今日のチェック状況を確認</div>
        </Link>

        {/* ユーザーガイドボタン */}
        <Link href="/guide" className="bg-slate-600 p-6 rounded-xl text-center hover:bg-slate-500 transition-colors text-white shadow-lg">
          <div className="flex justify-center mb-2">
            <BookOpen size={36} />
          </div>
          <div className="text-xl font-bold">ユーザーガイド</div>
          <div className="text-sm text-slate-300">使い方を確認する</div>
        </Link>
      </div>

      {/* 管理者ログイン */}
      <div className="mt-12">
        <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1 transition-colors">
          <Lock size={14} />
          管理者ログイン
        </Link>
      </div>
    </div>
  );
}
