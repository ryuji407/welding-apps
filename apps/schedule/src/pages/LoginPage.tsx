import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Lock, UserPlus } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegistering) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Create user document with default role 'user'
                // NOTE: First user usually needs to be admin. 
                // There is no automatic way to detect "first user" safely without checking DB count 
                // or just letting them edit it.
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email: userCredential.user.email,
                    role: 'user', // Default role
                    createdAt: new Date().toISOString()
                });
                // AuthContext will detect change
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            console.error(err);
            if (isRegistering) {
                if (err.code === 'auth/email-already-in-use') {
                    setError('そのメールアドレスは既に使用されています。');
                } else if (err.code === 'auth/weak-password') {
                    setError('パスワードは6文字以上にしてください。');
                } else {
                    setError('登録に失敗しました。');
                }
            } else {
                if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                    setError('メールアドレスまたはパスワードが間違っています。');
                } else {
                    setError('ログインに失敗しました。');
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-indigo-100 p-3 rounded-full mb-4">
                        {isRegistering ? (
                            <UserPlus className="text-indigo-600" size={32} />
                        ) : (
                            <Lock className="text-indigo-600" size={32} />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isRegistering ? 'アカウント作成' : 'ログイン'}
                    </h1>
                    <p className="text-gray-500 text-sm mt-2">製造スケジュール管理システム</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="user@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        {loading ? '処理中...' : (isRegistering ? '登録する' : 'ログイン')}
                    </button>

                    <div className="text-center pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setError('');
                            }}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            {isRegistering
                                ? 'すでにアカウントをお持ちの方はこちら (ログイン)'
                                : 'アカウントをお持ちでない方はこちら (新規登録)'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
