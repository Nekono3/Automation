"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { UniversityProgram, UniversitySummary, ProgramsStats } from "@/lib/types";
import {
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  School,
  Building2,
  MapPin,
  Globe,
  Clock,
  Layers,
  GraduationCap,
  X,
  Check,
  Filter,
  DollarSign,
  ArrowUpDown,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { PageHeader, EmptyState, DataError } from "@/components/WorkspaceUI";

export const dynamic = "force-dynamic";

export default function UniversityProgramsPage() {
  const [programs, setPrograms] = useState<UniversityProgram[]>([]);
  const [universities, setUniversities] = useState<UniversitySummary[]>([]);
  const [stats, setStats] = useState<ProgramsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedUni, setSelectedUni] = useState<string>("all");
  const [selectedDegree, setSelectedDegree] = useState<string>("all");
  const [selectedLang, setSelectedLang] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<UniversityProgram | null>(null);
  const [form, setForm] = useState({
    university: "",
    faculty: "",
    program_name: "",
    program_name_ru: "",
    degree_level: "Бакалавр",
    tuition_fee: "$1,000",
    tuition_fee_usd: 1000,
    currency: "USD",
    duration: "4 года",
    language: "Турецкий",
    city: "Сакарья",
    country: "Турция",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Rename University Modal
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameOldUni, setRenameOldUni] = useState("");
  const [renameNewUni, setRenameNewUni] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Delete Modal
  const [deletingProgram, setDeletingProgram] = useState<UniversityProgram | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Syncing
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [progs, statsData] = await Promise.all([
        api.getPrograms({
          search,
          university: selectedUni,
          degree_level: selectedDegree,
          language: selectedLang,
          sort_by: sortBy,
          limit: 300,
        }),
        api.getProgramsStats(),
      ]);
      setPrograms(progs);
      setStats(statsData);
      setUniversities(statsData.universities || []);
    } catch {
      setLoadError("Не удалось загрузить каталог программ. Проверьте соединение с сервером.");
    } finally {
      setLoading(false);
    }
  }, [search, selectedUni, selectedDegree, selectedLang, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => void fetchData(), 250);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingProgram(null);
    setForm({
      university: selectedUni !== "all" ? selectedUni : universities[0]?.name || "SUBU (Sakarya Uygulamalı Bilimler Üniversitesi)",
      faculty: "",
      program_name: "",
      program_name_ru: "",
      degree_level: "Бакалавр",
      tuition_fee: "$1,000",
      tuition_fee_usd: 1000,
      currency: "USD",
      duration: "4 года",
      language: "Турецкий",
      city: "Сакарья",
      country: "Турция",
      notes: "",
    });
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (prog: UniversityProgram) => {
    setEditingProgram(prog);
    setForm({
      university: prog.university,
      faculty: prog.faculty,
      program_name: prog.program_name,
      program_name_ru: prog.program_name_ru,
      degree_level: prog.degree_level,
      tuition_fee: prog.tuition_fee,
      tuition_fee_usd: prog.tuition_fee_usd || 0,
      currency: prog.currency,
      duration: prog.duration,
      language: prog.language,
      city: prog.city,
      country: prog.country,
      notes: prog.notes || "",
    });
    setIsEditModalOpen(true);
  };

  // Submit Save
  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.university || !form.program_name_ru) {
      alert("Укажите университет и название программы на русском");
      return;
    }
    setSaving(true);
    try {
      if (editingProgram) {
        await api.updateProgram(editingProgram.id, form);
      } else {
        await api.createProgram(form);
      }
      setIsEditModalOpen(false);
      fetchData();
    } catch {
      alert("Ошибка при сохранении программы");
    } finally {
      setSaving(false);
    }
  };

  // Submit Delete
  const handleConfirmDelete = async () => {
    if (!deletingProgram) return;
    setIsDeleting(true);
    try {
      await api.deleteProgram(deletingProgram.id);
      setDeletingProgram(null);
      fetchData();
    } catch {
      alert("Ошибка при удалении программы");
    } finally {
      setIsDeleting(false);
    }
  };

  // Submit Rename University
  const handleRenameUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameOldUni || !renameNewUni.trim()) {
      alert("Выберите университет и введите новое название");
      return;
    }
    setRenaming(true);
    try {
      const res = await api.renameUniversity(renameOldUni, renameNewUni.trim());
      setIsRenameModalOpen(false);
      setSyncSuccessMessage(`Университет переименован! Обновлено программ: ${res.affected_programs}`);
      setTimeout(() => setSyncSuccessMessage(""), 3500);
      if (selectedUni === renameOldUni) {
        setSelectedUni(renameNewUni.trim());
      }
      fetchData();
    } catch {
      alert("Ошибка при переименовании университета");
    } finally {
      setRenaming(false);
    }
  };

  // Sync from Spreadsheet
  const handleSyncSpreadsheet = async () => {
    if (!confirm("Загрузить свежие данные из Google Таблицы? Новые и обновленные записи будут синхронизированы.")) return;
    setSyncing(true);
    try {
      const res = await api.syncPrograms(true);
      setSyncSuccessMessage(`Синхронизация завершена! Всего программ в каталоге: ${res.seeded_programs}`);
      setTimeout(() => setSyncSuccessMessage(""), 4000);
      fetchData();
    } catch {
      alert("Ошибка при синхронизации с таблицей");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="ОБРАЗОВАНИЕ ЗА РУБЕЖОМ"
        title="Государственные университеты и программы"
        description="Каталог направлений, факультетов и стоимости контрактов. Управление, редактирование и синхронизация."
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
            onClick={() => {
              setRenameOldUni(selectedUni !== "all" ? selectedUni : universities[0]?.name || "");
              setRenameNewUni("");
              setIsRenameModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Переименовать ВУЗ</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#283876] hover:bg-[#1E2C60] text-white transition-colors shadow-md shadow-[#283876]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить программу</span>
          </button>
        </div>
      </PageHeader>

      {syncSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncSuccessMessage}</span>
        </div>
      )}

      {loadError && <DataError message={loadError} onRetry={() => void fetchData()} />}

      {/* KPI Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#283876] shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Всего программ</span>
              <strong className="text-xl font-bold text-slate-900">{stats.total_programs}</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <School className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Гос. университетов</span>
              <strong className="text-xl font-bold text-slate-900">{stats.total_universities}</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Факультетов</span>
              <strong className="text-xl font-bold text-slate-900">{stats.total_faculties}</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">Бакалавриат</span>
              <strong className="text-xl font-bold text-slate-900">{stats.degrees_breakdown["Бакалавр"] || 0}</strong>
            </div>
          </div>
        </div>
      )}

      {/* University Horizontal Tabs */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
          <button
            onClick={() => setSelectedUni("all")}
            className={`px-3.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedUni === "all"
                ? "bg-[#283876] text-white shadow-sm"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Все университеты ({stats?.total_programs || 0})
          </button>
          {universities.map((uni) => (
            <button
              key={uni.name}
              onClick={() => setSelectedUni(uni.name)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedUni === uni.name
                  ? "bg-[#283876] text-white shadow-sm font-semibold"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>{uni.name.split("(")[0].trim()}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedUni === uni.name ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                {uni.program_count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls & Search Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Поиск по специальности, факультету, ВУЗу или городу..."
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

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Degree Filter */}
          <div className="relative">
            <select
              value={selectedDegree}
              onChange={(e) => setSelectedDegree(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#283876] cursor-pointer"
            >
              <option value="all">Все ступени</option>
              <option value="Бакалавр">Бакалавриат (4 года)</option>
              <option value="Ön Lisans (Колледж 2 года)">Колледж / Ön Lisans (2 года)</option>
              <option value="Специалитет (5 лет)">Специалитет (5 лет)</option>
              <option value="Специалитет (Медицина 6 лет)">Медицина (6 лет)</option>
              <option value="Специалитет (Стоматология 5 лет)">Стоматология (5 лет)</option>
            </select>
          </div>

          {/* Language Filter */}
          <div className="relative">
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#283876] cursor-pointer"
            >
              <option value="all">Все языки</option>
              <option value="Турецкий">Турецкий</option>
              <option value="Английский">Английский</option>
              <option value="Русский">Русский</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#283876] cursor-pointer"
            >
              <option value="name">По названию (А-Я)</option>
              <option value="university">По университету</option>
              <option value="fee_asc">Контракт: по возрастанию</option>
              <option value="fee_desc">Контракт: по убыванию</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Programs Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider sticky top-0 z-10 font-bold">
              <tr>
                <th className="px-6 py-4">Университет / Город</th>
                <th className="px-6 py-4">Факультет</th>
                <th className="px-6 py-4">Специальность / Программа</th>
                <th className="px-6 py-4">Ступень и срок</th>
                <th className="px-6 py-4">Язык</th>
                <th className="px-6 py-4">Годовой контракт</th>
                <th className="px-6 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#283876] border-t-transparent rounded-full animate-spin" />
                      <span>Загрузка программ...</span>
                    </div>
                  </td>
                </tr>
              ) : programs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <EmptyState
                      icon={School}
                      title="Программы не найдены"
                      description={
                        search || selectedUni !== "all" || selectedDegree !== "all"
                          ? "Попробуйте изменить параметры поиска или фильтров."
                          : "Нажмите 'Синхронизировать с таблицей' или добавьте новую программу."
                      }
                    />
                  </td>
                </tr>
              ) : (
                programs.map((prog) => (
                  <tr key={prog.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                    {/* University & City */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 leading-snug">{prog.university}</div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{prog.city}, {prog.country}</span>
                      </div>
                    </td>

                    {/* Faculty */}
                    <td className="px-6 py-4">
                      <span className="text-slate-700 font-medium block max-w-xs">{prog.faculty}</span>
                    </td>

                    {/* Program Name RU & TR */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-xs">{prog.program_name_ru}</div>
                      {prog.program_name && prog.program_name !== prog.program_name_ru && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{prog.program_name}</div>
                      )}
                    </td>

                    {/* Degree & Duration */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            prog.degree_level.includes("Ön Lisans") || prog.degree_level.includes("Колледж")
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : prog.degree_level.includes("Медицина") || prog.degree_level.includes("Стоматология")
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {prog.degree_level}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{prog.duration}</span>
                        </span>
                      </div>
                    </td>

                    {/* Language */}
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          prog.language === "Английский"
                            ? "bg-blue-50 text-[#283876] border border-blue-200"
                            : prog.language === "Русский"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {prog.language}
                      </span>
                    </td>

                    {/* Tuition Fee */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 font-mono text-xs flex items-center gap-1">
                        <span className="text-[#283876]">{prog.tuition_fee}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(prog)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#283876] hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Редактировать программу"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingProgram(prog)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Удалить программу"
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
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#283876]">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingProgram ? "Редактировать программу" : "Добавить новую программу"}
                  </h3>
                  <p className="text-xs text-slate-500">Управление параметрами обучения и контрактом</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProgram} className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Университет *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: SUBU (Sakarya Uygulamalı Bilimler Üniversitesi)"
                  value={form.university}
                  onChange={(e) => setForm({ ...form, university: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Город</label>
                  <input
                    type="text"
                    placeholder="Сакарья"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Страна</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Факультет *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: TEKNOLOJİ FAKÜLTESİ"
                  value={form.faculty}
                  onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Название специальности (на русском) *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Компьютерная инженерия"
                  value={form.program_name_ru}
                  onChange={(e) => setForm({ ...form, program_name_ru: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Оригинальное название (на турецком / английском)</label>
                <input
                  type="text"
                  placeholder="Например: BİLGİSAYAR MÜHENDİSLİĞİ BÖLÜMÜ"
                  value={form.program_name}
                  onChange={(e) => setForm({ ...form, program_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Ступень обучения</label>
                  <select
                    value={form.degree_level}
                    onChange={(e) => setForm({ ...form, degree_level: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                  >
                    <option value="Бакалавр">Бакалавр</option>
                    <option value="Ön Lisans (Колледж 2 года)">Ön Lisans (Колледж 2 года)</option>
                    <option value="Специалитет (5 лет)">Специалитет (5 лет)</option>
                    <option value="Специалитет (Медицина 6 лет)">Специалитет (Медицина 6 лет)</option>
                    <option value="Специалитет (Стоматология 5 лет)">Специалитет (Стоматология 5 лет)</option>
                    <option value="Магистратура">Магистратура</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Срок обучения</label>
                  <input
                    type="text"
                    placeholder="4 года"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Годовой контракт *</label>
                  <input
                    type="text"
                    required
                    placeholder="$1,162 или 200.000 ₺"
                    value={form.tuition_fee}
                    onChange={(e) => setForm({ ...form, tuition_fee: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-[#283876] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Валюта</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="TRY">TRY (₺)</option>
                    <option value="KGS">KGS (сом)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Язык обучения</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                  >
                    <option value="Турецкий">Турецкий</option>
                    <option value="Английский">Английский</option>
                    <option value="Русский">Русский</option>
                    <option value="Смешанный">Смешанный</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Заметки / Требования к поступлению</label>
                <textarea
                  rows={2}
                  placeholder="Языковой сертификат, проходные баллы, дедлайн подачи..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
                  <span>{saving ? "Сохранение..." : editingProgram ? "Сохранить изменения" : "Создать программу"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME UNIVERSITY MODAL */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Переименовать университет</h3>
                  <p className="text-xs text-slate-500">Изменение применится ко всем программам ВУЗа</p>
                </div>
              </div>
              <button
                onClick={() => setIsRenameModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenameUniversity} className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Текущий университет</label>
                <select
                  value={renameOldUni}
                  onChange={(e) => setRenameOldUni(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876]"
                >
                  {universities.map((u) => (
                    <option key={u.name} value={u.name}>
                      {u.name} ({u.program_count} программ)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Новое название *</label>
                <input
                  type="text"
                  required
                  placeholder="Введите новое название..."
                  value={renameNewUni}
                  onChange={(e) => setRenameNewUni(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={renaming}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#283876] hover:bg-[#1E2C60] text-white transition-colors shadow-md shadow-[#283876]/20 cursor-pointer flex items-center gap-2"
                >
                  {renaming && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{renaming ? "Обновление..." : "Переименовать"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingProgram && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">Удалить программу?</h3>
            <p className="text-xs text-slate-500 text-center mt-1.5 leading-relaxed">
              Вы уверены, что хотите удалить направление <strong className="text-slate-800">{deletingProgram.program_name_ru}</strong> из каталога <strong className="text-slate-800">{deletingProgram.university}</strong>?
            </p>

            <div className="mt-6 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingProgram(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
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
