'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Staff, Toilet, MajorCheckpoint } from '@/lib/types';
import { Trash2, Plus, Save, Edit, X, Settings } from 'lucide-react';

export default function AdminPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [creds, setCreds] = useState('');
    const [activeTab, setActiveTab] = useState<'staff' | 'toilets' | 'checkpoints' | 'settings'>('staff');

    // Data
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [toilets, setToilets] = useState<Toilet[]>([]);
    const [checkpoints, setCheckpoints] = useState<MajorCheckpoint[]>([]);
    const [settings, setSettings] = useState<{ key: string, value: string }[]>([]);

    // Modal State
    const [isCpModalOpen, setIsCpModalOpen] = useState(false);
    const [editingCp, setEditingCp] = useState<Partial<MajorCheckpoint>>({});

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const c = btoa(`${username}:${password}`);
        setCreds(c);
        // Verify creds by fetching staff
        api.admin.getStaff(c)
            .then(res => {
                setIsLoggedIn(true);
                setStaffList(res);
            })
            .catch(() => alert('Login failed'));
    };

    useEffect(() => {
        if (isLoggedIn) {
            if (activeTab === 'staff') loadStaff();
            if (activeTab === 'toilets') loadToilets();
            if (activeTab === 'checkpoints') loadCheckpoints();
            if (activeTab === 'settings') loadSettings();
        }
    }, [isLoggedIn, activeTab]);

    const loadStaff = () => api.admin.getStaff(creds).then(setStaffList);
    const loadToilets = () => api.admin.getToilets(creds).then(setToilets);
    const loadCheckpoints = () => api.admin.getMajorCheckpoints(creds).then(setCheckpoints);
    const loadSettings = () => api.admin.getSettings(creds).then(setSettings);

    // Staff Actions
    const handleAddStaff = async () => {
        const name = prompt('名前（内部管理用）を入力してください:');
        const icon = prompt('アイコン（絵文字）を入力してください (例: 🐶, 👨‍⚕️):');
        if (name && icon) {
            await api.admin.createStaff(creds, { internal_name: name, icon_code: icon });
            loadStaff();
        }
    };

    const handleDeleteStaff = async (id: number) => {
        if (confirm('本当に削除しますか？')) {
            await api.admin.deleteStaff(creds, id);
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

    // Checkpoint Actions
    const openCpModal = (cp?: MajorCheckpoint) => {
        setEditingCp(cp || { name: '', start_time: '09:00', end_time: '10:00', is_active: true });
        setIsCpModalOpen(true);
    };

    const saveCheckpoint = async () => {
        if (!editingCp.name || !editingCp.start_time || !editingCp.end_time) {
            alert('必須項目を入力してください');
            return;
        }

        try {
            if (editingCp.id) {
                await api.admin.updateMajorCheckpoint(creds, editingCp.id, editingCp);
            } else {
                await api.admin.createMajorCheckpoint(creds, editingCp);
            }
            setIsCpModalOpen(false);
            loadCheckpoints();
        } catch (e) {
            alert('保存に失敗しました');
        }
    };

    const deleteCheckpoint = async (id: number) => {
        if (confirm('本当に削除しますか？')) {
            await api.admin.deleteMajorCheckpoint(creds, id);
            loadCheckpoints();
        }
    };

    // Settings Actions
    const updateSettingValue = async (key: string, value: string) => {
        try {
            await api.admin.updateSetting(creds, key, value);
            alert('設定を保存しました');
            loadSettings();
        } catch (e) {
            alert('保存に失敗しました');
        }
    };

    const getSettingValue = (key: string) => settings.find(s => s.key === key)?.value || '';

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center">
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
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-slate-700">管理パネル</h1>
                <button onClick={() => setIsLoggedIn(false)} className="text-slate-500 hover:text-slate-800 transition-colors">ログアウト</button>
            </div>

            <div className="flex gap-4 mb-6 border-b border-slate-200 pb-2 overflow-x-auto">
                <button
                    className={`px-4 py-2 rounded transition-colors whitespace-nowrap ${activeTab === 'staff' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                    onClick={() => setActiveTab('staff')}
                >
                    スタッフ管理
                </button>
                <button
                    className={`px-4 py-2 rounded transition-colors whitespace-nowrap ${activeTab === 'toilets' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                    onClick={() => setActiveTab('toilets')}
                >
                    トイレ管理
                </button>
                <button
                    className={`px-4 py-2 rounded transition-colors whitespace-nowrap ${activeTab === 'checkpoints' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                    onClick={() => setActiveTab('checkpoints')}
                >
                    チェックポイント
                </button>
                <button
                    className={`px-4 py-2 rounded transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                    onClick={() => setActiveTab('settings')}
                >
                    システム設定
                </button>
            </div>

            {activeTab === 'staff' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-700">スタッフ管理</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                スタッフの追加・削除を行います。アイコンは動物絵文字や👨‍⚕️（医師）、👩‍⚕️（看護師）などが使えます。
                            </p>
                        </div>
                        <button onClick={handleAddStaff} className="bg-teal-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-500 shadow-sm transition-colors">
                            <Plus size={16} /> スタッフ追加
                        </button>
                    </div>
                    <div className="grid gap-4">
                        {staffList.map(staff => (
                            <div key={staff.id} className="bg-white border border-slate-200 p-4 rounded flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl">{staff.icon_code}</span>
                                    <div>
                                        <div className="font-bold text-slate-800">{staff.internal_name}</div>
                                        <div className="text-sm text-slate-400">表示順: {staff.display_order}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDeleteStaff(staff.id)}
                                        className="p-2 text-red-400 hover:bg-red-50 rounded transition-colors"
                                        title="削除"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'toilets' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-700">トイレ管理</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                管理対象のトイレを登録します（最大2箇所まで）。
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

            {activeTab === 'checkpoints' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-700">主要チェックポイント</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                重要なチェック時間帯を設定します。
                            </p>
                        </div>
                        <button onClick={() => openCpModal()} className="bg-teal-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-500 shadow-sm transition-colors">
                            <Plus size={16} /> 追加
                        </button>
                    </div>
                    <div className="grid gap-4">
                        {checkpoints.map(cp => (
                            <div key={cp.id} className="bg-white border border-slate-200 p-4 rounded flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="font-bold text-slate-800">{cp.name}</div>
                                    <div className="text-sm text-slate-500">
                                        {cp.start_time} - {cp.end_time}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openCpModal(cp)}
                                        className="p-2 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                                        title="編集"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => deleteCheckpoint(cp.id)}
                                        className="p-2 text-red-400 hover:bg-red-50 rounded transition-colors"
                                        title="削除"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-slate-700">システム設定</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            アプリケーション全体の動作設定を行います。
                        </p>
                    </div>

                    <div className="grid gap-6 max-w-2xl">
                        {[
                            { key: 'opening_time', label: '開院時間', type: 'time' },
                            { key: 'closing_time', label: '閉院時間', type: 'time' },
                            { key: 'lunch_break_start', label: '昼休み開始', type: 'time' },
                            { key: 'lunch_break_end', label: '昼休み終了', type: 'time' },
                            { key: 'timeline_range_start', label: 'タイムライン表示開始', type: 'time' },
                            { key: 'timeline_range_end', label: 'タイムライン表示終了', type: 'time' },
                        ].map(setting => (
                            <div key={setting.key} className="bg-white border border-slate-200 p-4 rounded shadow-sm flex items-center justify-between">
                                <label className="font-medium text-slate-700">{setting.label}</label>
                                <div className="flex gap-2">
                                    <input
                                        type={setting.type}
                                        className="border border-slate-300 rounded p-1 text-slate-800"
                                        defaultValue={getSettingValue(setting.key)}
                                        onBlur={(e) => updateSettingValue(setting.key, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Checkpoint Modal */}
            {isCpModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-700">
                                {editingCp.id ? 'チェックポイント編集' : 'チェックポイント追加'}
                            </h3>
                            <button onClick={() => setIsCpModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">名称</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded p-2 text-slate-800"
                                    value={editingCp.name || ''}
                                    onChange={e => setEditingCp({ ...editingCp, name: e.target.value })}
                                    placeholder="例: 開院前チェック"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">開始時間</label>
                                    <input
                                        type="time"
                                        className="w-full border border-slate-300 rounded p-2 text-slate-800"
                                        value={editingCp.start_time || ''}
                                        onChange={e => setEditingCp({ ...editingCp, start_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">終了時間</label>
                                    <input
                                        type="time"
                                        className="w-full border border-slate-300 rounded p-2 text-slate-800"
                                        value={editingCp.end_time || ''}
                                        onChange={e => setEditingCp({ ...editingCp, end_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={saveCheckpoint}
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
