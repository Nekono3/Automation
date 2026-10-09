'use client';

import { useState } from 'react';
import { Customer, Booking } from '@/lib/types';
import { 
  User, 
  Calendar, 
  Tag, 
  Check, 
  X, 
  ExternalLink, 
  PanelRightClose,
  ChevronDown,
  Plus,
  Bot,
  Sparkles,
  Copy
} from 'lucide-react';

interface Props {
  customer: Customer;
  bookings: Booking[];
  onConfirmBooking: (id: string) => void;
  onCancelBooking: (id: string) => void;
  onInsertReplyDraft?: (text: string) => void;
  onClose?: () => void;
}

export function CustomerInspector({
  customer,
  bookings,
  onConfirmBooking,
  onCancelBooking,
  onInsertReplyDraft,
  onClose
}: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'copilot'>('details');
  const [linksExpanded, setLinksExpanded] = useState(true);
  const [attributesExpanded, setAttributesExpanded] = useState(true);
  const [actionSuccessId, setActionSuccessId] = useState<string | null>(null);

  const handleConfirm = async (id: string) => {
    setActionSuccessId(id);
    await onConfirmBooking(id);
    setTimeout(() => setActionSuccessId(null), 2500);
  };

  const handleCancel = async (id: string) => {
    setActionSuccessId(id);
    await onCancelBooking(id);
    setTimeout(() => setActionSuccessId(null), 2500);
  };

  return (
    <div className="w-[310px] shrink-0 bg-white border border-slate-200/90 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm select-none text-xs">
      {/* Top Header */}
      <div className="h-14 px-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        {/* Tabs: Details & Copilot */}
        <div className="flex items-center gap-4 h-full">
          <button
            onClick={() => setActiveTab('details')}
            className={`h-full flex items-center font-bold text-xs border-b-2 transition-colors cursor-pointer ${
              activeTab === 'details'
                ? 'border-[#283876] text-[#283876]'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Детали
          </button>

          <button
            onClick={() => setActiveTab('copilot')}
            className={`h-full flex items-center gap-1.5 font-bold text-xs border-b-2 transition-colors cursor-pointer ${
              activeTab === 'copilot'
                ? 'border-[#283876] text-[#283876]'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-[#283876]" />
            <span>AI-ассистент</span>
          </button>
        </div>

        {/* Right Utility Buttons */}
        <div className="flex items-center gap-1 text-slate-400">
          <button className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" title="Открыть профиль">
            <ExternalLink className="w-4 h-4" />
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" 
              title="Свернуть панель"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'details' ? (
          <>
            {/* Metadata Rows: Assignee & Team Inbox */}
            <div className="space-y-2.5 pb-3.5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Ответственный</span>
                <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                  <div className="w-5 h-5 rounded-full bg-[#283876] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                    OP
                  </div>
                  <span>Оператор CRM</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Канал связи</span>
                <div className="flex items-center gap-1.5 text-[#283876] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#283876]" />
                  <span>Instagram Direct</span>
                </div>
              </div>
            </div>

            {/* LINKS / BOOKINGS SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <button
                  onClick={() => setLinksExpanded(!linksExpanded)}
                  className="flex items-center gap-1 font-bold text-xs tracking-wider uppercase text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${linksExpanded ? '' : '-rotate-90'}`} />
                  <span>ЗАПИСИ НА КОНСУЛЬТАЦИЮ ({bookings.length})</span>
                </button>
                <button 
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Добавить запись"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {linksExpanded && (
                <div className="space-y-2 pl-1">
                  {bookings.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-center text-slate-400 text-xs">
                      Нет активных записей
                    </div>
                  ) : (
                    bookings.map((booking) => {
                      const date = booking.scheduled_at ? new Date(booking.scheduled_at) : new Date(booking.created_at);
                      const isActionable = booking.status === 'awaiting_confirmation' || booking.status === 'draft';

                      return (
                        <div key={booking.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2 shadow-sm">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-900 truncate">
                              {booking.service?.name || booking.service_name_snapshot}
                            </span>
                            <span className="text-[#283876] font-mono font-bold shrink-0">
                              {booking.price_snapshot} {booking.currency}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 flex items-center gap-1.5 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {date.toLocaleDateString('ru-RU')} в {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Status and Action Buttons */}
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80">
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              booking.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              booking.status === 'awaiting_confirmation' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              booking.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-slate-200 text-slate-700'
                            }`}>
                              {booking.status === 'confirmed' ? 'Подтверждена' :
                               booking.status === 'awaiting_confirmation' ? 'Ожидает' :
                               booking.status === 'cancelled' ? 'Отменена' : booking.status}
                            </span>

                            {isActionable && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleConfirm(booking.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold flex items-center gap-1 cursor-pointer shadow-sm"
                                  title="Подтвердить бронь и отправить уведомление клиенту в Instagram Direct"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Да</span>
                                </button>
                                <button
                                  onClick={() => handleCancel(booking.id)}
                                  className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg transition-colors font-semibold flex items-center gap-1 cursor-pointer"
                                  title="Отклонить/перенести запись"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Нет</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* CONVERSATION ATTRIBUTES SECTION */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-slate-600">
                <button
                  onClick={() => setAttributesExpanded(!attributesExpanded)}
                  className="flex items-center gap-1 font-bold text-xs tracking-wider uppercase text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${attributesExpanded ? '' : '-rotate-90'}`} />
                  <span>ДАННЫЕ КЛИЕНТА</span>
                </button>
              </div>

              {attributesExpanded && (
                <div className="space-y-2.5 pl-1 text-xs">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500">ID клиента</span>
                    <span className="text-slate-900 font-mono font-semibold">{customer.id}</span>
                  </div>

                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500">Instagram Handle</span>
                    <span className="text-[#283876] font-mono font-semibold truncate max-w-[150px]">
                      {customer.username ? `@${customer.username}` : customer.instagram_id || 'Не указан'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500">Телефон</span>
                    <span className="text-slate-900 font-mono font-medium">
                      {customer.phone || '+996...'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500">Язык</span>
                    <span className="text-slate-900 font-medium">Русский</span>
                  </div>

                  {/* Tags */}
                  <div className="pt-1.5">
                    <div className="text-xs text-slate-500 mb-1 font-medium flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      <span>Теги обращения:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(customer.tags && customer.tags.length > 0 ? customer.tags : ['Гранты', 'Консультация']).map((tag) => (
                        <span key={tag} className="px-2.5 py-0.5 bg-blue-50 border border-blue-100 text-[#283876] font-semibold rounded-md text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="pt-2">
                    <div className="text-xs text-slate-500 mb-1 font-medium">Заметки по клиенту:</div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-700 text-xs leading-relaxed">
                      {customer.notes || 'Клиент обратился через Direct. Интересуется поступлением и грантовыми программами.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* TAB 2: COPILOT AI DOSSIER */
          <div className="space-y-3.5">
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-2 text-[#283876] font-bold text-xs">
                <Sparkles className="w-4 h-4 text-[#283876]" />
                <span>AI-резюме обращения</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-normal">
                Клиент проявил интерес к зарубежным грантам. Высокая готовность к первичной консультации в Zoom.
              </p>
            </div>

            {/* AI Suggested Replies */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Рекомендованные ответы:
              </span>

              <div 
                onClick={() => onInsertReplyDraft?.('Здравствуйте! Мы забронировали для вас время консультации. Встреча пройдет онлайн в Zoom. Отправляю ссылку: https://zoom.us/j/consilium')}
                className="bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl p-3 cursor-pointer transition-colors text-xs space-y-1 group"
              >
                <div className="text-xs text-[#283876] font-bold flex items-center justify-between">
                  <span>Отправить ссылку на Zoom</span>
                  <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  «Здравствуйте! Мы забронировали для вас время...»
                </p>
              </div>

              <div 
                onClick={() => onInsertReplyDraft?.('Подскажите, пожалуйста, по какому направлению вы планируете обучение (бакалавриат / магистратура) и какой средний балл GPA?')}
                className="bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl p-3 cursor-pointer transition-colors text-xs space-y-1 group"
              >
                <div className="text-xs text-[#283876] font-bold flex items-center justify-between">
                  <span>Уточнить уровень образования</span>
                  <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  «Подскажите, по какому направлению планируете обучение...»
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
