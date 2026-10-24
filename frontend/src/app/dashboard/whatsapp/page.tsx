"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { WhatsAppAccount } from "@/lib/types";
import { PageHeader, EmptyState } from "@/components/WorkspaceUI";
import { WhatsAppIcon } from "@/components/ChannelIcons";
import {
  Plus,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Edit2,
  Trash2,
  LogOut,
  X,
  Check,
  Shield,
  User,
  Info,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function WhatsAppManagementPage() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Edit / Create Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<WhatsAppAccount | null>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("Консультант");
  const [formColor, setFormColor] = useState("emerald");
  const [formIsMain, setFormIsMain] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await api.getWhatsAppAccounts();
      setAccounts(data);
      setError("");
    } catch {
      setError("Не удалось обновить статусы WhatsApp. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    const interval = setInterval(fetchAccounts, 4000);
    return () => clearInterval(interval);
  }, [fetchAccounts]);

  const handleOpenCreate = () => {
    setEditingAcc(null);
    setFormName("");
    setFormRole("Консультант");
    setFormColor("emerald");
    setFormIsMain(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (acc: WhatsAppAccount) => {
    setEditingAcc(acc);
    setFormName(acc.name);
    setFormRole(acc.role);
    setFormColor(acc.color || "emerald");
    setFormIsMain(acc.is_main);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      if (editingAcc) {
        await api.updateWhatsAppAccount(editingAcc.account_id, {
          name: formName.trim(),
          role: formRole.trim(),
          color: formColor,
          is_main: formIsMain,
        });
        setSuccessMsg(`Аккаунт «${formName}» успешно обновлен`);
      } else {
        await api.createWhatsAppAccount({
          name: formName.trim(),
          role: formRole.trim(),
          color: formColor,
          is_main: formIsMain,
        });
        setSuccessMsg(`Новый аккаунт «${formName}» успешно создан`);
      }
      setModalOpen(false);
      await fetchAccounts();
    } catch {
      setError("Ошибка при сохранении аккаунта");
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  const handleDisconnect = async (accountId: string, name: string) => {
    if (!confirm(`Отключить WhatsApp номер для «${name}»? Сессия будет сброшена, и появится новый QR-код.`)) return;
    try {
      await api.disconnectWhatsAppSession(accountId);
      setSuccessMsg(`Сессия «${name}» отключена. Сканируйте новый QR.`);
      await fetchAccounts();
    } catch {
      setError("Не удалось отключить сессию");
    } finally {
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  const handleRestart = async (accountId: string) => {
    try {
      await api.restartWhatsAppSession(accountId);
      await fetchAccounts();
    } catch {
      setError("Не удалось перезапустить сессию");
    }
  };

  const handleDelete = async (accountId: string, name: string) => {
    if (!confirm(`Удалить WhatsApp аккаунт «${name}»? Переписки сохранятся в базе данных.`)) return;
    try {
      await api.deleteWhatsAppAccount(accountId);
      setSuccessMsg(`Аккаунт «${name}» удален`);
      await fetchAccounts();
    } catch {
      setError("Не удалось удалить аккаунт");
    } finally {
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="МУЛЬТИ-АККАУНТ И МЕНЕДЖЕРЫ"
        title="Подключение WhatsApp"
        description="Привязывайте номера сотрудников через QR-код. Сообщения распределяются по менеджерам автоматически."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchAccounts}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            title="Обновить статусы"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#283876]" />
            <span>Обновить</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#283876] hover:bg-[#1E2C60] text-white transition-colors shadow-md shadow-[#283876]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить аккаунт</span>
          </button>
        </div>
      </PageHeader>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && accounts.length === 0 ? (
          <div className="col-span-full text-center py-16 text-slate-400 text-sm">
            Загрузка аккаунтов WhatsApp…
          </div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={Smartphone}
              title="Нет WhatsApp аккаунтов"
              description="Нажмите «Добавить аккаунт», чтобы подключить первый номер менеджера."
            />
          </div>
        ) : (
          accounts.map((acc) => {
            const isConnected = acc.live_status === "connected";
            const isQR = acc.live_status === "qr_ready";

            return (
              <div
                key={acc.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all ${
                  acc.is_main
                    ? "border-2 border-[#283876]/30 shadow-blue-50/50"
                    : "border-slate-200/90 hover:border-slate-300"
                }`}
              >
                {/* Top Section */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 tracking-tight">{acc.name}</h2>
                        {acc.is_main && (
                          <span className="text-[11px] font-bold bg-blue-50 text-[#283876] border border-blue-200/70 px-2 py-0.5 rounded-md">
                            Главный
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span>{acc.role}</span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono text-slate-400 text-[11px]">{acc.account_id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(acc)}
                        className="p-1.5 text-slate-400 hover:text-[#283876] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Редактировать имя и роль"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!acc.is_main && (
                        <button
                          onClick={() => handleDelete(acc.account_id, acc.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Удалить аккаунт"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div className="mb-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isConnected
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : isQR
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isConnected
                            ? "bg-emerald-500"
                            : isQR
                            ? "bg-amber-500 animate-pulse"
                            : "bg-slate-400"
                        }`}
                      />
                      {isConnected
                        ? "Подключен к WhatsApp"
                        : isQR
                        ? "Ожидает сканирования QR"
                        : "Отключен"}
                    </span>
                  </div>

                  {/* QR or Connected Box */}
                  <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 my-2 flex flex-col items-center justify-center min-h-[230px]">
                    {isConnected ? (
                      <div className="text-center py-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-sm border border-emerald-200/50">
                          <WhatsAppIcon className="w-7 h-7" />
                        </div>
                        <div className="font-mono text-xl font-bold text-slate-900 tracking-wide mb-1">
                          {acc.phone || "Номер привязан"}
                        </div>
                        <div className="text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                          Диалоги на этот номер будут подписаны именем <strong>{acc.name}</strong>.
                        </div>
                      </div>
                    ) : acc.qr_image ? (
                      <div className="text-center">
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm inline-block mb-2">
                          <img
                            src={acc.qr_image}
                            alt="WhatsApp QR Code"
                            className="w-[180px] h-[180px] rounded-lg block"
                          />
                        </div>
                        <div className="text-[11px] text-slate-400">
                          QR обновляется автоматически
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-slate-400 text-xs py-8">
                        <QrCode className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#283876]" />
                        <span>Генерация QR-кода…</span>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-xs text-slate-600 mb-4 leading-relaxed flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#283876] shrink-0 mt-0.5" />
                    <div>
                      {isConnected ? (
                        <span>
                          Устройство синхронизировано. Входящие и исходящие сообщения отображаются в едином Inbox CRM.
                        </span>
                      ) : (
                        <span>
                          На телефоне откройте: <strong>WhatsApp → Связанные устройства → Привязка устройства</strong> и наведите камеру на QR.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100">
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(acc.account_id, acc.name)}
                      className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Отвязать номер</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRestart(acc.account_id)}
                      className="w-full bg-[#283876] hover:bg-[#1E2C60] text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Обновить QR-код</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal for Create / Edit */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingAcc ? "Редактировать WhatsApp аккаунт" : "Добавить новый WhatsApp номер"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Имя менеджера / Название номера *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Айгуль, Элина, Алекс"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Должность / Роль
                </label>
                <input
                  type="text"
                  placeholder="Например: Главный менеджер, Консультант по визам"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#283876] focus:bg-white transition-colors"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={formIsMain}
                    onChange={(e) => setFormIsMain(e.target.checked)}
                    className="w-4 h-4 rounded text-[#283876] focus:ring-[#283876]"
                  />
                  <span>Сделать этот номер <strong>Главным (Руководитель)</strong></span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formName.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#283876] hover:bg-[#1E2C60] text-white transition-colors shadow-md shadow-[#283876]/20 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Сохранение…" : editingAcc ? "Сохранить изменения" : "Создать аккаунт"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
