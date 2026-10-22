'use client';

import { useState, useEffect } from 'react';
import { 
  Trophy, 
  GraduationCap, 
  Plus, 
  MoreHorizontal, 
  CheckCircle2, 
  Clock, 
  FileText, 
  User, 
  DollarSign, 
  ChevronRight,
  Filter,
  ArrowRight,
  Phone,
  ExternalLink,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import { Deal } from '@/lib/types';
import { ChannelBadge, WhatsAppIcon, InstagramIcon } from '@/components/ChannelIcons';

function getCustomerDisplay(deal: Deal) {
  const cust = deal.customer;
  const isCustNameValid = cust?.name && !cust.name.startsWith('IG-') && !cust.name.startsWith('WA-') && !cust.name.startsWith('WhatsApp ');
  
  const displayName = isCustNameValid 
    ? cust!.name 
    : (cust?.username ? `@${cust.username}` : (cust?.phone || deal.title || 'Новый лид'));

  const phone = cust?.phone && !cust.phone.includes('@lid') ? cust.phone : null;
  const username = cust?.username ? `@${cust.username}` : null;
  const isWhatsApp = Boolean(cust?.whatsapp_id || (!cust?.instagram_id && cust?.phone));
  const isInstagram = Boolean(cust?.instagram_id);

  return {
    displayName,
    phone,
    username,
    isWhatsApp,
    isInstagram,
    cust,
  };
}

const SALES_STAGES = [
  { id: 'NEW_LEAD', label: 'Новый лид', color: 'bg-slate-100 text-slate-700' },
  { id: 'AI_QUALIFIED', label: 'ИИ-квалифицирован', color: 'bg-blue-50 text-blue-700' },
  { id: 'CONSULTATION_SCHEDULED', label: 'Записан на консультацию', color: 'bg-indigo-50 text-indigo-700' },
  { id: 'CONSULTATION_COMPLETED', label: 'Консультация проведена', color: 'bg-purple-50 text-purple-700' },
  { id: 'CONTRACT_PENDING', label: 'Договор / Ждем оплату', color: 'bg-amber-50 text-amber-700' },
  { id: 'CLOSED_WON', label: 'Оплачено (Успешно)', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'CLOSED_LOST', label: 'Отказ', color: 'bg-red-50 text-red-700' },
];

const ADMISSION_STAGES = [
  { id: 'DOCS_COLLECTION', label: 'Сбор документов', color: 'bg-blue-50 text-blue-700' },
  { id: 'ESSAY_AND_PORTFOLIO', label: 'Эссе и CV', color: 'bg-indigo-50 text-indigo-700' },
  { id: 'APPLICATIONS_SUBMITTED', label: 'Подано в ВУЗы', color: 'bg-purple-50 text-purple-700' },
  { id: 'OFFER_RECEIVED', label: 'Получен оффер / грант', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'VISA_STAGE', label: 'Студенческая виза', color: 'bg-amber-50 text-amber-700' },
  { id: 'ENROLLED_AND_DEPARTED', label: 'Вылетел / Поступил', color: 'bg-teal-50 text-teal-700' },
];

export default function PipelinePage() {
  const [pipelineType, setPipelineType] = useState<'SALES' | 'ADMISSION'>('SALES');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Form for new deal
  const [newTitle, setNewTitle] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newAmount, setNewAmount] = useState('0');
  const [newCountry, setNewCountry] = useState('Италия');

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const data = await api.getDeals(pipelineType);
      setDeals(data);
    } catch (err) {
      console.error('Failed to load deals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, [pipelineType]);

  const stages = pipelineType === 'SALES' ? SALES_STAGES : ADMISSION_STAGES;

  const handleStageChange = async (dealId: number, newStage: string) => {
    try {
      await api.updateDealStage(dealId, newStage);
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
      );
      if (selectedDeal && selectedDeal.id === dealId) {
        setSelectedDeal((prev: Deal | null) => (prev ? { ...prev, stage: newStage } : null));
      }
    } catch (err) {
      console.error('Stage update error:', err);
    }
  };

  const handleChecklistToggle = async (dealId: number, chkId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACCEPTED' ? 'NOT_SUBMITTED' : 'ACCEPTED';
    try {
      await api.updateChecklistStatus(chkId, nextStatus);
      fetchDeals();
    } catch (err) {
      console.error('Checklist error:', err);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newCustomerId) return;
    try {
      await api.createDeal({
        title: newTitle,
        customer_id: Number(newCustomerId),
        pipeline_type: pipelineType,
        stage: stages[0].id,
        amount: Number(newAmount),
        target_country: newCountry,
      });
      setShowCreateModal(false);
      setNewTitle('');
      fetchDeals();
    } catch (err) {
      console.error('Create deal error:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* Header & Pipeline Switcher */}
      <div className="p-5 md:p-6 bg-white border-b border-slate-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Воронки поступления Consulteam
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Двойная воронка сопровождения студентов: от первого лида до зачисления в университет.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Pipeline Tabs */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center text-xs font-semibold shadow-inner">
              <button
                onClick={() => setPipelineType('SALES')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  pipelineType === 'SALES'
                    ? 'bg-[#283876] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>1. Воронка продаж</span>
              </button>

              <button
                onClick={() => setPipelineType('ADMISSION')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  pipelineType === 'ADMISSION'
                    ? 'bg-[#283876] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>2. Академическое сопровождение</span>
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#283876] hover:bg-[#1E2C60] text-white rounded-2xl text-xs font-semibold shadow-sm transition-all cursor-pointer hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Создать сделку</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board Horizontal Scroll */}
      <div className="flex-1 overflow-x-auto p-5 md:p-6 flex gap-4 items-start select-none">
        {stages.map((stg) => {
          const stageDeals = deals.filter((d) => d.stage === stg.id);
          return (
            <div
              key={stg.id}
              className="w-72 shrink-0 bg-slate-100/80 border border-slate-200/90 rounded-3xl flex flex-col max-h-full overflow-hidden shadow-xs"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between bg-white/80 backdrop-blur-xs rounded-t-3xl">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-800">{stg.label}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">
                    {stageDeals.length}
                  </span>
                </div>
              </div>

              {/* Deals Cards in Column */}
              <div className="p-3 overflow-y-auto space-y-3 flex-1">
                {stageDeals.map((deal) => {
                  const { displayName, phone, username, isWhatsApp, isInstagram, cust } = getCustomerDisplay(deal);
                  return (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedDeal(deal)}
                      className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:shadow-md hover:border-[#283876]/40 transition-all cursor-pointer text-xs group"
                    >
                      {/* Top Badges: Channel & Target Country */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <ChannelBadge
                          channel={deal.pipeline_type}
                          instagramId={cust?.instagram_id}
                          whatsappId={cust?.whatsapp_id}
                          phone={cust?.phone}
                          size="sm"
                        />
                        {deal.target_country && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#283876] font-semibold text-[10px] shrink-0 border border-blue-100">
                            {deal.target_country}
                          </span>
                        )}
                      </div>

                      {/* Client Name & Deal Title */}
                      <div className="mb-2.5">
                        <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#283876] transition-colors line-clamp-1">
                          {displayName}
                        </h4>
                        {deal.title && deal.title !== displayName && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {deal.title}
                          </p>
                        )}
                      </div>

                      {/* Contact Badges (Phone & Instagram handle) */}
                      <div className="space-y-1 mb-2.5">
                        {phone && (
                          <div className="flex items-center gap-1.5 text-slate-700 text-[11px] font-mono bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{phone}</span>
                          </div>
                        )}
                        {username && (
                          <div className="flex items-center gap-1.5 text-slate-700 text-[11px] bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <InstagramIcon className="w-3 h-3 text-pink-500 shrink-0" />
                            <span className="truncate">{username}</span>
                          </div>
                        )}
                      </div>

                      {/* Document Checklists count if any */}
                      {deal.checklists && deal.checklists.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                            <span>
                              {deal.checklists.filter((c: any) => c.status === 'ACCEPTED').length}/{deal.checklists.length} док.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Quick Move Select */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                        <span className="text-slate-400 font-medium">Стадия:</span>
                        <select
                          value={deal.stage}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStageChange(deal.id, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-slate-700 font-medium text-[11px] focus:outline-none focus:ring-1 focus:ring-[#283876] cursor-pointer"
                        >
                          {stages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {stageDeals.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-[11px]">
                    Пусто
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Details Modal / Inspector */}
      {selectedDeal && (() => {
        const { displayName, phone, username, isWhatsApp, isInstagram, cust } = getCustomerDisplay(selectedDeal);
        const cleanWaNumber = phone ? phone.replace(/[^\d]/g, '') : null;
        const cleanIgUsername = cust?.username ? cust.username.replace('@', '') : null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden p-6 text-xs md:text-sm animate-in fade-in zoom-in duration-150">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ChannelBadge
                      channel={selectedDeal.pipeline_type}
                      instagramId={cust?.instagram_id}
                      whatsappId={cust?.whatsapp_id}
                      phone={cust?.phone}
                      size="sm"
                    />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Сделка #{selectedDeal.id} • {selectedDeal.pipeline_type === 'SALES' ? 'Воронка продаж' : 'Поступление'}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">{displayName}</h2>
                  {selectedDeal.title && selectedDeal.title !== displayName && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedDeal.title}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedDeal(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* Contact Information Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Данные клиента для связи
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {phone ? (
                      <a
                        href={cleanWaNumber ? `https://wa.me/${cleanWaNumber}` : `tel:${phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:shadow-xs transition-all text-xs font-semibold text-slate-800 group"
                      >
                        <div className="flex items-center gap-2">
                          <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
                          <span className="font-mono">{phone}</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                      </a>
                    ) : (
                      <div className="p-2.5 bg-white/60 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                        Телефон: не указан
                      </div>
                    )}

                    {cleanIgUsername ? (
                      <a
                        href={`https://instagram.com/${cleanIgUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-pink-500 hover:shadow-xs transition-all text-xs font-semibold text-slate-800 group"
                      >
                        <div className="flex items-center gap-2">
                          <InstagramIcon className="w-4 h-4 text-pink-600" />
                          <span>@{cleanIgUsername}</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-pink-600" />
                      </a>
                    ) : (
                      <div className="p-2.5 bg-white/60 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                        Instagram: {cust?.instagram_id || 'не привязан'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Target & Pipeline Details */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Целевая страна</span>
                    <span className="text-xs font-bold text-[#283876] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 inline-block">
                      {selectedDeal.target_country || 'Не указана'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Бюджет / Сумма</span>
                    <span className="text-xs font-bold text-slate-800">
                      {selectedDeal.amount > 0 ? `${selectedDeal.amount} ${selectedDeal.currency}` : 'Бесплатная консультация'}
                    </span>
                  </div>
                </div>

                {/* Stage selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Текущая стадия воронки:</label>
                  <select
                    value={selectedDeal.stage}
                    onChange={(e) => handleStageChange(selectedDeal.id, e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#283876]/20 cursor-pointer"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Document Checklist if ADMISSION */}
                {selectedDeal.checklists && selectedDeal.checklists.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Чек-лист документов абитуриента:
                    </h4>
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      {selectedDeal.checklists.map((chk: any) => (
                        <div
                          key={chk.id}
                          className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs"
                        >
                          <span className="font-medium text-slate-800">{chk.document_name}</span>
                          <button
                            onClick={() => handleChecklistToggle(selectedDeal.id, chk.id, chk.status)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold cursor-pointer transition-all ${
                              chk.status === 'ACCEPTED'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {chk.status === 'ACCEPTED' ? 'Принят ✓' : 'Не сдан'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedDeal(null)}
                  className="px-5 py-2.5 bg-[#283876] hover:bg-[#1E2C60] text-white rounded-2xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Deal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl p-6 text-xs md:text-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4">Создать новую сделку</h2>
            <form onSubmit={handleCreateDeal} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Название сделки</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Абитуриент Азамат — Италия Бакалавриат"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ID Клиента в CRM</label>
                <input
                  type="number"
                  required
                  placeholder="ID (например: 43)"
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Целевая страна</label>
                <select
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="Италия">Италия 🇮🇹</option>
                  <option value="США">США 🇺🇸</option>
                  <option value="Корея">Корея 🇰🇷</option>
                  <option value="Германия">Германия 🇩🇪</option>
                  <option value="Турция">Турция 🇹🇷</option>
                  <option value="Китай">Китай 🇨🇳</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#283876] text-white rounded-xl font-semibold"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
