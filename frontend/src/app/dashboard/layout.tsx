'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Inbox, 
  Users, 
  Calendar, 
  BarChart3, 
  Settings, 
  LogOut, 
  Bell, 
  ShieldCheck, 
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, logout, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-slate-600 font-sans">
        <div className="flex items-center gap-3 bg-white border border-slate-200 px-6 py-4 rounded-2xl shadow-sm">
          <div className="w-5 h-5 border-2 border-[#283876] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-700 tracking-wide">Подключение к TC CRM...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/dashboard/conversations', icon: Inbox, label: 'Входящие (Inbox)' },
    { href: '/dashboard', icon: BarChart3, label: 'Аналитика и сводка' },
    { href: '/dashboard/customers', icon: Users, label: 'База клиентов' },
    { href: '/dashboard/bookings', icon: Calendar, label: 'График записей' },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans antialiased selection:bg-[#283876]/10">
      {/* Clean Light Icon Rail (64px) */}
      <aside className="w-16 bg-white border-r border-slate-200/90 flex flex-col items-center justify-between py-3 z-30 shrink-0 select-none shadow-[1px_0_3px_rgba(0,0,0,0.02)]">
        {/* Top: Brand TC Logo & Nav */}
        <div className="flex flex-col items-center gap-3.5 w-full">
          {/* Official TC Monogram Logo */}
          <Link 
            href="/dashboard/conversations"
            onClick={(e) => {
              e.preventDefault();
              router.push('/dashboard/conversations');
            }}
            className="w-11 h-11 rounded-xl bg-white border border-slate-200 hover:border-[#283876]/40 flex items-center justify-center p-1 hover:shadow-md transition-all duration-150 cursor-pointer group"
            title="TC Consulting CRM"
          >
            <img 
              src="/tc-logo.png" 
              alt="TC Logo" 
              className="w-8 h-8 object-contain transition-transform group-hover:scale-105" 
            />
          </Link>

          <div className="w-8 h-[1px] bg-slate-200 my-0.5" />

          {/* Navigation Icons */}
          <nav className="flex flex-col items-center gap-1.5 w-full px-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(item.href);
                  }}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center relative transition-all duration-150 group cursor-pointer ${
                    isActive
                      ? 'bg-[#283876] text-white shadow-sm shadow-[#283876]/20'
                      : 'text-slate-500 hover:text-[#283876] hover:bg-slate-100/80'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5 transition-transform group-hover:scale-105" />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute left-14 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Utilities & User Profile */}
        <div className="flex flex-col items-center gap-2 w-full px-2 relative">
          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#283876] hover:bg-slate-100 transition-colors relative group cursor-pointer"
            title="Уведомления"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-blue-500 absolute top-2.5 right-2.5" />
            <div className="absolute left-14 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
              Уведомления
            </div>
          </button>

          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#283876] hover:bg-slate-100 transition-colors relative group cursor-pointer"
            title="Настройки CRM"
            onClick={() => router.push('/dashboard')}
          >
            <Settings className="w-4 h-4" />
            <div className="absolute left-14 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
              Настройки CRM
            </div>
          </button>

          <div className="w-8 h-[1px] bg-slate-200 my-0.5" />

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-10 h-10 rounded-full bg-slate-100 border border-slate-300 hover:border-[#283876] flex items-center justify-center text-[#283876] text-xs font-bold transition-all cursor-pointer relative shadow-sm"
              title="Профиль оператора"
            >
              <span>OP</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white absolute bottom-0 right-0" />
            </button>

            {showUserMenu && (
              <div 
                className="absolute left-14 bottom-0 w-60 rounded-xl bg-white border border-slate-200 shadow-xl p-2 z-50 text-xs animate-in fade-in duration-100"
                onMouseLeave={() => setShowUserMenu(false)}
              >
                <div className="p-2.5 border-b border-slate-100 mb-1">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>Оператор CRM</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#283876]" />
                  </div>
                  <div className="text-xs text-emerald-600 flex items-center gap-1.5 mt-0.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>В сети • Instagram Direct</span>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/dashboard/customers')}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition flex items-center justify-between cursor-pointer"
                >
                  <span>База клиентов</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => router.push('/dashboard/bookings')}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition flex items-center justify-between cursor-pointer"
                >
                  <span>Записи на консультации</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="h-[1px] bg-slate-100 my-1" />

                <button
                  onClick={() => logout()}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition flex items-center gap-2 cursor-pointer font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Завершить смену</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#F8FAFC]">
        {children}
      </main>
    </div>
  );
}
