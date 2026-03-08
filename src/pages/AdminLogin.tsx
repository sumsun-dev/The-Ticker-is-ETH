import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AdminLogin: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [passphrase, setPassphrase] = useState('');
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || isSuccess) return;

        setIsLoading(true);
        setError(false);

        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: passphrase }),
            });

            if (res.ok) {
                sessionStorage.setItem('publishKey', passphrase);
                localStorage.setItem('isAdmin', 'true');
                setIsSuccess(true);
                setTimeout(() => navigate('/contents'), 1500);
            } else {
                setError(true);
                setTimeout(() => setError(false), 2000);
            }
        } catch {
            setError(true);
            setTimeout(() => setError(false), 2000);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-theme-bg flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-primary/10 via-transparent to-transparent pointer-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-white/[0.03] border border-theme-border backdrop-blur-xl rounded-[2.5rem] p-10 md:p-12 shadow-2xl">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${isSuccess ? 'bg-green-500/20 text-green-500' : 'bg-brand-primary/10 text-brand-primary'}`}>
                            {isSuccess ? <ShieldCheck size={32} /> : <Lock size={32} />}
                        </div>
                        <h1 className="text-3xl font-bold text-theme-text mb-2">{t('admin.title')}</h1>
                        <p className="text-theme-text-secondary font-light">
                            {isSuccess ? t('admin.authSuccess') : t('admin.enterPassphrase')}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="relative">
                            <input
                                type="password"
                                placeholder={t('admin.passphrasePlaceholder')}
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                                className={`w-full bg-white/5 border rounded-2xl py-4 px-6 text-theme-text text-lg focus:outline-none transition-all placeholder:text-theme-text-muted ${error ? 'border-red-500/50 bg-red-500/5' : 'border-theme-border focus:border-brand-accent/50 focus:bg-white/10'}`}
                                autoFocus
                            />
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="absolute -bottom-6 left-2 flex items-center gap-1.5 text-red-500 text-xs font-medium"
                                >
                                    <AlertCircle size={14} />
                                    <span>{t('admin.incorrectPassphrase')}</span>
                                </motion.div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSuccess || isLoading}
                            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all ${isSuccess ? 'bg-green-500 text-white' : 'bg-brand-primary hover:bg-brand-primary/80 text-white shadow-lg shadow-brand-primary/20'} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isSuccess ? t('admin.welcome') : isLoading ? '' : t('admin.authorize')}
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : !isSuccess && <ArrowRight size={20} />}
                        </button>
                    </form>
                </div>

                <p className="text-center text-theme-text-muted text-xs mt-8">
                    {t('admin.notice')}
                </p>
            </motion.div>
        </div>
    );
};

export default AdminLogin;
