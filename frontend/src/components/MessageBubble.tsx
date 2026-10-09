'use client';

import { Message } from '@/lib/types';
import { Bot, User } from 'lucide-react';

export function MessageBubble({ message }: { message: Message }) {
  const isCustomer = message.sender_type === 'customer';
  const isAI = message.sender_type === 'ai';
  const isEmployee = message.sender_type === 'employee';

  return (
    <div className={`flex w-full mb-4 ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      {!isCustomer && (
        <div className="mr-3 flex-shrink-0 mt-auto mb-1">
          {isAI ? (
            <div className="bg-indigo-500/20 p-1.5 rounded-full text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
          ) : isEmployee ? (
            <div className="bg-emerald-500/20 p-1.5 rounded-full text-emerald-400">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="bg-slate-500/20 p-1.5 rounded-full text-slate-400">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>
      )}

      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
        isCustomer 
          ? 'bg-slate-700 text-slate-100 rounded-br-none' 
          : isAI
            ? 'bg-indigo-600 text-white rounded-bl-none'
            : isEmployee
              ? 'bg-emerald-600 text-white rounded-bl-none'
              : 'bg-slate-800 text-slate-300 rounded-bl-none'
      }`}>
        <div className="whitespace-pre-wrap break-words text-sm">{message.text}</div>
        <div className={`text-[10px] mt-1 text-right opacity-60`}>
          {new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
