import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, KeyRound, Sparkles, Crown } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const LoginView: React.FC = () => {
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const { login, isLoading, error, isLocalAuth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as any)?.from?.pathname || '/';

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLocalError(null);
        try {
            await login(password);
            navigate(from, { replace: true });
        } catch (err: any) {
            setLocalError(err?.message || 'Credenciales inválidas');
        }
    };

    return (
        <div className="min-h-screen bg-black text-gold-100 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,215,130,0.25),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(96,62,0,0.7),_transparent_55%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(15,10,5,0.95),_rgba(8,6,2,0.98))]" />
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle,_rgba(255,225,145,0.12)_1px,_transparent_1px)] [background-size:18px_18px]" />

            <div className="relative z-10 flex items-center justify-center min-h-screen px-6 py-16">
                <div className="w-full max-w-md">
                    <div className="bg-gradient-to-b from-[#1a140a]/90 to-[#0b0804]/95 border border-gold-400/20 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.55)] p-8 backdrop-blur">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-2xl bg-gold-500/10 border border-gold-400/40 flex items-center justify-center">
                                    <Crown className="h-6 w-6 text-gold-400" />
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.35em] text-gold-300/70">Acceso privado</p>
                                    <h1 className="text-2xl font-semibold text-gold-100">Llave Dorada Yani</h1>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-gold-400/70 text-xs">
                                <Sparkles className="h-4 w-4" />
                                Exclusivo
                            </div>
                        </div>

                        <div className="mt-6 border-t border-gold-400/10 pt-6">
                            <p className="text-sm text-gold-100/70 leading-relaxed">
                                Ingresa la clave maestra para desbloquear el tablero. Este acceso mantiene tus métricas protegidas.
                            </p>
                            {isLocalAuth && (
                                <p className="mt-3 text-xs uppercase tracking-[0.25em] text-gold-300/70">
                                    Acceso local habilitado
                                </p>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                            <label className="block">
                                <span className="text-xs uppercase tracking-[0.3em] text-gold-300/70">Clave de acceso</span>
                                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-gold-400/20 bg-black/40 px-4 py-3 focus-within:border-gold-400/60 focus-within:shadow-[0_0_25px_rgba(255,214,120,0.2)]">
                                    <KeyRound className="h-4 w-4 text-gold-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-transparent text-gold-100 placeholder:text-gold-200/30 focus:outline-none"
                                        required
                                    />
                                </div>
                            </label>

                            {(localError || error) && (
                                <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                                    {localError || error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 via-amber-300 to-gold-500 text-black font-semibold py-3 shadow-[0_15px_30px_rgba(255,210,120,0.35)] hover:shadow-[0_20px_40px_rgba(255,210,120,0.45)] transition-all disabled:opacity-60"
                            >
                                <ShieldCheck className="h-5 w-5" />
                                {isLoading ? 'Validando...' : 'Entrar al Dashboard'}
                            </button>
                        </form>

                        <div className="mt-6 flex items-center justify-between text-xs text-gold-200/50">
                            <span>Seguridad activa</span>
                            <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-gold-400" />
                                Sesión cifrada
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginView;
