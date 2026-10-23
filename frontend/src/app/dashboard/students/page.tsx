"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { EnrolledStudent, EnrolledStudentsStats } from "@/lib/types";
import {
  ClipboardCheck,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  MapPin,
  UserCheck,
  DollarSign,
  AlertTriangle,
  Clock,
  X,
  Check,
  CheckCircle2,
  XCircle,
  Globe,
  Briefcase,
  FileText,
  CreditCard,
  Building,
} from "lucide-react";
import { PageHeader, EmptyState, DataError } from "@/components/WorkspaceUI";

export const dynamic = "force-dynamic";

export default function EnrolledStudentsPage() {
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [stats, setStats] = useState<EnrolledStudentsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedManager, setSelectedManager] = useState("all");
  const [selectedStage, setSelectedStage] = useState("all");
  const [selectedRisk, setSelectedRisk] = useState("all");
  const [viewMode, setViewMode] = useState<"process" | "finance" | "all">("process");

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<EnrolledStudent | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    country: "Турция",
    process_stage: "Виза",
    manager: "Аяна",
    next_action: "Виза процесси",
    risk: "Виза",
    comment: "",
    is_completed: false,
    status_raw: "",
    contract_amount: "1300доллар",
    paid_amount: "650",
    remaining_amount: "650",
    seller_commission_paid: false,
    mentor_commission_paid: false,
    next_payment_condition: "Чакыруу чыкканда",
    last_payment_date: "",
    finance_comment: "",
    full_payment_received: false,
  });
  const [saving, setSaving] = useState(false);

  // Delete Modal
  const [deletingStudent, setDeletingStudent] = useState<EnrolledStudent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Syncing
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [stuList, statsData] = await Promise.all([
        api.getEnrolledStudents({
          search,
          country: selectedCountry,
          manager: selectedManager,
          stage: selectedStage,
          risk: selectedRisk,
          limit: 300,
        }),
        api.getEnrolledStudentsStats(),
      ]);
      setStudents(stuList);
      setStats(statsData);
    } catch {
      setLoadError("Не удалось загрузить базу студентов. Проверьте соединение с сервером.");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCountry, selectedManager, selectedStage, selectedRisk]);

  useEffect(() => {
    const timer = setTimeout(() => void fetchData(), 250);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleOpenCreate = () => {
    setEditingStudent(null);
    setForm({
      full_name: "",
      country: selectedCountry !== "all" ? selectedCountry : "Турция",
      process_stage: "чакыруу күтүү",
      manager: selectedManager !== "all" ? selectedManager : "Аяна",
      next_action: "Виза процесси",
      risk: "Универ",
      comment: "",
      is_completed: false,
      status_raw: "",
      contract_amount: "1300доллар",
      paid_amount: "650",
      remaining_amount: "650",
      seller_commission_paid: false,
      mentor_commission_paid: false,
      next_payment_condition: "Чакыруу чыкканда",
      last_payment_date: "",
      finance_comment: "",
      full_payment_received: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (stu: EnrolledStudent) => {
    setEditingStudent(stu);
    setForm({
      full_name: stu.full_name,
      country: stu.country,
      process_stage: stu.process_stage,
      manager: stu.manager,
      next_action: stu.next_action,
      risk: stu.risk,
      comment: stu.comment || "",
      is_completed: stu.is_completed,
      status_raw: stu.status_raw || "",
      contract_amount: stu.contract_amount,
      paid_amount: stu.paid_amount,
      remaining_amount: stu.remaining_amount,
      seller_commission_paid: stu.seller_commission_paid,
      mentor_commission_paid: stu.mentor_commission_paid,
      next_payment_condition: stu.next_payment_condition,
      last_payment_date: stu.last_payment_date,
      finance_comment: stu.finance_comment || "",
      full_payment_received: stu.full_payment_received,
    });
    setIsModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      alert("Введите ФИО студента");
      return;
    }
    setSaving(true);
    try {
      if (editingStudent) {
        await api.updateEnrolledStudent(editingStudent.id, form);
      } else {
        await api.createEnrolledStudent(form);
      }
      setIsModalOpen(false);
      setStatusMessage("Данные студента успешно сохранены!");
      setTimeout(() => setStatusMessage(""), 3500);
      fetchData();
    } catch {
      alert("Ошибка при сохранении студента");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    try {
      await api.deleteEnrolledStudent(deletingStudent.id);
      setDeletingStudent(null);
      setStatusMessage("Студент удален из базы.");
      setTimeout(() => setStatusMessage(""), 3500);
      fetchData();
    } catch {
      alert("Ошибка при удалении студента");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSyncSpreadsheet = async () => {
    if (!confirm("Синхронизировать студентов из Google Таблицы? Данные процесса и финансов будут обновлены.")) return;
    setSyncing(true);
    try {
      const res = await api.syncEnrolledStudents(true);
      setStatusMessage(`База студентов синхронизирована! Всего студентов: ${res.seeded_students}`);
      setTimeout(() => setStatusMessage(""), 4000);
      fetchData();
    } catch {
      alert("Ошибка при синхронизации таблицы студентов");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="КУРАТОРСТВО И ФИНАНСЫ"
        title="Студенты: процесс поступления и оплаты"
        description="Контроль визовых этапов, приглашений, кураторов и взаиморасчетов по договорам поступления."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncSpreadsheet}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            title="Загрузить свежие данные из Google Таблицы"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#283876] ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Синхронизация..." : "Синхронизировать с таблицей"}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#283876] hover:bg-[#1E2C60] text-white transition-colors shadow-md shadow-[#283876]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Добавить студента</span>
          </button>
        </div>
      </PageHeader>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {loadError && <DataError message={loadError} onRetry={fetchData} />}

      {/* KPI Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#283876] shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Всего студентов</span>
              <strong className="text-xl font-bold text-slate-900">{stats.total_students}</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">В процессе поступления</span>
              <strong className="text-xl font-bold text-slate-900">{stats.in_process_count}</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Зачислено / Завершено</span>
              <strong className="text-xl font-bold text-slate-900">{stats.completed_count}</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Стран назначения</span>
              <strong className="text-xl font-bold text-slate-900">{Object.keys(stats.countries_breakdown).length}</strong>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Switcher & Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs: Process vs Finance vs Combined */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold w-fit">
            <button
              onClick={() => setViewMode("process")}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === "process"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#283876]" />
              <span>Процесс поступления (Process)</span>
            </button>

            <button
              onClick={() => setViewMode("finance")}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === "finance"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Финансы и оплата (Finance)</span>
            </button>

            <button
              onClick={() => setViewMode("all")}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Сводная (Все поля)</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Поиск по ФИО, стране, куратору или комментарию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#283876] focus:bg-white transition-colors"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          {/* Country filter */}
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#283876] cursor-pointer"
          >
            <option value="all">Все страны ({stats?.total_students || 0})</option>
            {stats &&
              Object.entries(stats.countries_breakdown).map(([c, count]) => (
                <option key={c} value={c}>
                  {c} ({count})
                </option>
              ))}
          </select>

          {/* Manager filter */}
          <select
            value={selectedManager}
            onChange={(e) => setSelectedManager(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#283876] cursor-pointer"
          >
            <option value="all">Все менеджеры / кураторы</option>
            {stats &&
              Object.entries(stats.managers_breakdown).map(([m, count]) => (
                <option key={m} value={m}>
                  {m} ({count})
                </option>
              ))}
          </select>

          {/* Stage filter */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#283876] cursor-pointer"
          >
            <option value="all">Все этапы процесса</option>
            {stats &&
              Object.entries(stats.stages_breakdown).map(([s, count]) => (
                <option key={s} value={s}>
                  {s} ({count})
                </option>
              ))}
          </select>

          {/* Risk filter */}
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#283876] cursor-pointer"
          >
            <option value="all">Все факторы риска</option>
            {stats &&
              Object.entries(stats.risks_breakdown).map(([r, count]) => (
                <option key={r} value={r}>
                  {r} ({count})
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider sticky top-0 z-10 font-bold">
              <tr>
                <th className="px-5 py-4">ФИО студента</th>
                <th className="px-5 py-4">Өлкө (Страна)</th>

                {(viewMode === "process" || viewMode === "all") && (
                  <>
                    <th className="px-5 py-4">Процесс</th>
                    <th className="px-5 py-4">Менеджер</th>
                    <th className="px-5 py-4">Next action</th>
                    <th className="px-5 py-4">Risk</th>
                    <th className="px-5 py-4">Комментарий ментора</th>
                  </>
                )}

                {(viewMode === "finance" || viewMode === "all") && (
                  <>
                    <th className="px-5 py-4">Договор</th>
                    <th className="px-5 py-4">Берди</th>
                    <th className="px-5 py-4">Таза калганы</th>
                    <th className="px-5 py-4">% Сатуучу</th>
                    <th className="px-5 py-4">% Ментор</th>
                    <th className="px-5 py-4">Кийинки төлөм</th>
                  </>
                )}

                <th className="px-5 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#283876] border-t-transparent rounded-full animate-spin" />
                      <span>Загрузка данных студентов...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-slate-400">
                    <EmptyState
                      icon={ClipboardCheck}
                      title="Студенты не найдены"
                      description="Попробуйте изменить параметры поиска или фильтров."
                    />
                  </td>
                </tr>
              ) : (
                students.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Full Name */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{stu.full_name}</span>
                        {stu.is_completed && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            {stu.status_raw || "Бүттү"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Country */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-[#283876]" />
                        <span>{stu.country || "-"}</span>
                      </div>
                    </td>

                    {/* PROCESS VIEW COLUMNS */}
                    {(viewMode === "process" || viewMode === "all") && (
                      <>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              stu.process_stage.includes("Виза")
                                ? "bg-blue-50 text-[#283876] border border-blue-200"
                                : stu.process_stage.includes("чакыруу") || stu.process_stage.includes("Чакыруу")
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {stu.process_stage}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 font-medium text-slate-800">
                          {stu.manager || "-"}
                        </td>

                        <td className="px-5 py-3.5 text-slate-600">
                          {stu.next_action || "-"}
                        </td>

                        <td className="px-5 py-3.5">
                          {stu.risk ? (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 w-fit ${
                                stu.risk.includes("соонун")
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : stu.risk.includes("Ата-эне") || stu.risk.includes("Виза")
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{stu.risk}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate" title={stu.comment || ""}>
                          {stu.comment || "-"}
                        </td>
                      </>
                    )}

                    {/* FINANCE VIEW COLUMNS */}
                    {(viewMode === "finance" || viewMode === "all") && (
                      <>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                          {stu.contract_amount || "-"}
                        </td>

                        <td className="px-5 py-3.5 font-mono text-emerald-700 font-semibold">
                          {stu.paid_amount || "0"}
                        </td>

                        <td className="px-5 py-3.5 font-mono text-slate-700">
                          {stu.remaining_amount || "0"}
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          {stu.seller_commission_paid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Төлөндү
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          {stu.mentor_commission_paid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Төлөндү
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-slate-700 text-[11px]">
                          {stu.next_payment_condition || "-"}
                        </td>
                      </>
                    )}

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(stu)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#283876] hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Редактировать студента"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingStudent(stu)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Удалить студента"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE & EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#283876]">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingStudent ? "Редактировать студента" : "Добавить студента"}
                  </h3>
                  <p className="text-xs text-slate-500">Управление процессом зачисления и договором</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">ФИО студента *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например: Зарылбеков Эрбол"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Өлкө (Страна) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Турция, Китай, Чехия, Тайвань..."
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Процесс этапы</label>
                  <input
                    type="text"
                    placeholder="Виза, чакыруу күтүү, G201..."
                    value={form.process_stage}
                    onChange={(e) => setForm({ ...form, process_stage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Менеджер / Ментор</label>
                  <input
                    type="text"
                    placeholder="Аяна, Гаухар, Арзы агай..."
                    value={form.manager}
                    onChange={(e) => setForm({ ...form, manager: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Risk factor</label>
                  <input
                    type="text"
                    placeholder="Виза, Ата-эне, Универ..."
                    value={form.risk}
                    onChange={(e) => setForm({ ...form, risk: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Next action (Кийинки кадам)</label>
                <input
                  type="text"
                  placeholder="Визага кайра кирүү, Виза процесси..."
                  value={form.next_action}
                  onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Комментарий ментора</label>
                <textarea
                  rows={2}
                  placeholder="Подробности поступления, контакты родителей..."
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              {/* Finance Section Header */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-2">
                  Финансы и оплата по договору
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Договор (сумма)</label>
                  <input
                    type="text"
                    placeholder="1300доллар / 500евро"
                    value={form.contract_amount}
                    onChange={(e) => setForm({ ...form, contract_amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Берди (Төлөндү)</label>
                  <input
                    type="text"
                    placeholder="650"
                    value={form.paid_amount}
                    onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-700 font-semibold focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Таза калганы</label>
                  <input
                    type="text"
                    placeholder="650"
                    value={form.remaining_amount}
                    onChange={(e) => setForm({ ...form, remaining_amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-700 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Кийинки төлөм шарты</label>
                  <input
                    type="text"
                    placeholder="Чакыруу чыкканда / Виза чыкканда"
                    value={form.next_payment_condition}
                    onChange={(e) => setForm({ ...form, next_payment_condition: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Last payment дата</label>
                  <input
                    type="text"
                    placeholder="2026-04-22"
                    value={form.last_payment_date}
                    onChange={(e) => setForm({ ...form, last_payment_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.seller_commission_paid}
                    onChange={(e) => setForm({ ...form, seller_commission_paid: e.target.checked })}
                    className="w-4 h-4 rounded text-[#283876] border-slate-300 focus:ring-[#283876]"
                  />
                  <span>% Сатуучу төлөндү</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.mentor_commission_paid}
                    onChange={(e) => setForm({ ...form, mentor_commission_paid: e.target.checked })}
                    className="w-4 h-4 rounded text-[#283876] border-slate-300 focus:ring-[#283876]"
                  />
                  <span>% Ментор төлөндү</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_completed}
                    onChange={(e) => setForm({ ...form, is_completed: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <span>Баары бүттү (Завершено)</span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#283876] hover:bg-[#1E2C60] text-white transition-colors shadow-md shadow-[#283876]/20 cursor-pointer flex items-center gap-2"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{saving ? "Сохранение..." : editingStudent ? "Сохранить изменения" : "Добавить студента"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">Удалить студента?</h3>
            <p className="text-xs text-slate-500 text-center mt-1.5 leading-relaxed">
              Вы уверены, что хотите удалить студента <strong className="text-slate-800">{deletingStudent.full_name}</strong> из базы данных?
            </p>

            <div className="mt-6 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{isDeleting ? "Удаление..." : "Удалить"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
