'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { SimpleStatusResponse, ScheduledCheckStatus, RegularCheckStatus } from '@/lib/types';
import clsx from 'clsx';
import { X } from 'lucide-react';

// ステータスボックスコンポーネント
interface StatusBoxProps {
    label: string;
    status: 'pending' | 'ok' | 'warning' | 'alert';
    display: string;
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
        <div className={clsx(
            "p-3 rounded-lg border-2 text-center transition-all",
            styles[status]
        )}>
            <div className="text-xs text-slate-500 mb-1 font-medium">{label}</div>
            <div className="text-2xl mb-1">{icons[status]}</div>
            <div className="text-lg font-bold text-slate-700">{display}</div>
        </div>
    );
}

// 画像モーダルコンポーネント
interface ImageModalProps {
    imageUrl: string | null;
    onClose: () => void;
}

function ImageModal({ imageUrl, onClose }: ImageModalProps) {
    if (!imageUrl) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <button
                className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
                onClick={onClose}
            >
                <X size={24} />
            </button>
            <img
                src={imageUrl}
                alt="拡大画像"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}

// 朝/午後チェック用の表示文字列生成
function getScheduledDisplay(check: ScheduledCheckStatus): string {
    if (check.status === 'pending') {
        return '待機中';
    }
    if (check.time) {
        return check.time;
    }
    return '未';
}

// 定期チェック用の表示文字列生成
function getRegularDisplay(check: RegularCheckStatus): string {
    if (!check.is_active) {
        return '時間外';
    }
    return `${check.minutes_elapsed}分`;
}

export default function DashboardPage() {
    const [data, setData] = useState<SimpleStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalImage, setModalImage] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const res = await api.getSimpleStatus();
            setData(res);
            setError(null);
        } catch (err) {
            setError('データの取得に失敗しました');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // 30秒ごとに自動更新
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-400">読み込み中...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-red-500">{error || 'エラーが発生しました'}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            {/* Header */}
            <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 p-4 border-b border-slate-200">
                <div className="flex justify-between items-center">
                    <h1 className="text-lg font-bold text-slate-700">トイレチェック</h1>
                    <span className="text-sm text-slate-500">{data.current_time} 現在</span>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* アラートボックス 3列 */}
                <div className="grid grid-cols-3 gap-3">
                    <StatusBox
                        label={`朝 〜${data.morning_check.deadline}`}
                        status={data.morning_check.status}
                        display={getScheduledDisplay(data.morning_check)}
                    />
                    <StatusBox
                        label={`午後 〜${data.afternoon_check.deadline}`}
                        status={data.afternoon_check.status}
                        display={getScheduledDisplay(data.afternoon_check)}
                    />
                    <StatusBox
                        label="定期"
                        status={data.regular_check.is_active ? data.regular_check.status : 'pending'}
                        display={getRegularDisplay(data.regular_check)}
                    />
                </div>

                {/* 履歴テーブル */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                        <h2 className="text-sm font-semibold text-slate-600">本日のチェック履歴</h2>
                    </div>

                    {data.timeline.length > 0 ? (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium">時刻</th>
                                    <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium">担当</th>
                                    <th className="px-3 py-2 text-left text-xs text-slate-500 font-medium">画像</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.timeline.map((item) => {
                                    const isMissed = item.is_missed;
                                    return (
                                        <tr
                                            key={item.check_id}
                                            className={clsx(
                                                "border-b border-slate-50 last:border-0",
                                                isMissed && "bg-red-50"
                                            )}
                                        >
                                            <td className={clsx(
                                                "px-3 py-2 font-mono",
                                                isMissed ? "text-red-700 font-semibold" : "text-slate-700"
                                            )}>{item.time}</td>
                                            <td className="px-3 py-2 text-2xl">{item.staff_icon}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex gap-1">
                                                    {item.thumbnails.map((url, i) => (
                                                        <img
                                                            key={i}
                                                            src={url}
                                                            alt={`写真${i + 1}`}
                                                            className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                                                            onClick={() => setModalImage(url)}
                                                        />
                                                    ))}
                                                    {item.thumbnails.length === 0 && (
                                                        <span className="text-slate-300 text-sm">-</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="px-4 py-8 text-center text-slate-400">
                            本日のチェック記録はありません
                        </div>
                    )}
                </div>
            </div>

            {/* 画像モーダル */}
            <ImageModal imageUrl={modalImage} onClose={() => setModalImage(null)} />
        </div>
    );
}
