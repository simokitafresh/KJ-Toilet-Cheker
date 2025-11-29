'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Staff, Toilet, MajorCheckpoint } from '@/lib/types';
import { Trash2, Plus, Save, Edit } from 'lucide-react';

export default function AdminPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [creds, setCreds] = useState('');
    const [activeTab, setActiveTab] = useState<'staff' | 'toilets' | 'checkpoints'>('staff');

    // Data
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [toilets, setToilets] = useState<Toilet[]>([]);
    const [checkpoints, setCheckpoints] = useState<MajorCheckpoint[]>([]);

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
        }
    }, [isLoggedIn, activeTab]);

    const loadStaff = () => api.admin.getStaff(creds).then(setStaffList);
    const loadToilets = () => api.admin.getToilets(creds).then(setToilets);
    const loadCheckpoints = () => api.admin.getMajorCheckpoints(creds).then(setCheckpoints);

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

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
                    <h1 className="text-2xl font-bold mb-6 text-center">管理者ログイン</h1>
                    <div className="mb-4">
                        <label className="block text-sm mb-2">ユーザー名</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm mb-2">パスワード</label>
                        <input
                            type="password"
                            className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 py-2 rounded font-bold hover:bg-blue-500">
                        ログイン
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">管理パネル</h1>
                <button onClick={() => setIsLoggedIn(false)} className="text-gray-400 hover:text-white">ログアウト</button>
            </div>

            <div className="flex gap-4 mb-6 border-b border-gray-700 pb-2">
                <button
                    className={`px-4 py-2 rounded ${activeTab === 'staff' ? 'bg-blue-600' : 'bg-gray-800'}`}
                    onClick={() => setActiveTab('staff')}
                >
                    スタッフ管理
                </button>
                <button
                    className={`px-4 py-2 rounded ${activeTab === 'toilets' ? 'bg-blue-600' : 'bg-gray-800'}`}
                    onClick={() => setActiveTab('toilets')}
                >
                    トイレ管理
                </button>
                <button
                    className={`px-4 py-2 rounded ${activeTab === 'checkpoints' ? 'bg-blue-600' : 'bg-gray-800'}`}
                    onClick={() => setActiveTab('checkpoints')}
                >
                    チェックポイント
                </button>
            </div>

            {activeTab === 'staff' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold">スタッフ管理</h2>
                            <p className="text-sm text-gray-400 mt-1">
                                スタッフの追加・削除を行います。アイコンは動物絵文字や👨‍⚕️（医師）、👩‍⚕️（看護師）などが使えます。
                            </p>
                        </div>
                        <button onClick={handleAddStaff} className="bg-green-600 px-4 py-2 rounded flex items-center gap-2">
                            <Plus size={16} /> スタッフ追加
                        </button>
                    </div>
                    <div className="grid gap-4">
                        {staffList.map(staff => (
                            <div key={staff.id} className="bg-gray-800 p-4 rounded flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl">{staff.icon_code}</span>
                                    <div>
                                        <div className="font-bold">{staff.internal_name}</div>
                                        <div className="text-sm text-gray-400">表示順: {staff.display_order}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDeleteStaff(staff.id)}
                                        className="p-2 text-red-400 hover:bg-gray-700 rounded"
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
                            <h2 className="text-xl font-bold">トイレ管理</h2>
                            <p className="text-sm text-gray-400 mt-1">
                                管理対象のトイレを登録します（最大2箇所まで）。
                            </p>
                        </div>
                        <button onClick={handleAddToilet} className="bg-green-600 px-4 py-2 rounded flex items-center gap-2">
                            <Plus size={16} /> トイレ追加
                        </button>
                    </div>
                    <div className="grid gap-4">
                        {toilets.map(toilet => (
                            <div key={toilet.id} className="bg-gray-800 p-4 rounded flex justify-between items-center">
                                <div>
                                    <div className="font-bold">{toilet.name}</div>
                                    <div className="text-sm text-gray-400">{toilet.floor || '階数情報なし'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'checkpoints' && (
                <div>
                    <div className="mb-4">
                        <h2 className="text-xl font-bold">主要チェックポイント</h2>
                        <p className="text-sm text-gray-400 mt-1">
                            特に重要なチェック時間帯の設定です。現在は閲覧のみ可能です。
                        </p>
                    </div>
                    <pre className="bg-gray-800 p-4 rounded mt-4 text-xs overflow-auto">
                        {JSON.stringify(checkpoints, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
