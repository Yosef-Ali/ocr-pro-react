import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/ui/Modal';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

export const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, loading, error, clearError } = useAuth();
    const [mode, setMode] = useState<Mode>('sign-in');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        try {
            if (mode === 'sign-in') {
                await signInWithEmail(email, password);
                onClose();
            } else if (mode === 'sign-up') {
                await signUpWithEmail(name, email, password);
                onClose();
            } else if (mode === 'forgot') {
                await sendPasswordReset(email);
                setMessage('Password reset email sent. Check your inbox.');
            }
        } catch {
            // errors handled in context
        }
    };

    const Footer = (
        <div className="w-full flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
                onClick={() => signInWithGoogle().then(onClose).catch(() => { })}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
            >
                {loading ? 'Please wait…' : 'Continue with Google'}
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">Cancel</button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Reset password'} footer={Footer}>
            <div className="space-y-4">
                {error && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {error}
                        <button onClick={clearError} className="ml-2 underline">dismiss</button>
                    </div>
                )}
                {message && (
                    <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{message}</div>
                )}
                <form onSubmit={submit} className="space-y-3">
                    {mode === 'sign-up' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Your name" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="you@example.com" />
                    </div>
                    {mode !== 'forgot' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="••••••••" />
                        </div>
                    )}
                    <button type="submit" disabled={loading} className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                        {loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
                    </button>
                </form>

                <div className="text-sm text-gray-600 flex justify-between">
                    {mode !== 'sign-in' ? (
                        <button className="underline" onClick={() => setMode('sign-in')}>Have an account? Sign in</button>
                    ) : (
                        <button className="underline" onClick={() => setMode('sign-up')}>Create an account</button>
                    )}
                    {mode !== 'forgot' && (
                        <button className="underline" onClick={() => setMode('forgot')}>Forgot password?</button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default AuthModal;
