'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Booking } from '@/lib/types';
import { 
  Check, X, Calendar as CalendarIcon, Clock, User, Phone, 
  Send, AlertCircle, Sparkles, Filter, CheckCircle2, XCircle
} from 'lucide-react';

const TABS = [
  { id: 'all', label: 'Все записи' },
  { id: 'awaiting_confirmation', label: 'Ожидают подтверждения' },
  { id: 'confirmed', label: 'Подтверждённые' },
  { id: 'completed', label: 'Завершенные' },
  { id: 'cancelled', label: 'Отменённые' },
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  
  // Decline modal state
  const [declineBooking, setDeclineBooking] = useState<Booking | null>(null);
  const [declineReason, setDeclineReason] = useState('Выбранное время уже занято другим клиентом');
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      const data = await api.getBookings(activeTab !== 'all' ? { status: activeTab } : {});
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBookings();
  }, [activeTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleConfirm = async (booking: Booking) => {
    setActionLoading(true);
    try {
      await api.confirmBooking(booking.id);
      showToast(`Запись ${booking.booking_number} подтверждена! Клиенту отправлено уведомление в Instagram Direct 🎉`);
      fetchBookings();
    } catch (err) {
      alert('Ошибка при подтверждении записи');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineSubmit = async () => {
    if (!declineBooking) return;
    setActionLoading(true);
    try {
      await api.cancelBooking(declineBooking.id, declineReason);
      showToast(`Запись ${declineBooking.booking_number} отклонена! Клиенту отправлено предложение выбрать другой слот 📩`);
      setDeclineBooking(null);
      fetchBookings();
    } catch (err) {
      alert('Ошибка при отклонении записи');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col bg-[#070b14] overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 border border-emerald-500/40 text-emerald-300 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">
              Flight Board
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400">График консультаций</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Реестр бронирований
          </h1>

          {/* Status Tabs */}
          <div className="flex gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flight Board Table */}
      <div className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-mono text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold">Код брони</th>
                <th className="px-6 py-4 font-semibold">Клиент</th>
                <th className="px-6 py-4 font-semibold">Услуга</th>
                <th className="px-6 py-4 font-semibold">Тариф</th>
                <th className="px-6 py-4 font-semibold">Время сессии</th>
                <th className="px-6 py-4 font-semibold">Статус</th>
                <th className="px-6 py-4 font-semibold text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span>Синхронизация записей...</span>
                    </div>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500 font-mono">
                    В выбранной категории записей не найдено
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const date = booking.scheduled_at ? new Date(booking.scheduled_at) : new Date(booking.created_at);
                  const isActionable = booking.status === 'awaiting_confirmation' || booking.status === 'draft';

                  return (
                    <tr key={booking.id} className="hover:bg-slate-800/40 transition-colors duration-150 group">
                      {/* Booking Code (Flight ticket style) */}
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg inline-block">
                          {booking.booking_number}
                        </div>
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                          {booking.customer_name || `Клиент #${booking.customer_id}`}
                        </div>
                        {booking.customer_phone ? (
                          <div className="text-xs text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-500" />
                            <span>{booking.customer_phone}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">Телефон не указан</div>
                        )}
                      </td>

                      {/* Service */}
                      <td className="px-6 py-4">
                        <div className="text-slate-200 font-medium text-xs">
                          {booking.service?.name || booking.service_name_snapshot}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Формат: {booking.meeting_type === 'online' ? 'Онлайн (Zoom)' : 'Офис'} • {booking.duration_minutes} мин
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-bold text-indigo-400">
                          {booking.price_snapshot} {booking.currency}
                        </span>
                      </td>

                      {/* Scheduled Time */}
                      <td className="px-6 py-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                          <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{date.toLocaleDateString('ru-RU')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 font-mono mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border uppercase inline-flex items-center gap-1.5 ${
                          booking.status === 'confirmed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                          booking.status === 'awaiting_confirmation' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                          booking.status === 'completed' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                          booking.status === 'cancelled' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                          'bg-slate-800 border-slate-700 text-slate-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            booking.status === 'confirmed' ? 'bg-emerald-400 animate-pulse' :
                            booking.status === 'awaiting_confirmation' ? 'bg-amber-400 animate-pulse' :
                            booking.status === 'completed' ? 'bg-blue-400' :
                            booking.status === 'cancelled' ? 'bg-rose-400' : 'bg-slate-400'
                          }`} />
                          {booking.status === 'confirmed' ? 'Подтверждена' :
                           booking.status === 'awaiting_confirmation' ? 'Ожидает' :
                           booking.status === 'completed' ? 'Завершена' :
                           booking.status === 'cancelled' ? 'Отменена' : 'Черновик'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {isActionable ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleConfirm(booking)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm"
                              title="Подтвердить и отправить сообщение клиенту"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Подтвердить</span>
                            </button>
                            <button
                              onClick={() => setDeclineBooking(booking)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium text-xs flex items-center gap-1.5 transition-all"
                              title="Отклонить и предложить другое время"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Отклонить</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decline Reason Modal */}
      {declineBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">Отклонить запись</h3>
                <p className="text-xs text-slate-400">Бронь {declineBooking.booking_number}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              Клиенту в Instagram Direct будет автоматически отправлено вежливое сообщение с объяснением и предложением выбрать другое время.
            </p>

            <div className="mb-4">
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">Причина для клиента:</label>
              <textarea
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeclineBooking(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleDeclineSubmit}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Отправка...' : 'Отклонить и уведомить'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
