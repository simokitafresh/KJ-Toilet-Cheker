'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Staff, Toilet } from '@/lib/types';
import { Camera, Check, AlertCircle } from 'lucide-react';
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

    useEffect(() => {
        // Load master data
        Promise.all([api.getStaff(), api.getToilets()])
            .then(([staffData, toiletData]) => {
                setStaffList(staffData);
                setToilets(toiletData);
                if (toiletData.length > 0) {
                    setSelectedToiletId(toiletData[0].id);
                }
            })
            .catch(err => setError('Failed to load data'));
    }, []);

    const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);

            // Resize images
            const resizedFiles = await Promise.all(files.map(resizeImage));
            setImages(prev => [...prev, ...resizedFiles]);

            if (images.length + files.length >= 2) {
                setStep('staff');
            }
        }
    };

    const resizeImage = (file: File): Promise<File> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1280;

                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    } else {
                        resolve(file); // Fallback
                    }
                }, 'image/jpeg', 0.75);
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const handleStaffSelect = async (staffId: number) => {
        console.log('handleStaffSelect called', { staffId, selectedToiletId, imagesLength: images.length });

        if (!selectedToiletId) {
            alert('トイレが選択されていません。管理者に連絡してください。');
            console.error('No toilet selected');
            return;
        }
        if (images.length < 2) {
            setError('Please take at least 2 photos');
            setStep('camera');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('toilet_id', selectedToiletId.toString());
            formData.append('staff_id', staffId.toString());

            // Generate UUID if not exists
            let deviceUuid = localStorage.getItem('device_uuid');
            if (!deviceUuid) {
                deviceUuid = crypto.randomUUID();
                localStorage.setItem('device_uuid', deviceUuid);
            }
            formData.append('device_uuid', deviceUuid);

            images.forEach((img) => {
                formData.append('images', img);
            });

            console.log('Submitting check...', Object.fromEntries(formData.entries()));
            await api.submitCheck(formData);
            console.log('Submission successful');

            // Success
            alert('記録しました'); // Simple alert as per spec (or toast)
            router.push('/'); // Go back to home/dashboard? Spec says "Main screen"
            // Assuming root is dashboard or capture? 
            // Spec says: "Auto return to main screen". 
            // If /capture is the main screen for staff, maybe reset state?
            setImages([]);
            setStep('camera');
        } catch (err) {
            console.error('Submission failed', err);
            setError('送信に失敗しました。もう一度試してください。');
            alert('送信に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (step === 'camera') {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 p-4 flex flex-col items-center justify-center">
                <h1 className="text-2xl mb-8 font-bold text-slate-700">トイレチェック撮影</h1>

                {toilets.length > 1 && (
                    <select
                        className="mb-4 p-2 bg-white border border-slate-300 rounded shadow-sm text-slate-700"
                        value={selectedToiletId || ''}
                        onChange={(e) => setSelectedToiletId(Number(e.target.value))}
                    >
                        {toilets.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                )}

                <div className="mb-4 text-center">
                    <p className="text-slate-600">現在: {images.length}枚</p>
                    {images.length < 2 && <p className="text-red-500 text-sm">最低2枚必要です</p>}
                </div>

                <label className="w-64 h-64 bg-teal-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-transform hover:bg-teal-500 text-white">
                    <Camera size={64} />
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        className="hidden"
                        onChange={handleImageCapture}
                    />
                </label>

                <p className="mt-4 text-slate-500">タップして撮影（連続可）</p>

                {images.length >= 2 && (
                    <button
                        onClick={() => setStep('staff')}
                        className="mt-8 px-8 py-3 bg-teal-600 text-white rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-teal-500 transition-colors"
                    >
                        次へ進む <Check />
                    </button>
                )}

                {error && <div className="mt-4 text-red-500 flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4">
            <h2 className="text-xl text-center mb-6 text-slate-700">担当者を選択してください</h2>

            <div className="grid grid-cols-4 gap-4">
                {staffList.map(staff => (
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
                onClick={() => setStep('camera')}
                className="mt-8 w-full py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
            >
                戻る
            </button>
        </div>
    );
}
