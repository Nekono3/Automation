"use client";

import { useState, useEffect } from "react";
import { Customer, Booking } from "@/lib/types";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Calendar,
  Tag,
  Check,
  X,
  ExternalLink,
  PanelRightClose,
  ChevronDown,
  Bot,
  GraduationCap,
  Save,
} from "lucide-react";
import { ChannelBadge } from "@/components/ChannelIcons";

interface Props {
  customer: Customer;
  bookings: Booking[];
  onConfirmBooking: (id: string) => void | Promise<void>;
  onCancelBooking: (id: string) => void | Promise<void>;
  onClose?: () => void;
}

export function CustomerInspector({
  customer,
  bookings,
  onConfirmBooking,
  onCancelBooking,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<"details" | "copilot">("details");
  const [linksExpanded, setLinksExpanded] = useState(true);
  const [attributesExpanded, setAttributesExpanded] = useState(true);
  const [studentExpanded, setStudentExpanded] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // EdTech Student Profile state
  const [grade, setGrade] = useState("");
  const [countries, setCountries] = useState("");
  const [degree, setDegree] = useState("BACHELOR");
  const [ielts, setIelts] = useState("");
  const [budget, setBudget] = useState("FULL_SCHOLARSHIP_ONLY");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  useEffect(() => {
    if (customer.id) {
      api
        .getStudentProfile(customer.id)
        .then((p) => {
          if (p) {
            setGrade(p.current_grade_or_status || "");
            setCountries((p.target_countries || []).join(", "));
            setDegree(p.target_degree || "BACHELOR");
            setIelts(
              p.language_tests?.ielts ? String(p.language_tests.ielts) : "",
            );
            setBudget(p.budget_expectation || "FULL_SCHOLARSHIP_ONLY");
          } else {
            setGrade("");
            setCountries("");
            setDegree("BACHELOR");
            setIelts("");
            setBudget("FULL_SCHOLARSHIP_ONLY");
          }
        })
        .catch(() =>
          setError(
            "Профиль пока не загружен. Закройте панель и попробуйте ещё раз.",
          ),
        );
    }
  }, [customer.id]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setError("");
    try {
      const updated = await api.updateStudentProfile(customer.id, {
        current_grade_or_status: grade,
        target_countries: countries
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        target_degree: degree,
        language_tests: ielts ? { ielts } : {},
        budget_expectation: budget,
      });
      void updated;
      setProfileSavedMsg(true);
      setTimeout(() => setProfileSavedMsg(false), 2000);
    } catch {
      setError("Не удалось сохранить профиль. Попробуйте ещё раз.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleBookingAction = async (id: string, confirm: boolean) => {
    setActionLoading(true);
    setError("");
    try {
      if (confirm) await onConfirmBooking(id);
      else await onCancelBooking(id);
    } catch {
      setError("Не удалось обновить консультацию. Попробуйте ещё раз.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="w-[310px] shrink-0 bg-white border border-slate-200/90 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm select-none text-xs">
      {/* Top Header */}
      <div className="h-14 px-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        {/* Tabs: Details & Copilot */}
        <div className="flex items-center gap-4 h-full">
          <button
            onClick={() => setActiveTab("details")}
            className={`h-full flex items-center font-bold text-xs border-b-2 transition-colors cursor-pointer ${
              activeTab === "details"
                ? "border-[#283876] text-[#283876]"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            Профиль студента
          </button>

          <button
            onClick={() => setActiveTab("copilot")}
            className={`h-full flex items-center gap-1.5 font-bold text-xs border-b-2 transition-colors cursor-pointer ${
              activeTab === "copilot"
                ? "border-[#283876] text-[#283876]"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-[#283876]" />
            <span>План поступления</span>
          </button>
        </div>

        {/* Right Utility Buttons */}
        <div className="flex items-center gap-1 text-slate-400">
          <Link
            href="/dashboard/customers"
            className="icon-button"
            aria-label="Открыть базу студентов"
          >
            <ExternalLink size={17} />
          </Link>
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

      {error && (
        <p className="form-error p-4" role="alert">
          {error}
        </p>
      )}
      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "details" ? (
          <>
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                {customer.name ||
                  customer.username ||
                  `Контакт #${customer.id}`}
              </h2>
              <div className="mt-2">
                <ChannelBadge
                  instagramId={customer.instagram_id}
                  whatsappId={customer.whatsapp_id}
                  phone={customer.phone}
                />
              </div>
            </div>

            {/* STUDENT PROFILE SECTION (CONSULTEAM EDTECH) */}
            <div className="space-y-2 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between text-slate-600">
                <button
                  aria-expanded={studentExpanded}
                  onClick={() => setStudentExpanded(!studentExpanded)}
                  className="flex items-center gap-1 font-bold text-xs tracking-wider uppercase text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${studentExpanded ? "" : "-rotate-90"}`}
                  />
                  <GraduationCap className="w-3.5 h-3.5 text-[#283876]" />
                  <span>ПРОФИЛЬ АБИТУРИЕНТА</span>
                </button>
                {profileSavedMsg && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Сохранено
                  </span>
                )}
              </div>

              {studentExpanded && (
                <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 text-xs">
                  <div>
                    <label
                      htmlFor="student-grade"
                      className="text-xs font-medium text-slate-600 block mb-1"
                    >
                      Класс / Статус:
                    </label>
                    <input
                      id="student-grade"
                      type="text"
                      placeholder="11 класс, Студент 2 курса..."
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#283876]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="student-countries"
                      className="text-xs font-medium text-slate-600 block mb-1"
                    >
                      Целевые страны:
                    </label>
                    <input
                      id="student-countries"
                      type="text"
                      placeholder="Италия, США, Корея..."
                      value={countries}
                      onChange={(e) => setCountries(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#283876]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="student-degree"
                        className="text-xs font-medium text-slate-600 block mb-1"
                      >
                        Степень:
                      </label>
                      <select
                        id="student-degree"
                        value={degree}
                        onChange={(e) => setDegree(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#283876]"
                      >
                        <option value="BACHELOR">Бакалавриат</option>
                        <option value="MASTER">Магистратура</option>
                        <option value="FOUNDATION">Foundation</option>
                        <option value="LANGUAGE_SCHOOL">Языковые курсы</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="student-ielts"
                        className="text-xs font-medium text-slate-600 block mb-1"
                      >
                        IELTS:
                      </label>
                      <input
                        id="student-ielts"
                        type="text"
                        placeholder="Например, 6.5"
                        value={ielts}
                        onChange={(e) => setIelts(e.target.value)}
                        className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#283876]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="student-budget"
                      className="text-xs font-medium text-slate-600 block mb-1"
                    >
                      Бюджет / Грант:
                    </label>
                    <select
                      id="student-budget"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#283876]"
                    >
                      <option value="FULL_SCHOLARSHIP_ONLY">
                        Только полный грант (100%)
                      </option>
                      <option value="PARTIAL_GRANT">Частичный грант</option>
                      <option value="SELF_FUNDED_UP_TO_5K">
                        Платное (до $5,000/год)
                      </option>
                      <option value="SELF_FUNDED_ABOVE_10K">
                        Платное ($10,000+/год)
                      </option>
                    </select>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="w-full mt-1 py-1.5 bg-[#283876] hover:bg-[#1E2C60] text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {savingProfile ? "Сохранение..." : "Сохранить профиль"}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* LINKS / BOOKINGS SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <button
                  aria-expanded={linksExpanded}
                  onClick={() => setLinksExpanded(!linksExpanded)}
                  className="flex items-center gap-1 font-bold text-xs tracking-wider uppercase text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${linksExpanded ? "" : "-rotate-90"}`}
                  />
                  <span>ЗАПИСИ НА КОНСУЛЬТАЦИЮ ({bookings.length})</span>
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
                      const date = booking.scheduled_at
                        ? new Date(booking.scheduled_at)
                        : new Date(booking.created_at);
                      const isActionable =
                        booking.status === "awaiting_confirmation" ||
                        booking.status === "draft";

                      return (
                        <div
                          key={booking.id}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2 shadow-sm"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-900 truncate">
                              {booking.service?.name ||
                                booking.service_name_snapshot}
                            </span>
                            <span className="text-[#283876] font-mono font-bold shrink-0">
                              {booking.price_snapshot} {booking.currency}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 flex items-center gap-1.5 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {date.toLocaleDateString("ru-RU")} в{" "}
                              {date.toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {/* Status and Action Buttons */}
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80">
                            <span
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                booking.status === "confirmed"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : booking.status === "awaiting_confirmation"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : booking.status === "cancelled"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {booking.status === "confirmed"
                                ? "Подтверждена"
                                : booking.status === "awaiting_confirmation"
                                  ? "Ожидает"
                                  : booking.status === "cancelled"
                                    ? "Отменена"
                                    : booking.status}
                            </span>

                            {isActionable && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  disabled={actionLoading}
                                  onClick={() =>
                                    void handleBookingAction(booking.id, true)
                                  }
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold flex items-center gap-1 cursor-pointer shadow-sm"
                                  title="Подтвердить бронь и отправить уведомление клиенту в Instagram Direct"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Да</span>
                                </button>
                                <button
                                  disabled={actionLoading}
                                  onClick={() =>
                                    void handleBookingAction(booking.id, false)
                                  }
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
                  aria-expanded={attributesExpanded}
                  onClick={() => setAttributesExpanded(!attributesExpanded)}
                  className="flex items-center gap-1 font-bold text-xs tracking-wider uppercase text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${attributesExpanded ? "" : "-rotate-90"}`}
                  />
                  <span>ДАННЫЕ КЛИЕНТА</span>
                </button>
              </div>

              {attributesExpanded && (
                <div className="space-y-2.5 pl-1 text-xs">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500">ID клиента</span>
                    <span className="text-slate-900 font-mono font-semibold">
                      {customer.id}
                    </span>
                  </div>

                  {customer.whatsapp_id && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">WhatsApp ID</span>
                      <span className="text-emerald-700 font-mono font-semibold truncate max-w-[150px]">
                        {customer.whatsapp_id.includes("@lid")
                          ? "WhatsApp Client"
                          : customer.whatsapp_id}
                      </span>
                    </div>
                  )}

                  {customer.instagram_id && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">Instagram Handle</span>
                      <span className="text-[#283876] font-mono font-semibold truncate max-w-[150px]">
                        {customer.username
                          ? `@${customer.username}`
                          : customer.instagram_id}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500">Телефон</span>
                    <span className="text-slate-900 font-mono font-medium">
                      {customer.phone && !customer.phone.includes("@lid")
                        ? customer.phone
                        : "Не указан"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500">Язык</span>
                    <span className="text-slate-900 font-medium">
                      {customer.preferred_language === "KY"
                        ? "Кыргызский"
                        : customer.preferred_language === "EN"
                          ? "English"
                          : customer.preferred_language === "RU"
                            ? "Русский"
                            : "Не указан"}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="pt-1.5">
                    <div className="text-xs text-slate-500 mb-1 font-medium flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      <span>Теги обращения:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(customer.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-0.5 bg-blue-50 border border-blue-100 text-[#283876] font-semibold rounded-md text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="pt-2">
                    <div className="text-xs text-slate-500 mb-1 font-medium">
                      Заметки по клиенту:
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-700 text-xs leading-relaxed">
                      {customer.notes || "Заметок пока нет."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <GraduationCap className="text-[#283876] mb-3" size={24} />
              <h3 className="font-semibold text-slate-900">
                Следующий шаг студента
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                Уточните цели, уровень образования и языковые тесты. Заполните
                профиль, затем откройте воронку, чтобы создать заявку и
                отслеживать документы.
              </p>
              <Link
                href="/dashboard/pipeline"
                className="button button-primary mt-4 w-full"
                onClick={onClose}
              >
                Открыть поступления
              </Link>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Быстрые шаблоны для знакомства и уточнения целей доступны в поле
              ответа.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
