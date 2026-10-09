'use client';

import { Conversation, Message } from '@/lib/types';
import { MessageBubble } from './MessageBubble';
import { Send, Bot, User, Pause, Sparkles, Zap, MessageSquare, AtSign, Clock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

interface Props {
  conversation: Conversation;
  messages: Message[];
  onModeChange: (mode: 'ai' | 'human' | 'paused') => void;
  onMessageSent: () => void;
}

const QUICK_TEMPLATES = [
  'Здравствуйте! Чем могу вам помочь?',
  'Ваша запись подтверждена, ссылка на Zoom отправлена! 🚀',
  'Подскажите, пожалуйста, удобный день и время для встречи?',
  'Консультация длится 30 минут, формат — онлайн в Zoom или в офисе.',
];

export function ChatPanel({ conversation, messages, onModeChange, onMessageSent }: Props) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const customerName = conversation.customer?.name || (conversation.customer?.username ? `@${conversation.customer.username}` : `Клиент #${conversation.customer_id}`);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
      // If conversation is in AI mode, switch to human mode so AI does not talk over the operator
      if (conversation.mode === 'ai') {
        await onModeChange('human');
      }
      await api.sendMessage(conversation.id, inputText.trim());
      setInputText('');
      onMessageSent();
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  const handleApplyTemplate = (tpl: string) => {
    setInputText(tpl);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#070b14] border-r border-slate-800/80 h-full overflow-hidden select-text">
      {/* Top Header */}
      <div className="h-20 border-b border-slate-800/80 flex items-center justify-between px-6 bg-[#0a0f1d]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white shadow-md shadow-indigo-600/20">
            {(conversation.customer?.name || 'К').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-white font-mono">{customerName}</h2>
              {conversation.customer?.username && (
                <span className="text-xs text-indigo-400 font-mono">@{conversation.customer.username}</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Instagram Direct</span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80 uppercase text-[10px] font-bold">
                {conversation.status === 'open' ? 'Открыт' : conversation.status === 'closed' ? 'Закрыт' : 'В архиве'}
              </span>
            </div>
          </div>
        </div>

        {/* Mode Toggle Controls */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950/90 p-1 rounded-xl border border-slate-800 flex text-xs shadow-inner">
            <button
              onClick={() => onModeChange('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 font-semibold ${
                conversation.mode === 'ai'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="ИИ отвечает клиенту самостоятельно"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>ИИ-бот</span>
            </button>
            <button
              onClick={() => onModeChange('human')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 font-semibold ${
                conversation.mode === 'human'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Ручной ответ оператора"
            >
              <User className="w-3.5 h-3.5" />
              <span>Оператор</span>
            </button>
            <button
              onClick={() => onModeChange('paused')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 font-semibold ${
                conversation.mode === 'paused'
                  ? 'bg-slate-800 text-slate-200 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Пауза ответов"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Пауза</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#070b14]/50">
        {messages.map((msg, i) => {
          const date = new Date(msg.created_at);
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const showSeparator = !prevMsg || new Date(prevMsg.created_at).toDateString() !== date.toDateString();

          return (
            <div key={msg.id}>
              {showSeparator && (
                <div className="flex justify-center my-6">
                  <span className="text-[11px] font-mono px-3 py-1 bg-slate-900/90 rounded-full text-slate-400 border border-slate-800 shadow-sm">
                    {date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>
              )}
              <MessageBubble message={msg} />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Templates Bar */}
      <div className="px-6 py-2 bg-[#0a0f1d]/50 border-t border-slate-800/40 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono uppercase font-bold shrink-0">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Быстрый ответ:</span>
        </div>
        {QUICK_TEMPLATES.map((tpl, idx) => (
          <button
            key={idx}
            onClick={() => handleApplyTemplate(tpl)}
            className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs whitespace-nowrap transition-colors shrink-0"
          >
            {tpl}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-[#0a0f1d] border-t border-slate-800/80 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2.5 items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              conversation.mode === 'ai'
                ? 'Напишите ответ (отправка автоматически переключит режим на Оператора)...'
                : 'Введите ответ клиенту в Instagram Direct...'
            }
            disabled={sending}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white px-5 py-3 rounded-xl transition-all font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-600/25 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Отправить</span>
          </button>
        </form>
      </div>
    </div>
  );
}
