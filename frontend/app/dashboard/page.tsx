'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { DashboardDayResponse, Toilet } from '@/lib/types';
import { AlertTriangle, CheckCircle, Clock, XCircle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import Image from 'next/image';

export default function DashboardPage() {
    const [data, setData] = useState<DashboardDayResponse | null>(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [toilets, setToilets] = useState<Toilet[]>([]);
    const [selectedToiletId, setSelectedToiletId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        api.getToilets().then(t => {
            setToilets(t);
            if (t.length > 0) setSelectedToiletId(t[0].id);
        });
    }, []);

    useEffect(() => {
        if (selectedToiletId) {
            setLoading(true);
            api.getDashboardDay(date, selectedToiletId)
                .then(res => {
                    setData(res);
                    setLoading(false);
                })
                .catch(err => setLoading(false));
        }
    }, [date, selectedToiletId]);

    const changeDate = (delta: number) => {
        const d = new Date(date);
        d.setDate(d.getDate() + delta);
        setDate(d.toISOString().split('T')[0]);
    };

    if (!selectedToiletId) return <div className="p-4 text-slate-600">読み込み中...</div>;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
            {/* Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-4 border-b border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold text-slate-700">トイレ管理ダッシュボード</h1>
                    {toilets.length > 1 && (
                        <select
                            className="bg-white border border-slate-300 rounded p-1 text-slate-700 text-sm"
                            value={selectedToiletId}
                            onChange={(e) => setSelectedToiletId(Number(e.target.value))}
                        >
                            {toilets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    )}
                </div>

                <div className="flex items-center justify-between bg-slate-100 rounded-lg p-2 border border-slate-200">
                    <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white rounded transition-colors text-slate-600"><ChevronLeft /></button>
                    <div className="flex items-center gap-2 font-mono text-slate-700 font-bold">
                        <Calendar size={16} /> {date}
                    </div>
                    <button onClick={() => changeDate(1)} className="p-2 hover:bg-white rounded transition-colors text-slate-600"><ChevronRight /></button>
                </div>
            </div>

            {loading ? (
                <div className="p-8 text-center text-slate-400">データ読み込み中...</div>
            ) : (
                <div className="p-4 space-y-6">
                    {/* Major Checkpoints */}
                    <section>
                        <div className="mb-2">
                            <h2 className="text-sm text-slate-500 uppercase tracking-wider font-semibold">主要チェックポイント</h2>
                            <p className="text-xs text-slate-400">重要な時間帯のチェック状況です</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {data?.major_checkpoints.map((cp, i) => (
                                <div key={i} className={clsx(
                                    "p-3 rounded-lg border flex flex-col justify-between h-24 shadow-sm transition-all",
                                    cp.status === 'completed' ? "bg-green-50 border-green-200" :
                                        cp.status === 'missed' ? "bg-red-50 border-red-200" :
                                            "bg-white border-slate-200"
                                )}>
                                    <div className="text-sm font-medium text-slate-700">{cp.name}</div>
                                    <div className="flex items-center gap-2">
                                        {cp.status === 'completed' ? <CheckCircle className="text-green-600" size={20} /> :
                                            cp.status === 'missed' ? <XCircle className="text-red-500" size={20} /> :
                                                <Clock className="text-slate-400" size={20} />}
                                        <span className={clsx(
                                            "text-lg font-bold",
                                            cp.status === 'completed' ? "text-green-700" :
                                                cp.status === 'missed' ? "text-red-600" : "text-slate-400"
                                        )}>
                                            {cp.last_check_time || '--:--'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Alerts */}
                    {data?.realtime_alerts && data.realtime_alerts.length > 0 && (
                        <section>
                            <div className="mb-2">
                                <h2 className="text-sm text-slate-500 uppercase tracking-wider font-semibold">アラート</h2>
                                <p className="text-xs text-slate-400">長時間チェックされていないトイレがあります</p>
                            </div>
                            <div className="space-y-2">
                                {data.realtime_alerts.map((alert, i) => (
                                    <div key={i} className={clsx(
                                        "p-4 rounded-lg flex items-center gap-3 border shadow-sm",
                                        alert.alert_level === 'alert' ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
                                    )}>
                                        <AlertTriangle className={alert.alert_level === 'alert' ? "text-red-600" : "text-amber-600"} />
                                        <div>
                                            <div className="font-bold">{alert.toilet_name}</div>
                                            <div className="text-sm">{alert.minutes_elapsed}分 経過</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Timeline */}
                    <section>
                        <div className="mb-2">
                            <h2 className="text-sm text-slate-500 uppercase tracking-wider font-semibold">タイムライン</h2>
                            <p className="text-xs text-slate-400">本日のチェック履歴一覧です</p>
                        </div>
                        <div className="space-y-3">
                            {data?.timeline.map((item) => (
                                <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-3 shadow-sm">
                                    <div className="text-2xl bg-slate-100 border border-slate-200 rounded-full w-10 h-10 flex items-center justify-center">
                                        {item.staff_icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-mono text-lg text-slate-700 font-bold">
                                                {new Date(item.checked_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className={clsx(
                                                "px-2 py-0.5 rounded text-xs font-bold border",
                                                item.status_type === 'NORMAL' ? "bg-green-100 text-green-800 border-green-200" :
                                                    item.status_type === 'TOO_SHORT' ? "bg-amber-100 text-amber-800 border-amber-200" :
                                                        "bg-red-100 text-red-800 border-red-200"
                                            )}>
                                                {item.status_type === 'NORMAL' ? '正常' :
                                                    item.status_type === 'TOO_SHORT' ? '短時間' : '異常'}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                            {item.thumbnails.map((url, idx) => (
                                                <div key={idx} className="relative w-16 h-16 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedImage(url)}>
                                                    <img
                                                        src={`${process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:8000'}${url}`}
                                                        alt="check"
                                                        className="w-full h-full object-cover rounded border border-slate-200"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {data?.timeline.length === 0 && (
                                <div className="text-center text-slate-400 py-8 italic">本日のチェック記録はありません</div>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {/* Image Modal */}
            {selectedImage && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
                    <img
                        src={`${process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:8000'}${selectedImage}`}
                        alt="Full view"
                        className="max-w-full max-h-full object-contain rounded shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
}
