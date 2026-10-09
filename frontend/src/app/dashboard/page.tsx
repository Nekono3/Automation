'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DashboardStats } from '@/lib/types';
import { 
  MessageSquare, Bot, UserCircle, Clock, Users, Bell, 
  ArrowUpRight, Sparkles, Activity, ShieldCheck, Compass, Calendar
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats()
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load stats', err);
        setLoading(false);
      });
  }, []);

  const statCards = [
    {
      title: 'Активные диалоги',
      value: stats?.open_conversations || 0,
      icon: MessageSquare,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      href: '/dashboard/conversations',
      desc: 'Открытые переписки в Direct',
    },
    {
      title: 'ИИ-сопровождение',
      value: stats?.ai_conversations || 0,
      icon: Bot,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      href: '/dashboard/conversations',
      desc: 'Диалоги под управлением ИИ',
    },
    {
      title: 'На контроле оператора',
      value: stats?.human_conversations || 0,
      icon: UserCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      href: '/dashboard/conversations',
      desc: 'Ручные ответы сотрудников',
    },
    {
      title: 'Ожидают подтверждения',
      value: stats?.pending_bookings || 0,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      href: '/dashboard/bookings',
      desc: 'Требуют внимания оператора',
    },
    {
      title: 'Клиентская база',
      value: stats?.total_customers || 0,
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      href: '/dashboard/customers',
      desc: 'Уникальные клиенты',
    },
    {
      title: 'Непрочитанные',
      value: stats?.unread_messages || 0,
      icon: Bell,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      href: '/dashboard/conversations',
      desc: 'Новые сообщения клиентов',
    },
  ];

  return (
    <div className="p-8 overflow-y-auto h-full bg-[#070b14] text-slate-100">
      {/* Page Title */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest font-semibold">
              Главный терминал
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Все узлы в норме
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Обзор показателей CRM
          </h1>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2.5">
          <button
            onClick={() => router.push('/dashboard/bookings')}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>График записей</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/conversations')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>В диалоги</span>
          </button>
        </div>
      </div>
      
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={() => router.push(card.href)}
              className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-6 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl group backdrop-blur-md relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl border ${card.bg}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1 font-mono">
                  {card.title}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                    {loading ? '—' : card.value}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">{card.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Infrastructure Telemetry Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
              Телеметрия сервисов платформы
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Германия 🇩🇪 (2.26.50.235)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Meta Instagram Graph:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Live Connected
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Mistral AI Copilot:</span>
            <span className="text-indigo-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              open-mistral-7b
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">PostgreSQL Cloud DB:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Operational 24/7
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
