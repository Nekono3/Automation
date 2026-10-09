'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@instacrm.local');
  const [password, setPassword] = useState('AdminSecurePassword123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(email, password);
      login(response.access_token, response.user);
    } catch (err: any) {
      setError('Ошибка входа. Проверьте почту и пароль.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC] font-sans antialiased text-slate-900 p-4">
      <div className="w-full max-w-md p-8 sm:p-10 space-y-6 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80">
        {/* Brand Header with TC Monogram */}
        <div className="text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-2 mb-3 shadow-sm">
            <img 
              src="/tc-logo.png" 
              alt="TC Logo" 
              className="w-12 h-12 object-contain" 
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            TC CRM Desk
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Управление диалогами Instagram Direct и консультациями
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-center font-medium">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Рабочий Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#283876]/20 focus:border-[#283876] outline-none text-slate-900 text-xs transition-colors"
                required
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Пароль оператора
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#283876]/20 focus:border-[#283876] outline-none text-slate-900 text-xs transition-colors"
                required
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 text-white bg-[#283876] hover:bg-[#1E2C60] rounded-xl font-bold text-xs shadow-md shadow-[#283876]/25 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Авторизация...' : 'Войти в терминал'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Защищенный шлюз Meta Direct API</span>
        </div>
      </div>
    </div>
  );
}
