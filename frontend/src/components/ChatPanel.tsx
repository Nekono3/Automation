'use client';

import { Conversation, Message } from '@/lib/types';
import { 
  Send, 
  Bot, 
  User, 
  Pause, 
  Sparkles, 
  Zap, 
  Star, 
  Clock, 
  MoreHorizontal, 
  ChevronDown, 
  CheckCircle2
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

interface Props {
  conversation: Conversation;
  messages: Message[];
  onModeChange: (mode: 'ai' | 'human' | 'paused') => void;
  onMessageSent: () => void;
  onOpenCopilot?: () => void;
}

const QUICK_TEMPLATES = [
  'Здравствуйте! Готовы провести экспресс-аудит ваших шансов на грант 🎓',
  'Ваша консультация успешно подтверждена! Ссылку на Zoom отправили вам в Direct 🚀',
  'Подскажите, пожалуйста, какой у вас уровень языка (IELTS/TOEFL) и целевая страна?',
  'Консультация длится 30 минут в онлайн формате Zoom. Слоты доступны на этой неделе.',
];

export function ChatPanel({ conversation, messages, onModeChange, onMessageSent, onOpenCopilot }: Props) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [replyType, setReplyType] = useState<'reply' | 'note'>('reply');
  const [showMacros, setShowMacros] = useState(false);
  const [showReplyMenu, setShowReplyMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isWA = conversation.channel === 'whatsapp';
  const isTG = conversation.channel === 'telegram';
  const customerName = conversation.customer?.name || (conversation.customer?.username ? `@${conversation.customer.username}` : (isWA && conversation.customer?.phone ? conversation.customer.phone : `Клиент #${conversation.customer_id}`));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyTemplate = (tpl: string) => {
    setInputText(tpl);
    setShowMacros(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm select-text relative min-w-[380px]">
      {/* Header */}
      <div className="h-14 px-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        {/* Left: Customer Context */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 truncate">
            <h2 className="font-bold text-sm text-slate-900 truncate">
              {customerName}
            </h2>
            {conversation.customer?.username && (
              <span className="text-xs text-[#283876] font-mono hidden sm:inline truncate font-semibold">
                @{conversation.customer.username}
              </span>
            )}
            {isWA && conversation.customer?.phone && !conversation.customer.phone.includes('@lid') && (
              <span className="text-xs text-emerald-700 font-mono hidden sm:inline truncate font-semibold">
                {conversation.customer.phone}
              </span>
            )}
          </div>

          {isWA ? (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
              <span>WhatsApp Business</span>
            </div>
          ) : isTG ? (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-xs text-sky-800 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0088CC]" />
              <span>Telegram</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-xs text-[#283876] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#283876]" />
              <span>Instagram Direct</span>
            </div>
          )}
        </div>

        {/* Right Toolbar: Mode Switcher, Star, Snooze */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mode Switcher */}
          <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex items-center text-xs">
            <button
              onClick={() => onModeChange('ai')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
                conversation.mode === 'ai'
                  ? 'bg-[#283876] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="AI-ассистент отвечает клиенту"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI-бот</span>
            </button>
            <button
              onClick={() => onModeChange('human')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
                conversation.mode === 'human'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ручной ответ оператора"
            >
              <User className="w-3.5 h-3.5" />
              <span>Оператор</span>
            </button>
            <button
              onClick={() => onModeChange('paused')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                conversation.mode === 'paused'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Пауза"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action icon buttons */}
          <button
            onClick={() => setIsStarred(!isStarred)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isStarred
                ? 'bg-amber-50 border-amber-200 text-amber-500'
                : 'border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50'
            }`}
            title="Отметить диалог"
          >
            <Star className="w-4 h-4 fill-current" />
          </button>

          <button
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Отложить"
          >
            <Clock className="w-4 h-4" />
          </button>

          <button
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Опции диалога"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8FAFC]">
        <div className="text-center py-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-medium">
              {isWA ? 'Канал защищен • Meta WhatsApp Cloud API' : isTG ? 'Канал защищен • Telegram Bot API' : 'Канал защищен • Прямая связь с Instagram Direct'}
            </span>
          </div>
        </div>

        {messages.map((msg, idx) => {
          const date = new Date(msg.created_at);
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const showSeparator = !prevMsg || new Date(prevMsg.created_at).toDateString() !== date.toDateString();

          const isCustomer = msg.sender_type === 'customer';
          const isAI = msg.sender_type === 'ai';

          return (
            <div key={msg.id} className="space-y-2">
              {showSeparator && (
                <div className="flex justify-center my-3">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white text-slate-500 border border-slate-200 shadow-sm">
                    {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                  </span>
                </div>
              )}

              <div className={`flex items-start gap-3 ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                {/* Customer avatar on left */}
                {isCustomer && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                    {(customerName || 'К').slice(0, 1).toUpperCase()}
                  </div>
                )}

                {/* Message Bubble Card */}
                <div className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${
                  isCustomer
                    ? 'bg-white border border-slate-200/90 text-slate-900 rounded-tl-sm'
                    : isAI
                      ? 'bg-[#EEF2FF] border border-blue-200/90 text-slate-900 rounded-tr-sm'
                      : 'bg-[#ECFDF5] border border-emerald-200/90 text-slate-900 rounded-tr-sm'
                }`}>
                  {/* Sender metadata */}
                  <div className="flex items-center justify-between gap-3 text-xs mb-1.5 opacity-80">
                    <span className="font-bold flex items-center gap-1.5">
                      {isCustomer ? (
                        <span className="text-slate-800">{customerName}</span>
                      ) : isAI ? (
                        <span className="text-[#283876] flex items-center gap-1 font-semibold">
                          <Bot className="w-3.5 h-3.5" /> AI-ассистент TC
                        </span>
                      ) : (
                        <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                          <User className="w-3.5 h-3.5" /> Оператор CRM
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-slate-400 text-xs">
                      {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Body Text */}
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                    {msg.text}
                  </div>
                </div>

                {/* Operator/AI avatar on right */}
                {!isCustomer && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm ${
                    isAI
                      ? 'bg-[#283876] text-white shadow-[#283876]/20'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {isAI ? <Bot className="w-4 h-4" /> : 'OP'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Macros Drawer */}
      {showMacros && (
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-wrap gap-2 animate-in fade-in duration-100">
          <div className="w-full flex items-center justify-between text-xs text-slate-700 mb-1">
            <span className="font-bold flex items-center gap-1 text-[#283876]">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Быстрые шаблоны ответов:
            </span>
            <button onClick={() => setShowMacros(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer text-xs">
              Закрыть
            </button>
          </div>
          {QUICK_TEMPLATES.map((tpl, i) => (
            <button
              key={i}
              onClick={() => applyTemplate(tpl)}
              className="text-left text-xs bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#283876] px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer truncate max-w-full font-medium"
            >
              {tpl}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:bg-white focus-within:border-[#283876] focus-within:ring-2 focus-within:ring-[#283876]/10 transition-all shadow-inner">
          {/* Top of Composer */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80 text-xs">
            <div className="relative">
              <button
                onClick={() => setShowReplyMenu(!showReplyMenu)}
                className="flex items-center gap-1.5 font-bold text-slate-800 hover:text-[#283876] transition-colors cursor-pointer"
              >
                <span>{replyType === 'reply' ? (isWA ? 'Ответ в WhatsApp' : isTG ? 'Ответ в Telegram' : 'Ответ в Direct') : 'Внутренняя заметка'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showReplyMenu && (
                <div 
                  className="absolute left-0 bottom-6 w-44 rounded-xl bg-white border border-slate-200 shadow-xl p-1 z-50 text-xs"
                  onMouseLeave={() => setShowReplyMenu(false)}
                >
                  <button
                    onClick={() => { setReplyType('reply'); setShowReplyMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium cursor-pointer"
                  >
                    {isWA ? 'Ответ в WhatsApp' : isTG ? 'Ответ в Telegram' : 'Ответ в Direct'}
                  </button>
                  <button
                    onClick={() => { setReplyType('note'); setShowReplyMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium cursor-pointer"
                  >
                    Внутренняя заметка
                  </button>
                </div>
              )}
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Enter — отправить • Shift+Enter — перенос
            </span>
          </div>

          {/* Text input area */}
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              conversation.mode === 'ai'
                ? 'Напишите ответ клиенту (отправка переключит режим на оператора)...'
                : isWA
                  ? 'Введите сообщение в WhatsApp Business...'
                  : isTG
                    ? 'Введите сообщение в Telegram...'
                    : 'Введите сообщение в Instagram Direct...'
            }
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
          />

          {/* Bottom Bar: Quick templates & Send button */}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200/80">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowMacros(!showMacros)}
                className="p-2 rounded-xl text-slate-500 hover:text-amber-500 hover:bg-amber-50 transition-colors cursor-pointer"
                title="Быстрые шаблоны"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenCopilot}
                className="px-2.5 py-1.5 rounded-xl text-xs text-[#283876] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer font-semibold"
                title="Использовать подсказку AI"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI подсказка</span>
              </button>
            </div>

            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || sending}
              className="bg-[#283876] hover:bg-[#1E2C60] text-white px-5 py-2 rounded-xl font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md shadow-[#283876]/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Отправка...' : 'Отправить'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
