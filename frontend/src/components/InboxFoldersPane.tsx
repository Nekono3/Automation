'use client';

import { useState } from 'react';
import { 
  Inbox, 
  AtSign, 
  PenTool, 
  Users, 
  UserX, 
  BarChart3, 
  Plus, 
  Search, 
  Bot, 
  ChevronRight, 
  ChevronUp, 
  Settings, 
  CheckCircle2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export type InboxViewType = 'inbox' | 'mentions' | 'created_by_you' | 'all' | 'unassigned';

interface Props {
  totalCount: number;
  openCount: number;
  aiCount: number;
  activeView: InboxViewType;
  onViewChange: (view: InboxViewType) => void;
  onSearchClick: () => void;
  onNewConversation?: () => void;
}

export function InboxFoldersPane({
  totalCount,
  openCount,
  aiCount,
  activeView,
  onViewChange,
  onSearchClick,
  onNewConversation
}: Props) {
  const router = useRouter();
  const [setupCardExpanded, setSetupCardExpanded] = useState(true);

  const views = [
    { id: 'inbox' as InboxViewType, label: 'Ваши диалоги', count: openCount, icon: Inbox },
    { id: 'mentions' as InboxViewType, label: 'Упоминания', count: 0, icon: AtSign },
    { id: 'created_by_you' as InboxViewType, label: 'Созданные вами', count: 0, icon: PenTool },
    { id: 'all' as InboxViewType, label: 'Все диалоги', count: totalCount, icon: Users },
    { id: 'unassigned' as InboxViewType, label: 'Неназначенные', count: 0, icon: UserX },
  ];

  return (
    <div className="w-[220px] shrink-0 bg-white border border-slate-200/90 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm select-none text-xs">
      {/* Top Section */}
      <div className="flex flex-col">
        {/* Header: Title + Create New + Search */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100">
          <h1 className="font-bold text-sm text-slate-900 tracking-tight">Inbox</h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onNewConversation}
              className="flex items-center gap-1 bg-[#283876] hover:bg-[#1E2C60] text-white px-2.5 py-1 rounded-lg transition-colors duration-150 text-xs font-semibold cursor-pointer shadow-sm shadow-[#283876]/20"
              title="Создать диалог"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать</span>
            </button>
            <button
              onClick={onSearchClick}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
              title="Поиск"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Views Navigation */}
        <div className="p-2 space-y-0.5">
          {views.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#283876] font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#283876]' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                  isActive ? 'text-[#283876] bg-white shadow-sm font-bold' : 'text-slate-500 bg-slate-100'
                }`}>
                  {item.count}
                </span>
              </button>
            );
          })}

          {/* Analytics Shortcut */}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 truncate">
              <BarChart3 className="w-4 h-4 shrink-0 text-slate-400" />
              <span>Аналитика</span>
            </div>
          </button>
        </div>

        {/* AI Agent Status Section */}
        <div className="px-3.5 pt-3.5 pb-2 border-t border-slate-100 mt-1">
          <div className="flex items-center justify-between text-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center text-[#283876]">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-xs text-slate-800">AI-ассистент</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          
          <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Автоответы:</span>
            <span className="font-semibold text-[#283876]">{aiCount} активных</span>
          </div>
        </div>
      </div>

      {/* Bottom Setup Card */}
      <div className="p-2.5 space-y-1.5">
        {setupCardExpanded && (
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-slate-700">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#283876]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#283876]" />
                <span>Instagram Direct</span>
              </div>
              <button
                onClick={() => setSetupCardExpanded(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Свернуть"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Канал подключен. Все входящие диалоги синхронизируются в реальном времени.
            </p>
          </div>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors text-xs font-medium cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          <span>Настройки</span>
        </button>
      </div>
    </div>
  );
}
