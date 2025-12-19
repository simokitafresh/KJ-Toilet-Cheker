'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Staff, Toilet } from '@/lib/types';
import { HomeLink } from '@/components/HomeLink';
import { Trash2, Plus, Edit, X, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';

export default function AdminPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [creds, setCreds] = useState('');
    const [activeTab, setActiveTab] = useState<'staff' | 'toilets' | 'settings'>('staff');

    // Data
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [inactiveStaffList, setInactiveStaffList] = useState<Staff[]>([]);
    const [showInactive, setShowInactive] = useState(false);
    const [toilets, setToilets] = useState<Toilet[]>([]);

    // Staff Modal State
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Partial<Staff> & { isNew?: boolean }>({});

    // Settings State
    const [closedDays, setClosedDays] = useState<number[]>([]);
    const [businessHoursStart, setBusinessHoursStart] = useState('07:00');
    const [businessHoursEnd, setBusinessHoursEnd] = useState('22:00');
    const [settingsLoading, setSettingsLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const c = btoa(`${username}:${password}`);
        setCreds(c);
        api.admin.getStaff(c)
            .then(res => {
                setIsLoggedIn(true);
                setStaffList(res.filter(s => s.is_active !== false));
                setInactiveStaffList(res.filter(s => s.is_active === false));
            })
            .catch(() => alert('ログインに失敗しました'));
    };

    useEffect(() => {
        if (isLoggedIn) {
            if (activeTab === 'staff') loadStaff();
            if (activeTab === 'toilets') loadToilets();
            if (activeTab === 'settings') loadSettings();
        }
    }, [isLoggedIn, activeTab]);

    const loadStaff = async () => {
        const res = await api.admin.getStaff(creds, true);
        setStaffList(res.filter((s: Staff) => s.is_active !== false));
        setInactiveStaffList(res.filter((s: Staff) => s.is_active === false));
    };
    const loadToilets = () => api.admin.getToilets(creds).then(setToilets);

    const loadSettings = async () => {
        setSettingsLoading(true);
        try {
            const settings = await api.admin.getSettings(creds);
            const closedDaysConfig = settings.find(s => s.key === 'closed_days');
            const startConfig = settings.find(s => s.key === 'business_hours_start');
            const endConfig = settings.find(s => s.key === 'business_hours_end');

            if (closedDaysConfig && closedDaysConfig.value) {
                setClosedDays(closedDaysConfig.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d)));
            }
            if (startConfig) setBusinessHoursStart(startConfig.value);
            if (endConfig) setBusinessHoursEnd(endConfig.value);
        } catch (e) {
            console.error('Failed to load settings', e);
        } finally {
            setSettingsLoading(false);
        }
    };

    const saveSettings = async () => {
        try {
            await Promise.all([
                api.admin.updateSetting(creds, 'closed_days', closedDays.join(',')),
                api.admin.updateSetting(creds, 'business_hours_start', businessHoursStart),
                api.admin.updateSetting(creds, 'business_hours_end', businessHoursEnd)
            ]);
            alert('設定を保存しました');
        } catch (e) {
            alert('保存に失敗しました');
        }
    };

    const toggleClosedDay = (day: number) => {
        if (closedDays.includes(day)) {
            setClosedDays(closedDays.filter(d => d !== day));
        } else {
            setClosedDays([...closedDays, day].sort());
        }
    };

    // Staff Actions
    const openStaffModal = (staff?: Staff) => {
        if (staff) {
            setEditingStaff({ ...staff });
        } else {
            setEditingStaff({ internal_name: '', icon_code: '', isNew: true });
        }
        setIsStaffModalOpen(true);
    };

    const saveStaff = async () => {
        if (!editingStaff.internal_name || !editingStaff.icon_code) {
            alert('名前とアイコンを入力してください');
            return;
        }

        try {
            if (editingStaff.isNew) {
                await api.admin.createStaff(creds, {
                    internal_name: editingStaff.internal_name,
                    icon_code: editingStaff.icon_code
                });
            } else if (editingStaff.id) {
                await api.admin.updateStaff(creds, editingStaff.id, {
                    internal_name: editingStaff.internal_name,
                    icon_code: editingStaff.icon_code
                });
            }
            setIsStaffModalOpen(false);
            loadStaff();
        } catch (e) {
            alert('保存に失敗しました');
        }
    };

    const deleteStaff = async (id: number) => {
        if (confirm('このスタッフを削除しますか？（後から復元できます）')) {
            await api.admin.deleteStaff(creds, id);
            loadStaff();
        }
    };

    const restoreStaff = async (id: number) => {
        try {
            await api.admin.updateStaff(creds, id, { is_active: true });
            loadStaff();
        } catch (e) {
            alert('復元に失敗しました');
        }
    };

    const moveStaff = async (index: number, direction: 'up' | 'down') => {
        const newList = [...staffList];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newList.length) return;

        [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];

        const staffIds = newList.map(s => s.id);
        try {
            await api.admin.reorderStaff(creds, staffIds);
            setStaffList(newList);
        } catch (e) {
            alert('並び替えに失敗しました');
            loadStaff();
        }
    };

    // Toilet Actions
    const handleAddToilet = async () => {
        const name = prompt('トイレの名称を入力してください (例: 1Fトイレ):');
        if (name) {
            try {
                await api.admin.createToilet(creds, { name });
                loadToilets();
            } catch (e) {
                alert('追加に失敗しました（最大2箇所までです）');
            }
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4">
                <div className="absolute top-4 left-4">
                    <HomeLink />
                </div>
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-lg w-96 border border-slate-200">
                    <h1 className="text-2xl font-bold mb-6 text-center text-slate-700">管理者ログイン</h1>
                    <div className="mb-4">
                        <label className="block text-sm mb-2 text-slate-600">ユーザー名</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm mb-2 text-slate-600">パスワード</label>
                        <input
                            type="password"
                            className="w-full p-2 rounded bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="w-full bg-teal-600 text-white py-2 rounded font-bold hover:bg-teal-500 transition-colors shadow-sm">
                        ログイン
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
            <div className="mb-4">
                <HomeLink />
            </div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-slate-700">管理パネル</h1>
                <button onClick={() => setIsLoggedIn(false)} className="text-slate-500 hover:text-slate-800 transition-colors">ログアウト</button>
            </div>

            <div className="flex gap-4 mb-6 border-b border-slate-200 pb-2">
                <button
                    className={`px-4 py-2 rounded transition-colors ${activeTab === 'staff' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                    onClick={() => setActiveTab('staff')}
                >
                    スタッフ管理
                </button>
                <button
                    className={`px-4 py-2 rounded transition-colors ${activeTab === 'toilets' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                    onClick={() => setActiveTab('toilets')}
                >
                    トイレ管理
                </button>
                <button
                    className={`px-4 py-2 rounded transition-colors ${activeTab === 'settings' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                    onClick={() => setActiveTab('settings')}
                >
                    設定
                </button>
            </div>

            {activeTab === 'staff' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-700">スタッフ管理</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                スタッフの追加・編集・削除・並び替えを行います
                            </p>
                        </div>
                        <button onClick={() => openStaffModal()} className="bg-teal-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-500 shadow-sm transition-colors">
                            <Plus size={16} /> スタッフ追加
                        </button>
                    </div>

                    <div className="grid gap-2">
                        {staffList.map((staff, index) => (
                            <div key={staff.id} className="bg-white border border-slate-200 p-4 rounded flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <button
                                            onClick={() => moveStaff(index, 'up')}
                                            disabled={index === 0}
                                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="上に移動"
                                        >
                                            <ChevronUp size={16} />
                                        </button>
                                        <button
                                            onClick={() => moveStaff(index, 'down')}
                                            disabled={index === staffList.length - 1}
                                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="下に移動"
                                        >
                                            <ChevronDown size={16} />
                                        </button>
                                    </div>
                                    <span className="text-3xl">{staff.icon_code}</span>
                                    <div>
                                        <div className="font-bold text-slate-800">{staff.internal_name}</div>
                                        <div className="text-sm text-slate-400">表示順: {index + 1}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openStaffModal(staff)}
                                        className="p-2 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                                        title="編集"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => deleteStaff(staff.id)}
                                        className="p-2 text-red-400 hover:bg-red-50 rounded transition-colors"
                                        title="削除"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {inactiveStaffList.length > 0 && (
                        <div className="mt-6">
                            <button
                                onClick={() => setShowInactive(!showInactive)}
                                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                            >
                                {showInactive ? '▼' : '▶'} 削除済みスタッフを表示 ({inactiveStaffList.length}件)
                            </button>

                            {showInactive && (
                                <div className="mt-2 grid gap-2">
                                    {inactiveStaffList.map(staff => (
                                        <div key={staff.id} className="bg-slate-100 border border-slate-200 p-4 rounded flex justify-between items-center opacity-60">
                                            <div className="flex items-center gap-4">
                                                <span className="text-3xl grayscale">{staff.icon_code}</span>
                                                <div>
                                                    <div className="font-bold text-slate-600">{staff.internal_name}</div>
                                                    <div className="text-sm text-red-400">削除済み</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => restoreStaff(staff.id)}
                                                className="p-2 text-teal-600 hover:bg-teal-50 rounded transition-colors flex items-center gap-1"
                                                title="復元"
                                            >
                                                <RotateCcw size={16} /> 復元
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'toilets' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-700">トイレ管理</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                管理対象のトイレを登録します（最大2箇所まで）
                            </p>
                        </div>
                        <button onClick={handleAddToilet} className="bg-teal-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-500 shadow-sm transition-colors">
                            <Plus size={16} /> トイレ追加
                        </button>
                    </div>
                    <div className="grid gap-4">
                        {toilets.map(toilet => (
                            <div key={toilet.id} className="bg-white border border-slate-200 p-4 rounded flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="font-bold text-slate-800">{toilet.name}</div>
                                    <div className="text-sm text-slate-400">{toilet.floor || '階数情報なし'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-slate-700">診療設定</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            休診日と診療時間を設定します
                        </p>
                    </div>

                    {settingsLoading ? (
                        <div className="text-center py-8 text-slate-400">読み込み中...</div>
                    ) : (
                        <div className="space-y-6">
                            {/* 休診曜日 */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                <h3 className="font-bold text-slate-700 mb-3">休診曜日</h3>
                                <div className="flex flex-wrap gap-2">
                                    {['月', '火', '水', '木', '金', '土', '日'].map((name, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => toggleClosedDay(idx)}
                                            className={`px-4 py-2 rounded-lg border transition-colors ${closedDays.includes(idx)
                                                ? 'bg-red-100 border-red-300 text-red-700'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    選択した曜日は休診日としてアラートが停止します
                                </p>
                            </div>

                            {/* 診療時間 */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                <h3 className="font-bold text-slate-700 mb-3">診療時間</h3>
                                <div className="flex items-center gap-4">
                                    <div>
                                        <label className="block text-sm text-slate-600 mb-1">開始</label>
                                        <input
                                            type="time"
                                            value={businessHoursStart}
                                            onChange={e => setBusinessHoursStart(e.target.value)}
                                            className="border border-slate-300 rounded p-2 text-slate-800"
                                        />
                                    </div>
                                    <span className="text-slate-400 mt-6">〜</span>
                                    <div>
                                        <label className="block text-sm text-slate-600 mb-1">終了</label>
                                        <input
                                            type="time"
                                            value={businessHoursEnd}
                                            onChange={e => setBusinessHoursEnd(e.target.value)}
                                            className="border border-slate-300 rounded p-2 text-slate-800"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    診療時間外はアラートが停止し、メッセージが表示されます
                                </p>
                            </div>

                            {/* 保存ボタン */}
                            <button
                                onClick={saveSettings}
                                className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-500 transition-colors shadow-sm"
                            >
                                設定を保存
                            </button>
                        </div>
                    )}
                </div>
            )}

            {isStaffModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-700">
                                {editingStaff.isNew ? 'スタッフ追加' : 'スタッフ編集'}
                            </h3>
                            <button onClick={() => setIsStaffModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">名前（内部管理用）</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded p-2 text-slate-800"
                                    value={editingStaff.internal_name || ''}
                                    onChange={e => setEditingStaff({ ...editingStaff, internal_name: e.target.value })}
                                    placeholder="例: 田中さん"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">アイコン（絵文字）</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded p-2 text-slate-800 text-2xl text-center"
                                    value={editingStaff.icon_code || ''}
                                    onChange={e => setEditingStaff({ ...editingStaff, icon_code: e.target.value })}
                                    placeholder="🐶"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    動物絵文字や👨‍⚕️（医師）、👩‍⚕️（看護師）などが使えます
                                </p>
                            </div>

                            {editingStaff.icon_code && (
                                <div className="bg-slate-50 p-4 rounded text-center">
                                    <p className="text-sm text-slate-500 mb-2">プレビュー</p>
                                    <span className="text-5xl">{editingStaff.icon_code}</span>
                                    <p className="mt-2 text-slate-700">{editingStaff.internal_name}</p>
                                </div>
                            )}

                            <button
                                onClick={saveStaff}
                                className="w-full bg-teal-600 text-white py-2 rounded font-bold hover:bg-teal-500 transition-colors mt-4"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
