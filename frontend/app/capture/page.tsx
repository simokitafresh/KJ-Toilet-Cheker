'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { Staff, Toilet } from '@/lib/types';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CapturePage() {
    const router = useRouter();
    const [step, setStep] = useState<'camera' | 'staff'>('camera');
    const [images, setImages] = useState<File[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [toilets, setToilets] = useState<Toilet[]>([]);
    const [selectedToiletId, setSelectedToiletId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // カメラ起動
    const startCamera = useCallback(async () => {
        try {
            setCameraError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    setCameraReady(true);
                };
            }
        } catch {
            setCameraError('カメラを起動できませんでした。カメラへのアクセスを許可してください。');
        }
    }, []);

    // カメラ停止
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraReady(false);
    };

    useEffect(() => {
        // マスターデータの読み込み
        Promise.all([api.getStaff(), api.getToilets()])
            .then(([staffData, toiletData]) => {
                setStaffList(staffData);
                setToilets(toiletData);
                if (toiletData.length > 0) {
                    setSelectedToiletId(toiletData[0].id);
                }
            })
            .catch(() => setError('データの読み込みに失敗しました'));
    }, []);

    // カメラステップの時にカメラを起動
    useEffect(() => {
        if (step === 'camera') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [step, startCamera]);

    // 写真撮影（タップで即座にキャプチャ）
    const capturePhoto = () => {
        if (!videoRef.current || !cameraReady) return;
        setError(null); // エラーをクリア

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
                const newImages = [...images, file];
                setImages(newImages);
                
                // 2枚で自動遷移
                if (newImages.length >= 2) {
                    setStep('staff');
                }
            }
        }, 'image/jpeg', 0.85);
    };

    const handleStaffSelect = async (staffId: number) => {
        if (!selectedToiletId) {
            alert('トイレが選択されていません。管理者に連絡してください。');
            return;
        }
        if (images.length < 2) {
            setError('写真を2枚以上撮影してください');
            setStep('camera');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('toilet_id', selectedToiletId.toString());
            formData.append('staff_id', staffId.toString());

            // デバイスUUIDの取得または生成
            let deviceUuid = localStorage.getItem('device_uuid');
            if (!deviceUuid) {
                deviceUuid = crypto.randomUUID();
                localStorage.setItem('device_uuid', deviceUuid);
            }
            formData.append('device_uuid', deviceUuid);

            images.forEach((img) => {
                formData.append('images', img);
            });

            await api.submitCheck(formData);

            // 成功 - ステートをリセットしてから遷移
            setImages([]);
            setStep('camera');
            setError(null);
            alert('記録しました');
            router.push('/');
        } catch (err) {
            const message = err instanceof Error ? err.message : '不明なエラー';
            setError(`送信に失敗しました: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (step === 'camera') {
        return (
            <div className="camera-container bg-slate-800 text-slate-800">
                {/* トイレ選択（複数ある場合のみ） */}
                {toilets.length > 1 && (
                    <div className="flex-shrink-0 bg-white px-4 py-2 border-b border-slate-200">
                        <select
                            className="w-full p-2 bg-white border border-slate-300 rounded text-slate-800"
                            value={selectedToiletId || ''}
                            onChange={(e) => setSelectedToiletId(Number(e.target.value))}
                        >
                            {toilets.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* カメラプレビュー - 残りスペースを使用 */}
                <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
                    {cameraError ? (
                        <div className="text-center p-4">
                            <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
                            <p className="text-red-400">{cameraError}</p>
                            <button 
                                onClick={startCamera}
                                className="mt-4 px-4 py-2 bg-teal-600 text-white rounded"
                            >
                                再試行
                            </button>
                        </div>
                    ) : (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                    )}

                    {/* 撮影枚数オーバーレイ - 上部に表示 */}
                    {images.length === 1 && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 px-4 py-2 rounded-full font-bold shadow-md">
                            あと1枚！
                        </div>
                    )}
                </div>

                {/* フッター - シャッターボタンと撮影枚数 */}
                <div className="flex-shrink-0 bg-teal-600 px-4 py-2 flex items-center justify-between safe-area-bottom">
                    {/* 左側: 撮影枚数 */}
                    <div className="text-white w-16">
                        <span className="text-xl font-bold">{images.length}</span>
                        <span className="text-teal-100 text-sm">/2枚</span>
                    </div>

                    {/* 中央: シャッターボタン */}
                    <button
                        onClick={capturePhoto}
                        disabled={!cameraReady}
                        className="rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                        style={{ width: '56px', height: '56px' }}
                    >
                        <div className="bg-teal-600 rounded-full" style={{ width: '44px', height: '44px' }} />
                    </button>

                    {/* 右側: スペーサー（バランス用） */}
                    <div className="w-16"></div>
                </div>

                {error && (
                    <div className="flex-shrink-0 bg-red-100 border-t border-red-300 p-3 text-center text-red-700">
                        <AlertCircle size={16} className="inline mr-2" />
                        {error}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4">
            <h2 className="text-xl text-center mb-6 text-slate-700">担当者を選択してください</h2>

            <div className="grid grid-cols-4 gap-4">
                {staffList.filter(s => s.is_active !== false).map(staff => (
                    <button
                        key={staff.id}
                        onClick={() => handleStaffSelect(staff.id)}
                        disabled={isSubmitting}
                        className="aspect-square bg-white border border-slate-200 rounded-xl text-4xl flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
                    >
                        {staff.icon_code}
                    </button>
                ))}
            </div>

            {isSubmitting && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-4"></div>
                        <div className="text-slate-700 text-xl">送信中...</div>
                    </div>
                </div>
            )}

            {error && <div className="mt-4 text-red-500 flex items-center gap-2 justify-center"><AlertCircle size={16} /> {error}</div>}

            <button
                onClick={() => {
                    if (confirm('撮影画面に戻りますか？撮影した写真はリセットされます。')) {
                        setImages([]);
                        setStep('camera');
                    }
                }}
                className="mt-8 w-full py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
            >
                戻る（写真リセット）
            </button>
        </div>
    );
}
