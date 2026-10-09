'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Customer, Booking } from '@/lib/types';
import { 
  Search, User, Phone, Mail, AtSign, Calendar, MessageSquare, 
  X, Check, Edit2, Tag, Clock, ArrowRight, Shield, Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Selected customer for "Подробнее" modal/drawer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchCustomers = async () => {
    try {
      const data = await api.getCustomers(search);
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const handleOpenDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditing(false);
    setEditForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
    });
    // Fetch bookings for this customer
    try {
      const bookings = await api.getBookings({ customer_id: customer.id });
      setCustomerBookings(bookings);
    } catch (err) {
      setCustomerBookings([]);
    }
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    try {
      const updated = await api.updateCustomer(selectedCustomer.id, editForm);
      setSelectedCustomer(updated);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      fetchCustomers();
    } catch (err) {
      alert('Ошибка при сохранении данных клиента');
    } finally {
      setSaving(false);
    }
  };

  const handleGoToChat = (customer: Customer) => {
    router.push(`/dashboard/conversations?customer_id=${customer.id}`);
  };

  return (
    <div className="p-8 h-full flex flex-col bg-[#070b14] overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-widest">
              База клиентов
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400">Всего: {customers.length}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Клиентский реестр
          </h1>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Поиск по имени, телефону, @нику..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/70 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-3 text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-mono text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold">Клиент</th>
                <th className="px-6 py-4 font-semibold">Instagram</th>
                <th className="px-6 py-4 font-semibold">Телефон</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Активность</th>
                <th className="px-6 py-4 font-semibold text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span>Загрузка клиентских данных...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    Клиенты не найдены
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const initials = (customer.name || 'К')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr 
                      key={customer.id} 
                      className="hover:bg-slate-800/40 transition-colors duration-150 group"
                    >
                      {/* Name & Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600/30 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                              {customer.name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              ID: #{customer.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-6 py-4">
                        {customer.username ? (
                          <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-xs">
                            <AtSign className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{customer.username}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4 font-mono text-xs text-slate-300">
                        {customer.phone ? (
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <Phone className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{customer.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {customer.email || <span className="text-slate-600">-</span>}
                      </td>

                      {/* Last contact */}
                      <td className="px-6 py-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {customer.last_contact_at
                              ? formatDistanceToNow(new Date(customer.last_contact_at), { addSuffix: true, locale: ru })
                              : 'нет'}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenDetails(customer)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all duration-150 shadow-sm"
                        >
                          Подробнее
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Modal / Drawer for "Подробнее" */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
          <div className="w-full max-w-lg bg-[#0a0f1d] border-l border-slate-800 h-full overflow-y-auto flex flex-col shadow-2xl p-6 sm:p-8 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-start justify-between pb-6 border-b border-slate-800/80">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20">
                  {(selectedCustomer.name || 'К').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white font-mono">{selectedCustomer.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedCustomer.username && (
                      <span className="text-xs text-indigo-400 font-mono">@{selectedCustomer.username}</span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      Клиент #{selectedCustomer.id}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="py-4 flex gap-3">
              <button
                onClick={() => handleGoToChat(selectedCustomer)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Открыть переписку</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4 text-slate-400" />
                <span>{isEditing ? 'Отмена' : 'Редактировать'}</span>
              </button>
            </div>

            {saveSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Данные клиента успешно обновлены!</span>
              </div>
            )}

            {/* Editable or Readonly Info */}
            <div className="space-y-4 py-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                Карточка контакта
              </div>

              {isEditing ? (
                <div className="space-y-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">ФИО / Имя</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Номер телефона</label>
                    <input
                      type="text"
                      placeholder="+996..."
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="client@mail.com"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Заметки оператора</label>
                    <textarea
                      rows={3}
                      placeholder="Интересуется услугой, бюджетом и т.д."
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleSaveCustomer}
                    disabled={saving}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{saving ? 'Сохранение...' : 'Сохранить изменения'}</span>
                  </button>
                </div>
              ) : (
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500" /> Телефон:
                    </span>
                    <span className="font-mono text-emerald-400">{selectedCustomer.phone || 'Не указан'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-500" /> Email:
                    </span>
                    <span className="text-slate-300">{selectedCustomer.email || 'Не указан'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-2">
                      <AtSign className="w-4 h-4 text-slate-500" /> Instagram ID:
                    </span>
                    <span className="font-mono text-xs text-slate-400">{selectedCustomer.instagram_id || '-'}</span>
                  </div>
                  {selectedCustomer.notes && (
                    <div className="pt-2 border-t border-slate-800 text-sm">
                      <span className="text-slate-400 block text-xs mb-1">Заметки:</span>
                      <p className="text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-xs">
                        {selectedCustomer.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Bookings Dossier */}
              <div className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    Записи клиента ({customerBookings.length})
                  </span>
                </div>

                {customerBookings.length === 0 ? (
                  <div className="text-center py-6 bg-slate-900/40 border border-slate-800/60 rounded-xl text-slate-500 text-xs">
                    У клиента пока нет оформленных записей
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {customerBookings.map((b) => (
                      <div key={b.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-bold text-indigo-400">{b.booking_number}</span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            b.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                            b.status === 'awaiting_confirmation' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {b.status === 'confirmed' ? 'Подтверждена' : 'Ожидает'}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-slate-200">{b.service_name_snapshot}</div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                          <span>{b.scheduled_at ? new Date(b.scheduled_at).toLocaleString('ru-RU') : 'Время согласовывается'}</span>
                          <span className="font-semibold text-slate-300">{b.price_snapshot} {b.currency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
