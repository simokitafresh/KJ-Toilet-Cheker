'use client';

import { useState } from 'react';
import { HomeLink } from '@/components/HomeLink';
import { ChevronDown, ChevronUp, Camera, Clock, CheckCircle } from 'lucide-react';

// 折りたたみセクションコンポーネント
function Section({ title, icon, children, defaultOpen = false }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-bold text-slate-700">{title}</span>
                </div>
                {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>
            {isOpen && (
                <div className="p-4 text-slate-600 text-sm leading-relaxed">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function GuidePage() {
    return (
        <div className="min-h-screen bg-slate-100 text-slate-800">
            {/* Header */}
            <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 p-4 border-b border-slate-200">
                <div className="flex justify-between items-center">
                    <HomeLink />
                </div>
                <h1 className="text-xl font-bold text-slate-700 text-center mt-2">ユーザーガイド</h1>
            </div>

            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                {/* イントロ */}
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <p className="text-teal-800 text-sm">
                        トイレチェックは<strong>たった6秒</strong>で完了します。<br />
                        患者さんからの信頼を守るため、気づいたときにサッと記録しましょう。
                    </p>
                </div>

                {/* チェックの流れ */}
                <Section 
                    title="チェックの流れ（6秒で完了）" 
                    icon={<Camera size={20} className="text-teal-600" />}
                    defaultOpen={true}
                >
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                            <div>
                                <div className="font-bold text-slate-700">カメラ画面を開く</div>
                                <div className="text-slate-500">「撮影」ボタンをタップするとカメラが起動</div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                            <div>
                                <div className="font-bold text-slate-700">2枚撮影</div>
                                <div className="text-slate-500">
                                    1枚目: チェックシート<br />
                                    2枚目: トイレ全景
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                            <div>
                                <div className="font-bold text-slate-700">アイコンをタップ</div>
                                <div className="text-slate-500">自分のアイコンを選んで送信完了！</div>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* いつチェックすればいい？ */}
                <Section 
                    title="いつチェックすればいい？" 
                    icon={<Clock size={20} className="text-blue-600" />}
                >
                    <div className="space-y-4">
                        <div>
                            <div className="font-bold text-slate-700 mb-2">🌅 朝チェック（8:00〜8:50）</div>
                            <div className="text-slate-500">開院前に「今日もきれい」を確認</div>
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 mb-2">🌆 午後チェック（14:00〜14:50）</div>
                            <div className="text-slate-500">午後の患者さんを迎える前に</div>
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 mb-2">⏰ 定期チェック</div>
                            <div className="text-slate-500">
                                診療時間中は約1時間ごとが目安<br />
                                「トイレに行ったついで」でOK
                            </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded p-3 mt-4">
                            <div className="text-amber-800 text-sm">
                                💡 <strong>ポイント</strong>: 時間帯に関係なく「そろそろかな」と思ったときがベストタイミング！
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ダッシュボードの見方 */}
                <Section 
                    title="ダッシュボードの見方" 
                    icon={<CheckCircle size={20} className="text-emerald-600" />}
                >
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🟢</span>
                            <div>
                                <span className="font-bold text-emerald-700">緑</span>
                                <span className="text-slate-500 ml-2">OK！チェック済み</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🟡</span>
                            <div>
                                <span className="font-bold text-amber-700">黄色</span>
                                <span className="text-slate-500 ml-2">もう少しで次のチェック時間</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🔴</span>
                            <div>
                                <span className="font-bold text-red-700">赤</span>
                                <span className="text-slate-500 ml-2">チェックをお願いします</span>
                            </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-4">
                            <div className="text-slate-600 text-sm">
                                赤いアラートが出ていたら、手が空いている人がサッと対応。<br />
                                <strong>気づいた人がやる</strong>ーそれがチームワークです。
                            </div>
                        </div>
                    </div>
                </Section>

                {/* よくある質問 */}
                <Section 
                    title="よくある質問" 
                    icon={<span className="text-lg">❓</span>}
                >
                    <div className="space-y-4">
                        <div>
                            <div className="font-bold text-slate-700">間違えて送信しました。取り消せますか？</div>
                            <div className="text-slate-500 mt-1">→ 取り消しはできませんが、そのままで大丈夫です。</div>
                        </div>
                        <div>
                            <div className="font-bold text-slate-700">自分のアイコンがわかりません</div>
                            <div className="text-slate-500 mt-1">→ 管理者に確認してください。</div>
                        </div>
                        <div>
                            <div className="font-bold text-slate-700">カメラが起動しません</div>
                            <div className="text-slate-500 mt-1">→ ブラウザの設定でカメラへのアクセスを許可してください。</div>
                        </div>
                        <div>
                            <div className="font-bold text-slate-700">昼休み中もチェックが必要ですか？</div>
                            <div className="text-slate-500 mt-1">→ 12:00〜14:00は対象外です。14:00からの午後チェックはお願いします。</div>
                        </div>
                    </div>
                </Section>

                {/* 最後のメッセージ */}
                <div className="bg-slate-700 text-white rounded-lg p-6 text-center">
                    <p className="text-lg mb-2">
                        やり方は簡単。
                    </p>
                    <p className="text-2xl font-bold mb-4">
                        📷 開く → 2枚撮る → アイコンタップ
                    </p>
                    <p className="text-slate-300 text-sm">
                        気づいた人が、気軽に。<br />
                        みんなで、クリニックの信頼を守っていきましょう。
                    </p>
                </div>
            </div>
        </div>
    );
}
