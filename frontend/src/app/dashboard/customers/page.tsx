'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Customer, Booking } from '@/lib/types';
import { 
  Search, Phone, Mail, AtSign, Calendar, MessageSquare, 
  X, Check, Edit2, Clock, ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Selected customer for drawer
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
    <div className="p-8 h-full flex flex-col bg-[#F8FAFC] overflow-hidden text-slate-900">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-[#283876] border border-blue-100">
              База клиентов
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Всего: {customers.length}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Клиентский реестр TC
          </h1>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Поиск по имени, телефону, @нику..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#283876] shadow-sm transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider sticky top-0 z-10 font-bold">
              <tr>
                <th className="px-6 py-4">Клиент</th>
                <th className="px-6 py-4">Instagram</th>
                <th className="px-6 py-4">Телефон</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Активность</th>
                <th className="px-6 py-4 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#283876] border-t-transparent rounded-full animate-spin" />
                      <span>Загрузка данных...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
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
                      className="hover:bg-slate-50/80 transition-colors duration-150"
                    >
                      {/* Name & Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-xs text-[#283876] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {customer.name}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              ID: #{customer.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-6 py-4">
                        {customer.username ? (
                          <div className="flex items-center gap-1.5 text-[#283876] font-mono font-semibold text-xs">
                            <AtSign className="w-3.5 h-3.5" />
                            <span>{customer.username}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4 font-mono text-xs text-slate-700 font-medium">
                        {customer.phone ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{customer.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {customer.email || <span className="text-slate-400">-</span>}
                      </td>

                      {/* Last contact */}
                      <td className="px-6 py-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
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
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-[#283876] border border-blue-200 transition-colors cursor-pointer"
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

      {/* Slide-over Drawer for "Подробнее" */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-white border-l border-slate-200 h-full overflow-y-auto flex flex-col shadow-2xl p-6 sm:p-8 animate-in slide-in-from-right duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-base text-[#283876]">
                  {(selectedCustomer.name || 'К').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedCustomer.username && (
                      <span className="text-xs text-[#283876] font-mono font-semibold">@{selectedCustomer.username}</span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                      Клиент #{selectedCustomer.id}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="py-4 flex gap-2.5">
              <button
                onClick={() => handleGoToChat(selectedCustomer)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#283876] hover:bg-[#1E2C60] text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-[#283876]/20"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Открыть диалог</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Edit2 className="w-4 h-4 text-slate-500" />
                <span>{isEditing ? 'Отмена' : 'Редактировать'}</span>
              </button>
            </div>

            {saveSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 font-medium">
                <Check className="w-4 h-4" />
                <span>Данные клиента успешно сохранены!</span>
              </div>
            )}

            {/* Profile Info */}
            <div className="space-y-4 py-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Карточка контакта
              </div>

              {isEditing ? (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="text-xs text-slate-600 font-semibold block mb-1">ФИО / Имя</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 font-semibold block mb-1">Номер телефона</label>
                    <input
                      type="text"
                      placeholder="+996..."
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 font-semibold block mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="client@mail.com"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 font-semibold block mb-1">Заметки оператора</label>
                    <textarea
                      rows={3}
                      placeholder="Интересуется услугой, бюджетом и т.д."
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                    />
                  </div>
                  <button
                    onClick={handleSaveCustomer}
                    disabled={saving}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>{saving ? 'Сохранение...' : 'Сохранить изменения'}</span>
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <Phone className="w-4 h-4 text-slate-400" /> Телефон:
                    </span>
                    <span className="font-mono text-emerald-700 font-semibold">{selectedCustomer.phone || 'Не указан'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <Mail className="w-4 h-4 text-slate-400" /> Email:
                    </span>
                    <span className="text-slate-900 font-medium">{selectedCustomer.email || 'Не указан'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <AtSign className="w-4 h-4 text-slate-400" /> Instagram ID:
                    </span>
                    <span className="font-mono text-slate-600">{selectedCustomer.instagram_id || '-'}</span>
                  </div>
                  {selectedCustomer.notes && (
                    <div className="pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-500 font-medium block mb-1">Заметки:</span>
                      <p className="text-slate-800 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                        {selectedCustomer.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Bookings */}
              <div className="pt-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#283876]" />
                    Записи клиента ({customerBookings.length})
                  </span>
                </div>

                {customerBookings.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs">
                    У клиента пока нет оформленных записей
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {customerBookings.map((b) => (
                      <div key={b.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-bold text-[#283876]">{b.booking_number}</span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            b.status === 'awaiting_confirmation' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {b.status === 'confirmed' ? 'Подтверждена' : 'Ожидает'}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900">{b.service_name_snapshot}</div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                          <span>{b.scheduled_at ? new Date(b.scheduled_at).toLocaleString('ru-RU') : 'Время согласовывается'}</span>
                          <span className="font-bold text-[#283876]">{b.price_snapshot} {b.currency}</span>
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
