'use client';

import { Customer, Booking } from '@/lib/types';
import { User, Phone, Mail, AtSign, Clock, Calendar as CalendarIcon, Tag, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  customer: Customer;
  bookings: Booking[];
  onConfirmBooking: (id: string) => void;
  onCancelBooking: (id: string) => void;
}

export function CustomerPanel({ customer, bookings, onConfirmBooking, onCancelBooking }: Props) {
  return (
    <div className="w-80 bg-slate-900 overflow-y-auto h-full flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 text-indigo-400">
            <User className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">{customer.name}</h2>
          {customer.username && <p className="text-slate-400 text-sm">@{customer.username}</p>}
        </div>

        <div className="mt-6 space-y-3 text-sm">
          {customer.phone && (
            <div className="flex items-center text-slate-300 gap-3">
              <Phone className="w-4 h-4 text-slate-500" />
              <span>{customer.phone}</span>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center text-slate-300 gap-3">
              <Mail className="w-4 h-4 text-slate-500" />
              <span>{customer.email}</span>
            </div>
          )}
          {customer.instagram_id && (
            <div className="flex items-center text-slate-300 gap-3">
              <AtSign className="w-4 h-4 text-slate-500" />
              <span>IG: {customer.instagram_id}</span>
            </div>
          )}
          <div className="flex items-center text-slate-400 gap-3 pt-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs">
              Был(а) {customer.last_contact_at ? formatDistanceToNow(new Date(customer.last_contact_at), { addSuffix: true, locale: ru }) : 'никогда'}
            </span>
          </div>
        </div>

        {customer.tags && customer.tags.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Tag className="w-3 h-3" />
              Теги
            </h3>
            <div className="flex flex-wrap gap-2">
              {customer.tags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          Записи ({bookings.length})
        </h3>
        
        {bookings.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Нет записей</p>
        ) : (
          <div className="space-y-3">
            {bookings.map(booking => {
              const date = booking.scheduled_at ? new Date(booking.scheduled_at) : new Date(booking.created_at);
              const isActionable = booking.status === 'awaiting_confirmation' || booking.status === 'draft';

              return (
                <div key={booking.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-slate-200 text-sm truncate">{booking.service?.name || booking.service_name_snapshot}</div>
                    <span className="text-indigo-400 font-semibold text-sm">{booking.price_snapshot} {booking.currency}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mb-2 font-mono">{booking.booking_number}</div>
                  
                  <div className="text-xs text-slate-400 mb-3">
                    {booking.scheduled_at
                      ? `${date.toLocaleDateString('ru-RU')} в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
                      : `Создана: ${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
                    } ({booking.duration_minutes} мин)
                  </div>

                  {booking.customer_phone && (
                    <div className="text-xs text-slate-300 mb-2 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{booking.customer_phone}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                      booking.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                      booking.status === 'awaiting_confirmation' ? 'bg-amber-500/20 text-amber-400' :
                      booking.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                      booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {booking.status === 'confirmed' ? 'Подтверждена' :
                       booking.status === 'awaiting_confirmation' ? 'Ожидает' :
                       booking.status === 'completed' ? 'Завершена' :
                       booking.status === 'cancelled' ? 'Отменена' : 'Черновик'}
                    </span>

                    {isActionable && (
                      <div className="flex gap-1">
                        <button onClick={() => onConfirmBooking(booking.id)} className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded transition-colors" title="Подтвердить">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onCancelBooking(booking.id)} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors" title="Отменить">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
