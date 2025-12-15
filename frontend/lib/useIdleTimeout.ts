'use client';

import { useEffect, useCallback } from 'react';

const IDLE_TIMEOUT = 60 * 1000; // 60秒

/**
 * 指定時間操作がなければコールバックを実行するフック
 * @param callback アイドル時に実行するコールバック
 * @param enabled 有効/無効
 */
export function useIdleTimeout(callback: () => void, enabled: boolean) {
    const stableCallback = useCallback(callback, [callback]);

    useEffect(() => {
        if (!enabled) return;

        let timer: NodeJS.Timeout;

        const resetTimer = () => {
            clearTimeout(timer);
            timer = setTimeout(stableCallback, IDLE_TIMEOUT);
        };

        // マウス/タッチ/キーボード操作を監視
        const events = ['mousemove', 'touchstart', 'keydown', 'scroll', 'click'];
        events.forEach(e => window.addEventListener(e, resetTimer));

        resetTimer(); // 初期化

        return () => {
            clearTimeout(timer);
            events.forEach(e => window.removeEventListener(e, resetTimer));
        };
    }, [stableCallback, enabled]);
}
