'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, API_HOST } from '@/lib/api';
import { SimpleStatusResponse, ScheduledCheckStatus, RegularCheckStatus } from '@/lib/types';
import { useIdleTimeout } from '@/lib/useIdleTimeout';
import { HomeLink } from '@/components/HomeLink';
import clsx from 'clsx';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

// 日付ユーティリティ
function formatDateJp(date: Date): string {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];
    return `${month}月${day}日（${dayOfWeek}）`;
}

function toDateString(date: Date): string {
    // ローカルタイムゾーンでYYYY-MM-DD形式に変換
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
    return d1.toDateString() === d2.toDateString();
}

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
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [toast, setToast] = useState<string | null>(null);

    // todayをuseMemoで安定化（日付が変わらない限り再生成しない）
    const today = useMemo(() => new Date(), []);
    const isToday = isSameDay(selectedDate, today);

    // トースト表示
    const showToast = useCallback((message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    }, []);

    // 今日に戻る
    const goToToday = useCallback(() => {
        setSelectedDate(new Date());
    }, []);

    // アイドルタイムアウト（今日以外のとき有効）
    useIdleTimeout(() => {
        goToToday();
        showToast('自動で今日に戻りました');
    }, !isToday);

    // 前日へ
    const goToPrevDay = () => {
        const prev = new Date(selectedDate);
        prev.setDate(prev.getDate() - 1);
        setSelectedDate(prev);
    };

    // 翌日へ
    const goToNextDay = () => {
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + 1);
        if (!isSameDay(next, today) && next > today) return;
        setSelectedDate(next);
    };

    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const dateStr = toDateString(selectedDate);
            const res = await api.getSimpleStatus(isToday ? undefined : dateStr);
            setData(res);
            setError(null);
        } catch (err) {
            setError('データの取得に失敗しました');
            console.error(err);
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [selectedDate, isToday]);

    useEffect(() => {
        fetchData(true);  // 初回は表示
        // 今日の場合のみ30秒ごとに自動更新（ローディング非表示）
        if (isToday) {
            const interval = setInterval(() => fetchData(false), 30000);
            return () => clearInterval(interval);
        }
    }, [fetchData, isToday]);

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
            {/* Header with Date Navigation */}
            <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 p-4 border-b border-slate-200">
                <div className="flex justify-between items-center mb-2">
                    <HomeLink />
                    {data.current_time && (
                        <span className="text-sm text-slate-500">{data.current_time} 現在</span>
                    )}
                </div>
                <div className="text-center mb-2">
                    <h1 className="text-lg font-bold text-slate-700">トイレチェック</h1>
                </div>
                {/* Date Navigation */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={goToPrevDay}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={18} />
                        <span>前日</span>
                    </button>
                    <div className="text-center">
                        <span className={clsx(
                            "text-base font-semibold",
                            isToday ? "text-slate-700" : "text-blue-600"
                        )}>
                            📅 {formatDateJp(selectedDate)}
                        </span>
                    </div>
                    <button
                        onClick={goToNextDay}
                        disabled={isToday}
                        className={clsx(
                            "flex items-center gap-1 px-3 py-1 text-sm rounded-lg transition-colors",
                            isToday
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                    >
                        <span>翌日</span>
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* 休診日・診療時間外メッセージ */}
                {(data.is_closed || data.is_outside_hours) && isToday ? (
                    <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
                        {data.is_closed ? (
                            <>
                                <div className="text-4xl mb-3">🏥</div>
                                <div className="text-lg font-bold text-slate-700 mb-1">本日は休診日です</div>
                                <div className="text-sm text-slate-500">チェックは不要です</div>
                            </>
                        ) : data.business_message ? (
                            <>
                                <div className="text-lg font-medium text-slate-700 whitespace-pre-line">
                                    {data.business_message.split(' ').slice(0, 2).join(' ')}
                                </div>
                                <div className="text-sm text-slate-500 mt-2">
                                    {data.business_message.split(' ').slice(2).join(' ')}
                                </div>
                            </>
                        ) : null}
                    </div>
                ) : (
                    /* アラートボックス 3列 */
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
                )}

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
                                                    {item.thumbnails.map((url, i) => {
                                                        const fullUrl = `${API_HOST}${url}`;
                                                        return (
                                                            <img
                                                                key={i}
                                                                src={fullUrl}
                                                                alt={`写真${i + 1}`}
                                                                className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                                                                onClick={() => setModalImage(fullUrl)}
                                                            />
                                                        );
                                                    })}
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
                            {isToday ? '本日のチェック記録はありません' : 'この日のチェック記録はありません'}
                        </div>
                    )}
                </div>
            </div>

            {/* 画像モーダル */}
            <ImageModal imageUrl={modalImage} onClose={() => setModalImage(null)} />

            {/* 今日に戻るフローティングボタン */}
            {!isToday && (
                <button
                    onClick={goToToday}
                    className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg transition-colors flex items-center gap-2 z-20"
                >
                    <span>📍</span>
                    <span>今日に戻る</span>
                </button>
            )}

            {/* トースト通知 */}
            {toast && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-30 animate-fade-in">
                    {toast}
                </div>
            )}
        </div>
    );
}
