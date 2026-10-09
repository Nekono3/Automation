'use client';

import { useState } from 'react';
import { Conversation } from '@/lib/types';
import { 
  Search, 
  X, 
  ChevronDown, 
  Bot
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: 'all' | 'open' | 'closed';
  onStatusFilterChange: (status: 'all' | 'open' | 'closed') => void;
}

export function ConversationList({ 
  conversations, 
  selectedId, 
  onSelect, 
  searchQuery, 
  onSearchChange,
  statusFilter,
  onStatusFilterChange
}: Props) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Filter conversations
  const filtered = conversations.filter((c) => {
    if (statusFilter === 'open' && c.status !== 'open') return false;
    if (statusFilter === 'closed' && c.status === 'open') return false;
    return true;
  }).sort((a, b) => {
    const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  const formatShortTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const dist = formatDistanceToNowStrict(new Date(dateStr), { locale: ru });
      return dist
        .replace('минут', 'м')
        .replace('минуты', 'м')
        .replace('минута', 'м')
        .replace('часов', 'ч')
        .replace('часа', 'ч')
        .replace('час', 'ч')
        .replace('дней', 'д')
        .replace('дня', 'д')
        .replace('день', 'д')
        .replace('назад', '')
        .trim();
    } catch {
      return '';
    }
  };

  return (
    <div className="w-[290px] shrink-0 bg-white border border-slate-200/90 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm select-none text-xs">
      {/* Top Header & Dropdown Filters */}
      <div className="border-b border-slate-100">
        {/* Pane Title */}
        <div className="h-14 px-4 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-900">Все диалоги</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
              title="Поиск диалогов"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toggleable search input */}
        {showSearchInput && (
          <div className="px-3 pb-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Поиск по клиенту..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#283876] transition-colors"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filters row: e.g. "4 Открытых ▾" & "Сначала новые ▾" */}
        <div className="px-4 pb-2.5 flex items-center justify-between text-slate-500 text-xs">
          {/* Status Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="flex items-center gap-1 font-semibold text-slate-700 hover:text-[#283876] transition-colors py-0.5 cursor-pointer"
            >
              <span>{filtered.length} {statusFilter === 'open' ? 'Открытых' : statusFilter === 'closed' ? 'Закрытых' : 'Всех'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showStatusMenu && (
              <div 
                className="absolute left-0 top-6 w-36 rounded-xl bg-white border border-slate-200 shadow-xl p-1 z-50 text-xs animate-in fade-in duration-100"
                onMouseLeave={() => setShowStatusMenu(false)}
              >
                <button
                  onClick={() => { onStatusFilterChange('all'); setShowStatusMenu(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${statusFilter === 'all' ? 'bg-[#EEF2FF] text-[#283876] font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Все диалоги
                </button>
                <button
                  onClick={() => { onStatusFilterChange('open'); setShowStatusMenu(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${statusFilter === 'open' ? 'bg-[#EEF2FF] text-[#283876] font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Открытые
                </button>
                <button
                  onClick={() => { onStatusFilterChange('closed'); setShowStatusMenu(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${statusFilter === 'closed' ? 'bg-[#EEF2FF] text-[#283876] font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Закрытые
                </button>
              </div>
            )}
          </div>

          {/* Sort order toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors py-0.5 cursor-pointer font-medium"
          >
            <span>{sortOrder === 'newest' ? 'Сначала новые' : 'Сначала старые'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Conversation Thread List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((conv) => {
          const isSelected = String(selectedId) === String(conv.id);
          const customerName = conv.customer?.name || (conv.customer?.username ? `@${conv.customer.username}` : `Клиент #${conv.customer_id}`);
          const snippet = conv.last_message_preview || (conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : 'Диалог в Instagram Direct');
          const shortTime = formatShortTime(conv.last_message_at);
          const isAI = conv.mode === 'ai';

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`p-3 rounded-xl cursor-pointer transition-all duration-150 relative ${
                isSelected
                  ? 'bg-[#EEF2FF] border border-blue-200 text-slate-900 shadow-sm'
                  : 'hover:bg-slate-50 border border-transparent text-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Round Channel Badge */}
                <div className="relative shrink-0 mt-0.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${
                    isSelected
                      ? 'bg-[#283876] text-white shadow-[#283876]/20'
                      : 'bg-blue-50 text-[#283876] border border-blue-100'
                  }`}>
                    <span>IG</span>
                  </div>

                  {/* Mode sub-icon */}
                  {isAI ? (
                    <span className="w-4 h-4 rounded-full bg-white border border-blue-200 absolute -bottom-0.5 -right-0.5 flex items-center justify-center text-[#283876]" title="AI-бот активен">
                      <Bot className="w-2.5 h-2.5" />
                    </span>
                  ) : (
                    <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white absolute -bottom-0.5 -right-0.5" title="Оператор" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className={`font-bold text-xs truncate ${isSelected ? 'text-[#283876]' : 'text-slate-900'}`}>
                      {customerName}
                    </h3>
                    {shortTime && (
                      <span className="text-xs text-slate-400 font-mono shrink-0 ml-1">
                        {shortTime}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 truncate leading-relaxed">
                    {snippet}
                  </p>

                  {/* Unread badge */}
                  {conv.unread_count > 0 && (
                    <div className="mt-1 flex justify-end">
                      <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.2 rounded-full shadow-sm">
                        {conv.unread_count}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            Диалоги не найдены
          </div>
        )}
      </div>

      {/* Bottom Status Pill */}
      <div className="p-2.5 border-t border-slate-100 flex items-center justify-center">
        <div className="bg-slate-50 border border-slate-200/80 rounded-full px-3.5 py-1 flex items-center gap-2 text-slate-600 text-xs shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-800 font-semibold">Direct Live</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500 font-mono">24/7</span>
        </div>
      </div>
    </div>
  );
}
