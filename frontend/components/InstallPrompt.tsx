'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsVisible(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 bg-white text-slate-800 p-4 rounded-lg shadow-xl border border-slate-200 flex items-center justify-between z-50 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center gap-3">
                <div className="bg-teal-50 p-2 rounded-full text-teal-600">
                    <Download size={24} />
                </div>
                <div>
                    <p className="font-bold text-slate-800">アプリをインストール</p>
                    <p className="text-sm text-slate-500">ホーム画面に追加して素早くアクセス</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsVisible(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                    <X size={20} />
                </button>
                <button
                    onClick={handleInstall}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-500 transition-colors shadow-sm"
                >
                    インストール
                </button>
            </div>
        </div>
    );
}
