import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

interface AuthModalProps { isOpen: boolean; onClose: () => void }
export const AuthModal: React.FC<AuthModalProps> = (props: AuthModalProps) => {
    const { isOpen, onClose } = props;
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, loading, error, successMessage, clearError, clearSuccessMessage } = useAuth();
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
            <Button type="button" onClick={() => signInWithGoogle().then(onClose).catch(() => { })} disabled={loading} className="flex-1">
                {loading ? 'Please wait…' : 'Continue with Google'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
            </Button>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader className="flex items-center justify-between">
                    <DialogTitle>{mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Reset password'}</DialogTitle>
                    <DialogClose aria-label="Close" onClick={onClose}>✕</DialogClose>
                </DialogHeader>
                <DialogBody>
                    <div className="space-y-4">
                        {error && (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                                {error}
                                <button onClick={clearError} className="ml-2 underline">dismiss</button>
                            </div>
                        )}
                        {successMessage && (
                            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                                {successMessage}
                                <button onClick={clearSuccessMessage} className="ml-2 underline">dismiss</button>
                            </div>
                        )}
                        {message && (
                            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{message}</div>
                        )}
                        <form onSubmit={submit} className="space-y-3">
                            {mode === 'sign-up' && (
                                <div>
                                    <Label>Name</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        placeholder="Your name"
                                        className="mt-1"
                                    />
                                </div>
                            )}
                            <div>
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    className="mt-1"
                                />
                            </div>
                            {mode !== 'forgot' && (
                                <div>
                                    <Label>Password</Label>
                                    <Input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                                        className="mt-1"
                                    />
                                </div>
                            )}
                            <Button type="submit" disabled={loading} className="w-full">
                                {loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
                            </Button>
                        </form>

                        <div className="text-sm text-gray-600 flex justify-between">
                            {mode !== 'sign-in' ? (
                                <Button variant="link" onClick={() => setMode('sign-in')}>Have an account? Sign in</Button>
                            ) : (
                                <Button variant="link" onClick={() => setMode('sign-up')}>Create an account</Button>
                            )}
                            {mode !== 'forgot' && (
                                <Button variant="link" onClick={() => setMode('forgot')}>Forgot password?</Button>
                            )}
                        </div>
                    </div>
                </DialogBody>
                <DialogFooter>{Footer}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AuthModal;
