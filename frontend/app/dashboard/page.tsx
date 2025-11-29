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

    if (!selectedToiletId) return <div className="p-4 text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white pb-20">
            {/* Header */}
            <div className="sticky top-0 bg-gray-900 z-10 p-4 border-b border-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">Toilet Dashboard</h1>
                    {toilets.length > 1 && (
                        <select
                            className="bg-gray-800 rounded p-1"
                            value={selectedToiletId}
                            onChange={(e) => setSelectedToiletId(Number(e.target.value))}
                        >
                            {toilets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    )}
                </div>

                <div className="flex items-center justify-between bg-gray-800 rounded-lg p-2">
                    <button onClick={() => changeDate(-1)} className="p-2"><ChevronLeft /></button>
                    <div className="flex items-center gap-2 font-mono">
                        <Calendar size={16} /> {date}
                    </div>
                    <button onClick={() => changeDate(1)} className="p-2"><ChevronRight /></button>
                </div>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-400">Loading data...</div>
            ) : (
                <div className="p-4 space-y-6">
                    {/* Major Checkpoints */}
                    <section>
                        <h2 className="text-sm text-gray-400 mb-2 uppercase tracking-wider">Major Checkpoints</h2>
                        <div className="grid grid-cols-2 gap-2">
                            {data?.major_checkpoints.map((cp, i) => (
                                <div key={i} className={clsx(
                                    "p-3 rounded-lg border flex flex-col justify-between h-24",
                                    cp.status === 'completed' ? "bg-green-900/20 border-green-800" :
                                        cp.status === 'missed' ? "bg-red-900/20 border-red-800" :
                                            "bg-gray-800 border-gray-700"
                                )}>
                                    <div className="text-sm font-medium">{cp.name}</div>
                                    <div className="flex items-center gap-2">
                                        {cp.status === 'completed' ? <CheckCircle className="text-green-500" size={20} /> :
                                            cp.status === 'missed' ? <XCircle className="text-red-500" size={20} /> :
                                                <Clock className="text-gray-500" size={20} />}
                                        <span className={clsx(
                                            "text-lg font-bold",
                                            cp.status === 'completed' ? "text-green-400" :
                                                cp.status === 'missed' ? "text-red-400" : "text-gray-400"
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
                            <h2 className="text-sm text-gray-400 mb-2 uppercase tracking-wider">Alerts</h2>
                            <div className="space-y-2">
                                {data.realtime_alerts.map((alert, i) => (
                                    <div key={i} className={clsx(
                                        "p-4 rounded-lg flex items-center gap-3",
                                        alert.alert_level === 'alert' ? "bg-red-600 text-white" : "bg-yellow-600 text-black"
                                    )}>
                                        <AlertTriangle />
                                        <div>
                                            <div className="font-bold">{alert.toilet_name}</div>
                                            <div className="text-sm">{alert.minutes_elapsed} min elapsed</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Timeline */}
                    <section>
                        <h2 className="text-sm text-gray-400 mb-2 uppercase tracking-wider">Timeline</h2>
                        <div className="space-y-3">
                            {data?.timeline.map((item) => (
                                <div key={item.id} className="bg-gray-800 rounded-lg p-3 flex items-start gap-3">
                                    <div className="text-2xl bg-gray-700 rounded-full w-10 h-10 flex items-center justify-center">
                                        {item.staff_icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-mono text-lg">
                                                {new Date(item.checked_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className={clsx(
                                                "px-2 py-0.5 rounded text-xs font-bold",
                                                item.status_type === 'NORMAL' ? "bg-green-900 text-green-300" :
                                                    item.status_type === 'TOO_SHORT' ? "bg-yellow-900 text-yellow-300" :
                                                        "bg-red-900 text-red-300"
                                            )}>
                                                {item.status_type}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto">
                                            {item.thumbnails.map((url, idx) => (
                                                <div key={idx} className="relative w-16 h-16 flex-shrink-0 cursor-pointer" onClick={() => setSelectedImage(url)}>
                                                    {/* Use API_HOST for image URL if it's relative? 
                              The backend returns /images/..., which is relative to API host.
                              If frontend is on different domain, we need to prepend API_HOST.
                              Wait, Next.js Image needs absolute URL or configured domain.
                              Let's assume we need to prepend API_HOST if it's not starting with http.
                          */}
                                                    <img
                                                        src={`${process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:8000'}${url}`}
                                                        alt="check"
                                                        className="w-full h-full object-cover rounded border border-gray-600"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {data?.timeline.length === 0 && (
                                <div className="text-center text-gray-500 py-8">No checks recorded today</div>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {/* Image Modal */}
            {selectedImage && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
                    <img
                        src={`${process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:8000'}${selectedImage}`}
                        alt="Full view"
                        className="max-w-full max-h-full object-contain"
                    />
                </div>
            )}
        </div>
    );
}
