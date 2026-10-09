'use client';

import { Conversation } from '@/lib/types';
import { Bot, User, Pause, Search, X, MessageSquare, AtSign, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect, searchQuery, onSearchChange }: Props) {
  return (
    <div className="w-80 border-r border-slate-800/80 bg-[#0a0f1d] flex flex-col h-full shrink-0 select-none">
      {/* Header & Search */}
      <div className="p-4 border-b border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest font-semibold">
              Диалоги
            </span>
            <span className="text-xs text-slate-500">({conversations.length})</span>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Поиск клиентов..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans shadow-inner"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Conversation Thread List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {conversations.map((conv) => {
          const customerName = conv.customer?.name || (conv.customer?.username ? `@${conv.customer.username}` : `Клиент #${conv.customer_id}`);
          const isSelected = String(selectedId) === String(conv.id);
          
          let ModeIcon = User;
          let modeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
          let modeLabel = 'Оператор';
          if (conv.mode === 'ai') {
            ModeIcon = Bot;
            modeColor = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
            modeLabel = 'ИИ';
          } else if (conv.mode === 'paused') {
            ModeIcon = Pause;
            modeColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
            modeLabel = 'Пауза';
          }

          const initials = (conv.customer?.name || 'К')
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`p-3.5 cursor-pointer transition-all duration-150 relative group ${
                isSelected 
                  ? 'bg-gradient-to-r from-indigo-950/30 to-slate-900 border-l-2 border-cyan-400 shadow-md' 
                  : 'hover:bg-slate-900/40'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                  isSelected
                    ? 'bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white ring-1 ring-cyan-400/40'
                    : 'bg-slate-800/80 text-slate-300 border border-slate-700/60 group-hover:border-slate-600'
                }`}>
                  {initials}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className={`font-semibold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {customerName}
                    </h3>
                    {conv.unread_count > 0 && (
                      <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 shadow-sm shadow-rose-500/50 animate-pulse">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>

                  {conv.customer?.username && (
                    <div className="text-[11px] text-indigo-400/80 font-mono flex items-center gap-1 mb-1.5 truncate">
                      <AtSign className="w-3 h-3" />
                      <span>{conv.customer.username}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${modeColor}`}>
                      <ModeIcon className="w-3 h-3" />
                      <span>{modeLabel}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {conv.last_message_at 
                          ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ru })
                          : 'нет сообщений'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {conversations.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">
            Диалоги не найдены
          </div>
        )}
      </div>
    </div>
  );
}
