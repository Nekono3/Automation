'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DashboardStats } from '@/lib/types';
import { 
  MessageSquare, 
  Bot, 
  UserCheck, 
  Clock, 
  Users, 
  Bell, 
  ArrowUpRight, 
  Activity, 
  Calendar,
  CheckCircle2
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
      color: 'text-[#283876]',
      bg: 'bg-blue-50 border-blue-100',
      href: '/dashboard/conversations',
      desc: 'Открытые переписки в Instagram Direct',
    },
    {
      title: 'AI-сопровождение',
      value: stats?.ai_conversations || 0,
      icon: Bot,
      color: 'text-[#283876]',
      bg: 'bg-blue-50 border-blue-100',
      href: '/dashboard/conversations',
      desc: 'Диалоги с автоответами ассистента',
    },
    {
      title: 'Контроль оператора',
      value: stats?.human_conversations || 0,
      icon: UserCheck,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50 border-emerald-100',
      href: '/dashboard/conversations',
      desc: 'Ручные ответы сотрудников',
    },
    {
      title: 'Ожидают подтверждения',
      value: stats?.pending_bookings || 0,
      icon: Clock,
      color: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-100',
      href: '/dashboard/bookings',
      desc: 'Требуют решения по слотам',
    },
    {
      title: 'База клиентов',
      value: stats?.total_customers || 0,
      icon: Users,
      color: 'text-indigo-700',
      bg: 'bg-indigo-50 border-indigo-100',
      href: '/dashboard/customers',
      desc: 'Всего зарегистрированных клиентов',
    },
    {
      title: 'Непрочитанные сообщения',
      value: stats?.unread_messages || 0,
      icon: Bell,
      color: 'text-rose-700',
      bg: 'bg-rose-50 border-rose-100',
      href: '/dashboard/conversations',
      desc: 'Новые входящие сообщения',
    },
  ];

  return (
    <div className="p-8 overflow-y-auto h-full bg-[#F8FAFC] text-slate-900">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-[#283876] border border-blue-100">
              Панель управления
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-[#283876] font-semibold flex items-center gap-1.5 bg-[#EEF2FF] px-2.5 py-1 rounded-md border border-[#283876]/15">
              <span className="w-2 h-2 rounded-full bg-[#283876]" />
              Сервисы работают в штатном режиме
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Сводка и показатели TC CRM
          </h1>
        </div>

        {/* Quick Navigation */}
        <div className="flex gap-2.5">
          <button
            onClick={() => router.push('/dashboard/bookings')}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            <Calendar className="w-4 h-4 text-[#283876]" />
            <span>График записей</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/conversations')}
            className="px-4 py-2.5 rounded-xl bg-[#283876] hover:bg-[#1E2C60] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-md shadow-[#283876]/20"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Входящие (Inbox)</span>
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
              className="bg-white hover:bg-slate-50/80 border border-slate-200/90 hover:border-blue-200 rounded-2xl p-6 transition-all duration-150 cursor-pointer group shadow-sm hover:shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl border ${card.bg}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#283876] transition-colors" />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {card.title}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {loading ? '—' : card.value}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">{card.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Infrastructure Telemetry */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#283876]" />
            <h3 className="text-sm font-bold text-slate-900">
              Статус подключений платформы
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-1.5 bg-blue-50/80 rounded-xl border border-blue-100 flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">Meta Instagram:</span>
              <span className="text-[#283876] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#283876]" />
                Direct API • Подключен
              </span>
            </div>
            <div className="px-3.5 py-1.5 bg-emerald-50/80 rounded-xl border border-emerald-100 flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">WhatsApp Business:</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                Cloud API • Подключен
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden lg:inline">Сервер: 2.26.50.235</span>
          </div>
        </div>
      </div>
    </div>
  );
}
