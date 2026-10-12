'use client';

import { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Search, 
  FileText, 
  MessageSquare, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  Layers,
  ArrowRight,
  Upload,
  Link
} from 'lucide-react';
import { api } from '@/lib/api';
import { AutomationTrigger } from '@/lib/types';

export default function AutomationsPage() {
  const [triggers, setTriggers] = useState<AutomationTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    keyword: '',
    match_type: 'CONTAINS',
    channel: 'ALL',
    comment_reply_text: '',
    dm_reply_text: '',
    attachment_url: '',
    attachment_name: '',
    followup_text: '',
    target_pipeline_stage: 'NEW_LEAD',
    is_active: true,
  });

  const fetchTriggers = async () => {
    try {
      setLoading(true);
      const data = await api.getAutomations();
      setTriggers(data);
    } catch (err) {
      console.error('Failed to load triggers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTriggers();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      keyword: '',
      match_type: 'CONTAINS',
      channel: 'ALL',
      comment_reply_text: 'Отправили вам подробности в Direct! Проверьте сообщения ✈️',
      dm_reply_text: 'Салам! Отправляем обещанный материал от образовательного агентства Consulteam 👇',
      attachment_url: '',
      attachment_name: '',
      followup_text: 'Подскажите, в какую страну вы планируете поступать и в каком классе сейчас учитесь?',
      target_pipeline_stage: 'NEW_LEAD',
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (t: AutomationTrigger) => {
    setEditingId(t.id);
    setFormData({
      name: t.name,
      keyword: t.keyword,
      match_type: t.match_type,
      channel: t.channel,
      comment_reply_text: t.comment_reply_text || '',
      dm_reply_text: t.dm_reply_text,
      attachment_url: t.attachment_url || '',
      attachment_name: t.attachment_name || '',
      followup_text: t.followup_text || '',
      target_pipeline_stage: t.target_pipeline_stage,
      is_active: t.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.keyword || !formData.dm_reply_text) return;

    try {
      if (editingId) {
        await api.updateAutomation(editingId, formData);
      } else {
        await api.createAutomation(formData);
      }
      setShowModal(false);
      fetchTriggers();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadAutomationAttachment(file);
      setFormData((prev) => ({
        ...prev,
        attachment_url: res.url,
        attachment_name: res.filename,
      }));
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Ошибка при загрузке файла. Попробуйте еще раз.');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (t: AutomationTrigger) => {
    try {
      await api.updateAutomation(t.id, { is_active: !t.is_active });
      setTriggers((prev) =>
        prev.map((item) => (item.id === t.id ? { ...item, is_active: !item.is_active } : item))
      );
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту авто-воронку?')) return;
    try {
      await api.deleteAutomation(id);
      setTriggers((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filtered = triggers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.keyword.toLowerCase().includes(search.toLowerCase())
  );

  const totalRuns = triggers.reduce((acc, curr) => acc + (curr.trigger_count || 0), 0);
  const activeCount = triggers.filter((t) => t.is_active).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* Top Banner */}
      <div className="p-6 md:p-8 bg-white border-b border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#EEF2FF] text-[#283876]">
                <Zap className="w-5 h-5 text-[#283876]" />
              </span>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                Автоматизации & Comment-to-DM
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Настройка авто-воронок по ключевым словам для Reels, Stories и Direct в Instagram и WhatsApp. Бот мгновенно выдает гайды и начинает квалификацию студента.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#283876] hover:bg-[#1E2C60] text-white rounded-xl text-xs md:text-sm font-semibold shadow-sm transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить триггер</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-7xl mx-auto mt-6">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500">Всего сценариев</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{triggers.length}</div>
            </div>
            <Layers className="w-8 h-8 text-slate-300" />
          </div>

          <div className="p-4 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-emerald-800">Активные триггеры</span>
              <div className="text-xl font-bold text-emerald-900 mt-0.5">{activeCount}</div>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-200/70 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-blue-800">Всего выдано материалов</span>
              <div className="text-xl font-bold text-[#283876] mt-0.5">{totalRuns}</div>
            </div>
            <Sparkles className="w-8 h-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full flex-1">
        {/* Search & Filter Bar */}
        <div className="flex items-center justify-between mb-5 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по названию или слову (например: ГРАНТ)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#283876]/20 focus:border-[#283876] transition-all"
            />
          </div>
        </div>

        {/* Triggers Cards List */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs font-medium">
            Загрузка автоматизаций...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base">Нет активных триггеров</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Создайте кодовое слово (например «ИТАЛИЯ» или «ГРАНТ»), чтобы бот автоматически отправлял гайды при комментариях к Reels.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-[#283876] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать первый триггер</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-lg bg-[#283876] text-white font-mono font-bold text-xs tracking-wider">
                        #{t.keyword}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        {t.match_type === 'EXACT' ? 'Точное совпадение' : 'Содержит слово'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#283876] text-[11px] font-semibold">
                        {t.channel === 'ALL' ? 'Instagram + WhatsApp' : t.channel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(t)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                          t.is_active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {t.is_active ? 'Включен' : 'Отключен'}
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 mt-3">{t.name}</h3>

                  {/* Comment Reply Section */}
                  {t.comment_reply_text && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                      <span className="font-semibold text-slate-500 text-[10px] uppercase block mb-1">
                        Ответ в комментариях Reels / Post:
                      </span>
                      <p className="line-clamp-2">{t.comment_reply_text}</p>
                    </div>
                  )}

                  {/* Direct Reply Section */}
                  <div className="mt-2.5 p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-slate-800">
                    <span className="font-semibold text-blue-900 text-[10px] uppercase block mb-1">
                      Сообщение в Direct / WhatsApp:
                    </span>
                    <p className="line-clamp-3 whitespace-pre-line">{t.dm_reply_text}</p>
                  </div>

                  {/* Attachment Box */}
                  {t.attachment_url && (
                    <div className="mt-2.5 flex items-center justify-between p-2 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate font-medium">{t.attachment_name || 'Прикрепленный файл / гайд'}</span>
                      </div>
                      <a
                        href={t.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 hover:text-emerald-900 p-1 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Bottom Footer Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Сработало: <b>{t.trigger_count}</b> раз</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(t)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                      title="Редактировать"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Dialog for Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-base text-slate-900">
                {editingId ? 'Редактировать авто-воронку' : 'Новое правило по ключевому слову'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs md:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Название правила
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Гайд по стипендиям Италии (Reels)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#283876]/20 focus:border-[#283876]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ключевое слово (Триггер)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ГРАНТ, ИТАЛИЯ, ГАЙД"
                    value={formData.keyword}
                    onChange={(e) => setFormData({ ...formData, keyword: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#283876]/20 focus:border-[#283876]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Тип соответствия
                  </label>
                  <select
                    value={formData.match_type}
                    onChange={(e) => setFormData({ ...formData, match_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#283876]/20 focus:border-[#283876]"
                  >
                    <option value="CONTAINS">Содержит слово (рекомендуется)</option>
                    <option value="EXACT">Только точное совпадение</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ответ в комментариях Instagram (публичный)
                </label>
                <input
                  type="text"
                  placeholder="Отправили вам детали в Direct! Проверьте сообщения ✈️"
                  value={formData.comment_reply_text}
                  onChange={(e) => setFormData({ ...formData, comment_reply_text: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#283876]/20 focus:border-[#283876]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Личное сообщение в Direct / WhatsApp (обязательно)
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Привет! Держи обещанный гайд по университетам и стипендиям..."
                  value={formData.dm_reply_text}
                  onChange={(e) => setFormData({ ...formData, dm_reply_text: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#283876]/20 focus:border-[#283876]"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#283876]" />
                    Вложение / PDF Гайд
                  </label>
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#283876] bg-white border border-[#283876]/20 rounded-lg hover:bg-slate-100 transition shadow-sm">
                    <Upload className="w-3 h-3" />
                    <span>{uploading ? 'Загрузка...' : 'Загрузить PDF с диска'}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                      Прямая ссылка на файл (URL)
                    </label>
                    <input
                      type="url"
                      placeholder="https://2-26-50-235.sslip.io/guides/guide.pdf"
                      value={formData.attachment_url}
                      onChange={(e) => setFormData({ ...formData, attachment_url: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#283876]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                      Название файла (для отображения)
                    </label>
                    <input
                      type="text"
                      placeholder="Consulteam_USA_Guide.pdf"
                      value={formData.attachment_name}
                      onChange={(e) => setFormData({ ...formData, attachment_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#283876]"
                    />
                  </div>
                </div>

                {formData.attachment_url && (
                  <div className="mt-2 flex items-center justify-between px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                    <div className="flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate font-medium">{formData.attachment_name || 'Файл прикреплен'}</span>
                    </div>
                    <a
                      href={formData.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 font-semibold underline flex items-center gap-1 shrink-0 ml-2"
                    >
                      <span>Открыть</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Вовлекающий вопрос от ИИ (через 1 мин)
                </label>
                <input
                  type="text"
                  placeholder="Удалось открыть файл? Вы для себя планируете бакалавриат или магистратуру?"
                  value={formData.followup_text}
                  onChange={(e) => setFormData({ ...formData, followup_text: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#283876]/20 focus:border-[#283876]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#283876] rounded border-slate-300 focus:ring-[#283876]"
                />
                <label htmlFor="is_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Активировать триггер сразу после сохранения
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#283876] hover:bg-[#1E2C60] text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {editingId ? 'Сохранить изменения' : 'Создать триггер'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
