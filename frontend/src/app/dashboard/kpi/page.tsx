"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Seller, SellerKPIRecord, KPIScoreInput } from "@/lib/types";
import {
  TrendingUp,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Users,
  Award,
  Calendar,
  X,
  Check,
  Target,
  Sparkles,
  Phone,
  Clock,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { PageHeader, EmptyState, DataError } from "@/components/WorkspaceUI";
import { useAuth } from "@/contexts/AuthContext";

export const dynamic = "force-dynamic";

const KPI_CATEGORIES = [
  { key: "punctuality", label: "Кечигүү, Лид база убагында толтуруу", max: 10, group: "РОП (Аяна эже)" },
  { key: "calls_meetings", label: "2 Созвон, 3 Офиске чакыруу", max: 40, group: "РОП (Аяна эже)" },
  { key: "sales", label: "Сатуу (жумасына 2)", max: 50, group: "РОП (Аяна эже)" },
  { key: "team_meetings", label: "Командалык чогулуштар", max: 10, group: "РОП (Аяна эже)" },
  { key: "innovation", label: "Компанияга 1 жаңылык", max: 50, group: "Арзы агай" },
];

export default function KPISellersPage() {
  const { user } = useAuth();
  const canManageKPI = user?.role === "admin" || user?.role === "lead_manager" || Boolean(user?.is_superuser);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Add / Edit Score Modal
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [scoreForm, setScoreForm] = useState<KPIScoreInput>({
    seller_id: 0,
    period: "01.06-06.06",
    category: "punctuality",
    score: 10,
    evaluator: "РОП (Аяна эже)",
    notes: "",
  });
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  const [customPeriodText, setCustomPeriodText] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  // Add Seller Modal
  const [isAddSellerModalOpen, setIsAddSellerModalOpen] = useState(false);
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerRole, setNewSellerRole] = useState("Сатуучу (Менеджер по продажам)");
  const [newSellerPhone, setNewSellerPhone] = useState("");
  const [savingSeller, setSavingSeller] = useState(false);

  // Delete Seller Confirmation
  const [deletingSeller, setDeletingSeller] = useState<Seller | null>(null);
  const [isDeletingSeller, setIsDeletingSeller] = useState(false);

  // Syncing with Spreadsheet
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.getSellers();
      setSellers(data);
      if (data.length > 0 && (selectedSellerId === null || !data.some((s) => s.id === selectedSellerId))) {
        setSelectedSellerId(data[0].id);
      }
    } catch {
      setLoadError("Не удалось загрузить данные KPI. Проверьте соединение с сервером.");
    } finally {
      setLoading(false);
    }
  }, [selectedSellerId]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const activeSeller = sellers.find((s) => s.id === selectedSellerId) || sellers[0] || null;

  // Periods list for selected seller
  const existingPeriods = activeSeller ? activeSeller.records.map((r) => r.period) : [];

  // Open Score Modal
  const handleOpenScoreModal = (period?: string, categoryKey?: string, currentScore?: number) => {
    if (!activeSeller || !canManageKPI) return;
    setIsCustomPeriod(false);
    setCustomPeriodText("");
    setScoreForm({
      seller_id: activeSeller.id,
      period: period || existingPeriods[0] || "01.06-06.06",
      category: categoryKey || "punctuality",
      score: currentScore !== undefined ? currentScore : 10,
      evaluator: categoryKey === "innovation" ? "Арзы агай" : "РОП (Аяна эже)",
      notes: "",
    });
    setIsScoreModalOpen(true);
  };

  // Submit Score
  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPeriod = isCustomPeriod ? customPeriodText.trim() : scoreForm.period;
    if (!finalPeriod) {
      alert("Укажите период (например, 01.06-06.06)");
      return;
    }
    setSavingScore(true);
    try {
      await api.addKPIScore({
        ...scoreForm,
        period: finalPeriod,
      });
      setIsScoreModalOpen(false);
      setStatusMessage("Балл успешно записан и итоговый счет пересчитан!");
      setTimeout(() => setStatusMessage(""), 3500);
      fetchSellers();
    } catch {
      alert("Ошибка при сохранении балла");
    } finally {
      setSavingScore(false);
    }
  };

  // Submit Add Seller
  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSellerName.trim()) {
      alert("Введите имя продавца");
      return;
    }
    setSavingSeller(true);
    try {
      const created = await api.createSeller({
        name: newSellerName.trim(),
        role: newSellerRole.trim(),
        phone: newSellerPhone.trim() || undefined,
      });
      setIsAddSellerModalOpen(false);
      setNewSellerName("");
      setNewSellerPhone("");
      setSelectedSellerId(created.id);
      setStatusMessage(`Продавец ${created.name} успешно добавлен в систему!`);
      setTimeout(() => setStatusMessage(""), 3500);
      fetchSellers();
    } catch {
      alert("Ошибка при добавлении продавца");
    } finally {
      setSavingSeller(false);
    }
  };

  // Submit Delete Seller
  const handleDeleteSeller = async () => {
    if (!deletingSeller) return;
    setIsDeletingSeller(true);
    try {
      await api.deleteSeller(deletingSeller.id);
      setDeletingSeller(null);
      setStatusMessage("Продавец удален из системы.");
      setTimeout(() => setStatusMessage(""), 3500);
      fetchSellers();
    } catch {
      alert("Ошибка при удалении продавца");
    } finally {
      setIsDeletingSeller(false);
    }
  };

  // Sync from Google Spreadsheet
  const handleSyncSpreadsheet = async () => {
    if (!confirm("Синхронизировать KPI продавцов из Google Таблицы? Данные баллов будут обновлены.")) return;
    setSyncing(true);
    try {
      const res = await api.syncKPI(true);
      setStatusMessage(`KPI успешно синхронизирован! Обновлено записей: ${res.seeded_records}`);
      setTimeout(() => setStatusMessage(""), 4000);
      fetchSellers();
    } catch {
      alert("Ошибка при синхронизации с таблицей");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="ОТДЕЛ ПРОДАЖ"
        title="KPI система сатуучулар (Продавцы)"
        description="Еженедельный учет баллов по категориям, контроль дисциплины, созвонов, продаж и командных задач."
      >
        {canManageKPI ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSyncSpreadsheet}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
              title="Загрузить свежие данные из Google Таблицы KPI"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#283876] ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Синхронизация..." : "Синхронизировать с таблицей"}</span>
            </button>

            <button
              onClick={() => setIsAddSellerModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>+ Добавить продавца</span>
            </button>

            <button
              onClick={() => handleOpenScoreModal()}
              disabled={!activeSeller}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#283876] hover:bg-[#1E2C60] text-white transition-colors shadow-md shadow-[#283876]/20 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Выставить / изменить балл</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-600 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Режим просмотра KPI (редактирование доступно только РОП и Админу)</span>
          </div>
        )}
      </PageHeader>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {loadError && <DataError message={loadError} onRetry={fetchSellers} />}

      {/* Sellers Tab Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-thin">
          {sellers.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSellerId(s.id)}
              className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                activeSeller?.id === s.id
                  ? "bg-[#283876] text-white shadow-md shadow-[#283876]/20"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{s.name}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${activeSeller?.id === s.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                {s.total_earned_score} б.
              </span>
            </button>
          ))}
        </div>

        {canManageKPI && activeSeller && (
          <button
            onClick={() => setDeletingSeller(activeSeller)}
            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
            title={`Удалить продавца ${activeSeller.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active Seller Summary Cards */}
      {activeSeller && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Общий заработанный балл</span>
              <strong className="text-xl font-bold text-slate-900 font-mono">{activeSeller.total_earned_score} б.</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#283876] shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Средний балл за неделю</span>
              <strong className="text-xl font-bold text-slate-900 font-mono">{activeSeller.average_score} б.</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Учтено недель</span>
              <strong className="text-xl font-bold text-slate-900">{activeSeller.records.length}</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Лучший результат недели</span>
              <strong className="text-xl font-bold text-slate-900 font-mono">
                {activeSeller.records.length > 0 ? Math.max(...activeSeller.records.map((r) => r.total_score)) : 0} б.
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Main KPI Matrix Table (Like in Google Sheets) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead>
              {/* Category Group Header */}
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                <th className="px-5 py-3">Апта (Период)</th>
                <th colSpan={4} className="px-5 py-3 text-center border-l border-r border-slate-200 bg-blue-50/60 text-[#283876]">
                  Баалоо: РОП (Аяна эже)
                </th>
                <th className="px-5 py-3 text-center border-r border-slate-200 bg-purple-50/60 text-purple-800">
                  Баалоо: Арзы агай
                </th>
                <th className="px-5 py-3 text-center bg-amber-50/60 text-amber-900">
                  Жалпы балл
                </th>
                <th className="px-5 py-3 text-right">Действия</th>
              </tr>
              {/* Detailed Columns Header */}
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider text-[11px] font-bold">
                <th className="px-5 py-3">Даталар</th>
                <th className="px-5 py-3 border-l border-slate-200">
                  Кечигүү, Лид база
                  <span className="block text-[10px] text-slate-400 font-normal">макс 10 б.</span>
                </th>
                <th className="px-5 py-3">
                  2 Созвон, 3 Офис
                  <span className="block text-[10px] text-slate-400 font-normal">макс 40 б.</span>
                </th>
                <th className="px-5 py-3">
                  Сатуу (жумасына 2)
                  <span className="block text-[10px] text-slate-400 font-normal">макс 50 б.</span>
                </th>
                <th className="px-5 py-3 border-r border-slate-200">
                  Командалык чогулуш
                  <span className="block text-[10px] text-slate-400 font-normal">макс 10 б.</span>
                </th>
                <th className="px-5 py-3 border-r border-slate-200">
                  Компанияга 1 жаңылык
                  <span className="block text-[10px] text-slate-400 font-normal">макс 50 б.</span>
                </th>
                <th className="px-5 py-3 text-center bg-amber-50/40 font-mono text-xs">
                  Чогултулган балл
                </th>
                <th className="px-5 py-3 text-right">Управление</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#283876] border-t-transparent rounded-full animate-spin" />
                      <span>Загрузка данных KPI...</span>
                    </div>
                  </td>
                </tr>
              ) : !activeSeller || activeSeller.records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                    <EmptyState
                      icon={Award}
                      title="Баллы еще не выставлены"
                      description="Нажмите 'Выставить / изменить балл', чтобы внести оценки за неделю."
                    />
                  </td>
                </tr>
              ) : (
                activeSeller.records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Period */}
                    <td className="px-5 py-3 font-mono font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{rec.period}</span>
                      </div>
                    </td>

                    {/* Punctuality */}
                    <td
                      onClick={() => canManageKPI && handleOpenScoreModal(rec.period, "punctuality", rec.punctuality)}
                      className={`px-5 py-3 font-mono border-l border-slate-100 transition-colors ${
                        canManageKPI ? "cursor-pointer hover:bg-blue-50/60" : ""
                      }`}
                      title={canManageKPI ? "Кликните, чтобы изменить балл" : undefined}
                    >
                      <span className={`font-semibold ${rec.punctuality > 0 ? "text-slate-900" : "text-slate-300"}`}>
                        {rec.punctuality}
                      </span>
                    </td>

                    {/* Calls & Meetings */}
                    <td
                      onClick={() => canManageKPI && handleOpenScoreModal(rec.period, "calls_meetings", rec.calls_meetings)}
                      className={`px-5 py-3 font-mono transition-colors ${
                        canManageKPI ? "cursor-pointer hover:bg-blue-50/60" : ""
                      }`}
                      title={canManageKPI ? "Кликните, чтобы изменить балл" : undefined}
                    >
                      <span className={`font-semibold ${rec.calls_meetings > 0 ? "text-slate-900" : "text-slate-300"}`}>
                        {rec.calls_meetings}
                      </span>
                    </td>

                    {/* Sales */}
                    <td
                      onClick={() => canManageKPI && handleOpenScoreModal(rec.period, "sales", rec.sales)}
                      className={`px-5 py-3 font-mono transition-colors ${
                        canManageKPI ? "cursor-pointer hover:bg-blue-50/60" : ""
                      }`}
                      title={canManageKPI ? "Кликните, чтобы изменить балл" : undefined}
                    >
                      <span className={`font-semibold ${rec.sales > 0 ? "text-emerald-700 font-bold" : "text-slate-300"}`}>
                        {rec.sales}
                      </span>
                    </td>

                    {/* Team meetings */}
                    <td
                      onClick={() => canManageKPI && handleOpenScoreModal(rec.period, "team_meetings", rec.team_meetings)}
                      className={`px-5 py-3 font-mono border-r border-slate-100 transition-colors ${
                        canManageKPI ? "cursor-pointer hover:bg-blue-50/60" : ""
                      }`}
                      title={canManageKPI ? "Кликните, чтобы изменить балл" : undefined}
                    >
                      <span className={`font-semibold ${rec.team_meetings > 0 ? "text-slate-900" : "text-slate-300"}`}>
                        {rec.team_meetings}
                      </span>
                    </td>

                    {/* Innovation */}
                    <td
                      onClick={() => canManageKPI && handleOpenScoreModal(rec.period, "innovation", rec.innovation)}
                      className={`px-5 py-3 font-mono border-r border-slate-100 transition-colors ${
                        canManageKPI ? "cursor-pointer hover:bg-purple-50/60" : ""
                      }`}
                      title={canManageKPI ? "Кликните, чтобы изменить балл" : undefined}
                    >
                      <span className={`font-semibold ${rec.innovation > 0 ? "text-purple-700 font-bold" : "text-slate-300"}`}>
                        {rec.innovation}
                      </span>
                    </td>

                    {/* Total Score */}
                    <td className="px-5 py-3 text-center bg-amber-50/30">
                      <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                        rec.total_score >= 100
                          ? "bg-emerald-100 text-emerald-800"
                          : rec.total_score >= 60
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {rec.total_score} б.
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      {canManageKPI ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenScoreModal(rec.period)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#283876] hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Редактировать неделю"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Удалить запись за неделю ${rec.period}?`)) {
                                await api.deleteKPIRecord(rec.id);
                                fetchSellers();
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Удалить запись недели"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs font-mono">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD / EDIT SCORE */}
      {isScoreModalOpen && activeSeller && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#283876]">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Выставить / изменить балл</h3>
                  <p className="text-xs text-slate-500">Продавец: {activeSeller.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsScoreModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScore} className="space-y-4 pt-4">
              {/* Period selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Период (Апта) *</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomPeriod(!isCustomPeriod)}
                    className="text-xs text-[#283876] hover:underline font-semibold"
                  >
                    {isCustomPeriod ? "Выбрать из существующих" : "+ Новая неделя"}
                  </button>
                </div>
                {isCustomPeriod ? (
                  <input
                    type="text"
                    required
                    placeholder="Например: 13.07-18.07 или 20.07-25.07"
                    value={customPeriodText}
                    onChange={(e) => setCustomPeriodText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                ) : (
                  <select
                    value={scoreForm.period}
                    onChange={(e) => setScoreForm({ ...scoreForm, period: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                  >
                    {existingPeriods.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Category Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Категория оценки *</label>
                <select
                  value={scoreForm.category}
                  onChange={(e) => {
                    const catKey = e.target.value;
                    const catDef = KPI_CATEGORIES.find((c) => c.key === catKey);
                    setScoreForm({
                      ...scoreForm,
                      category: catKey,
                      evaluator: catDef?.group || "РОП",
                      score: catDef ? catDef.max : 10,
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                >
                  {KPI_CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label} (макс. {cat.max} б.) — {cat.group}
                    </option>
                  ))}
                </select>
              </div>

              {/* Score Amount Input */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Количество баллов *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    required
                    value={scoreForm.score}
                    onChange={(e) => setScoreForm({ ...scoreForm, score: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Оценивающий</label>
                  <input
                    type="text"
                    value={scoreForm.evaluator || ""}
                    onChange={(e) => setScoreForm({ ...scoreForm, evaluator: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Комментарий / Причина</label>
                <textarea
                  rows={2}
                  placeholder="Опоздал на 15 мин, закрыл 2 договора..."
                  value={scoreForm.notes || ""}
                  onChange={(e) => setScoreForm({ ...scoreForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsScoreModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingScore}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#283876] hover:bg-[#1E2C60] text-white transition-colors shadow-md shadow-[#283876]/20 cursor-pointer flex items-center gap-2"
                >
                  {savingScore && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{savingScore ? "Сохранение..." : "Сохранить балл"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SELLER */}
      {isAddSellerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Добавить продавца</h3>
                  <p className="text-xs text-slate-500">Включение сотрудника в систему KPI</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddSellerModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSeller} className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ФИО / Имя сотрудника *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Адилет Маматов"
                  value={newSellerName}
                  onChange={(e) => setNewSellerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Должность</label>
                <input
                  type="text"
                  value={newSellerRole}
                  onChange={(e) => setNewSellerRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Телефон / WhatsApp</label>
                <input
                  type="text"
                  placeholder="+996..."
                  value={newSellerPhone}
                  onChange={(e) => setNewSellerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddSellerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingSeller}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#283876] hover:bg-[#1E2C60] text-white transition-colors shadow-md shadow-[#283876]/20 cursor-pointer flex items-center gap-2"
                >
                  {savingSeller && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{savingSeller ? "Добавление..." : "Добавить продавца"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE SELLER CONFIRMATION */}
      {deletingSeller && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">Удалить продавца?</h3>
            <p className="text-xs text-slate-500 text-center mt-1.5 leading-relaxed">
              Вы уверены, что хотите удалить сотрудника <strong className="text-slate-800">{deletingSeller.name}</strong> и все его баллы KPI из системы?
            </p>

            <div className="mt-6 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingSeller(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeletingSeller}
                onClick={handleDeleteSeller}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeletingSeller && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{isDeletingSeller ? "Удаление..." : "Удалить"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
