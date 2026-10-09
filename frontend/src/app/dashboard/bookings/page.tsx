'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Booking } from '@/lib/types';
import { 
  Check, X, Calendar as CalendarIcon, Clock, Phone, 
  AlertCircle, CheckCircle2
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
    <div className="p-8 h-full flex flex-col bg-[#F8FAFC] overflow-hidden text-slate-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-emerald-300 text-emerald-800 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in duration-150">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-[#283876] border border-blue-100">
            Консультации
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-500 font-medium">График записей</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Реестр бронирований TC
          </h1>

          {/* Status Tabs */}
          <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200/90 shadow-sm overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#283876] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider sticky top-0 z-10 font-bold">
              <tr>
                <th className="px-6 py-4">Код брони</th>
                <th className="px-6 py-4">Клиент</th>
                <th className="px-6 py-4">Услуга</th>
                <th className="px-6 py-4">Тариф</th>
                <th className="px-6 py-4">Время сессии</th>
                <th className="px-6 py-4">Статус</th>
                <th className="px-6 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#283876] border-t-transparent rounded-full animate-spin" />
                      <span>Синхронизация записей...</span>
                    </div>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    В выбранной категории записей не найдено
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const date = booking.scheduled_at ? new Date(booking.scheduled_at) : new Date(booking.created_at);
                  const isActionable = booking.status === 'awaiting_confirmation' || booking.status === 'draft';

                  return (
                    <tr key={booking.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                      {/* Booking Code */}
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-bold text-[#283876] bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md inline-block">
                          {booking.booking_number}
                        </div>
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">
                          {booking.customer_name || `Клиент #${booking.customer_id}`}
                        </div>
                        {booking.customer_phone ? (
                          <div className="text-xs text-emerald-600 font-mono font-semibold flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{booking.customer_phone}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">Телефон не указан</div>
                        )}
                      </td>

                      {/* Service */}
                      <td className="px-6 py-4">
                        <div className="text-slate-900 font-bold text-xs">
                          {booking.service?.name || booking.service_name_snapshot}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Формат: {booking.meeting_type === 'online' ? 'Онлайн (Zoom)' : 'Офис'} • {booking.duration_minutes} мин
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {booking.price_snapshot} {booking.currency}
                        </span>
                      </td>

                      {/* Scheduled Time */}
                      <td className="px-6 py-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-800 font-mono font-semibold">
                          <CalendarIcon className="w-3.5 h-3.5 text-[#283876]" />
                          <span>{date.toLocaleDateString('ru-RU')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 font-mono mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 ${
                          booking.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          booking.status === 'awaiting_confirmation' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          booking.status === 'completed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          booking.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            booking.status === 'confirmed' ? 'bg-emerald-500' :
                            booking.status === 'awaiting_confirmation' ? 'bg-amber-500' :
                            booking.status === 'completed' ? 'bg-blue-500' :
                            booking.status === 'cancelled' ? 'bg-rose-500' : 'bg-slate-400'
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
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                              title="Подтвердить и отправить сообщение клиенту"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Подтвердить</span>
                            </button>
                            <button
                              onClick={() => setDeclineBooking(booking)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                              title="Отклонить и предложить другое время"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Отклонить</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Отклонить запись</h3>
                <p className="text-xs text-slate-500 font-mono">Бронь #{declineBooking.booking_number}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Клиенту в Instagram Direct будет отправлено автоматическое сообщение с объяснением и предложением выбрать другое время.
            </p>

            <div className="mb-4">
              <label className="text-xs text-slate-700 font-bold block mb-1.5">Причина для клиента:</label>
              <textarea
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#283876]"
              />
            </div>

            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setDeclineBooking(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={handleDeclineSubmit}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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
