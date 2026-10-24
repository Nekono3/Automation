"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  ExternalLink,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

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
    setFormColor("blue");
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
    <div className="inbox-page" style={{ paddingBottom: "40px" }}>
      <div className="inbox-page-heading">
        <PageHeader
          eyebrow="МУЛЬТИ-АККАУНТ И МЕНЕДЖЕРЫ"
          title="Подключение WhatsApp"
          description="Привязывайте номера сотрудников через QR-код. Сообщения распределяются по менеджерам автоматически."
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              className="icon-button refresh-button"
              onClick={fetchAccounts}
              aria-label="Обновить статусы"
              title="Обновить"
            >
              <RefreshCw size={17} />
            </button>
            <button
              onClick={handleOpenCreate}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#10B981",
                color: "#FFFFFF",
                padding: "8px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
            >
              <Plus size={16} />
              Добавить аккаунт
            </button>
          </div>
        </PageHeader>
      </div>

      {error && (
        <div className="data-error" role="alert" style={{ margin: "0 24px 16px" }}>
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          style={{
            margin: "0 24px 16px",
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#34D399",
            padding: "10px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Accounts Grid */}
      <div
        style={{
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "20px",
        }}
      >
        {loading && accounts.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
            Загрузка аккаунтов WhatsApp…
          </div>
        ) : accounts.length === 0 ? (
          <div style={{ gridColumn: "1/-1" }}>
            <EmptyState
              icon={Smartphone}
              title="Нет WhatsApp аккаунтов"
              description="Нажмите «Добавить аккаунт», чтобы подключить первый номер менеджера."
            />
          </div>
        ) : (
          accounts.map((acc, index) => {
            const isConnected = acc.live_status === "connected";
            const isQR = acc.live_status === "qr_ready";

            return (
              <div
                key={acc.id}
                style={{
                  background: "#1E293B",
                  border: acc.is_main ? "2px solid #10B981" : "1px solid #334155",
                  borderRadius: "18px",
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
                }}
              >
                {/* Header */}
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "14px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "17px", fontWeight: 800, color: "#FFFFFF" }}>{acc.name}</span>
                        {acc.is_main && (
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 700,
                              background: "rgba(16, 185, 129, 0.2)",
                              color: "#34D399",
                              padding: "2px 7px",
                              borderRadius: "6px",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                            }}
                          >
                            Главный
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "3px" }}>
                        Роль: <strong style={{ color: "#E2E8F0" }}>{acc.role}</strong> • ID: {acc.account_id}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        onClick={() => handleOpenEdit(acc)}
                        className="icon-button"
                        title="Редактировать имя и роль"
                        style={{ width: "32px", height: "32px", padding: 0 }}
                      >
                        <Edit2 size={15} />
                      </button>
                      {!acc.is_main && (
                        <button
                          onClick={() => handleDelete(acc.account_id, acc.name)}
                          className="icon-button"
                          title="Удалить аккаунт"
                          style={{ width: "32px", height: "32px", padding: 0, color: "#F87171" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div style={{ marginBottom: "16px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: "9999px",
                        background: isConnected
                          ? "rgba(16, 185, 129, 0.15)"
                          : isQR
                          ? "rgba(245, 158, 11, 0.15)"
                          : "rgba(239, 68, 68, 0.15)",
                        color: isConnected ? "#34D399" : isQR ? "#FBBF24" : "#F87171",
                        border: `1px solid ${
                          isConnected
                            ? "rgba(16, 185, 129, 0.3)"
                            : isQR
                            ? "rgba(245, 158, 11, 0.3)"
                            : "rgba(239, 68, 68, 0.3)"
                        }`,
                      }}
                    >
                      <span
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: "currentColor",
                        }}
                      />
                      {isConnected
                        ? "Подключен к WhatsApp"
                        : isQR
                        ? "Ожидает сканирования QR"
                        : "Отключен"}
                    </span>
                  </div>

                  {/* QR or Connected Box */}
                  <div
                    style={{
                      background: "#0F172A",
                      border: "1px dashed #334155",
                      borderRadius: "14px",
                      padding: "16px",
                      minHeight: "230px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "16px",
                    }}
                  >
                    {isConnected ? (
                      <div style={{ textAlign: "center", padding: "10px 0" }}>
                        <div
                          style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "50%",
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "#10B981",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 12px",
                          }}
                        >
                          <WhatsAppIcon className="w-7 h-7" />
                        </div>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: "19px",
                            fontWeight: 800,
                            color: "#FFFFFF",
                            letterSpacing: "0.5px",
                            marginBottom: "6px",
                          }}
                        >
                          {acc.phone || "Номер привязан"}
                        </div>
                        <div style={{ fontSize: "12.5px", color: "#94A3B8" }}>
                          Входящие диалоги на этот номер будут подписаны как <strong>{acc.name}</strong>.
                        </div>
                      </div>
                    ) : acc.qr_image ? (
                      <div style={{ textAlign: "center" }}>
                        <img
                          src={acc.qr_image}
                          alt="WhatsApp QR Code"
                          style={{
                            width: "190px",
                            height: "190px",
                            borderRadius: "10px",
                            display: "block",
                            margin: "0 auto 10px",
                            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                          }}
                        />
                        <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                          Обновляется автоматически каждые 4 сек.
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                        <QrCode size={36} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
                        Генерация QR-кода…
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid #334155",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      fontSize: "12px",
                      color: "#94A3B8",
                      lineHeight: "1.5",
                      marginBottom: "16px",
                    }}
                  >
                    {isConnected ? (
                      <div>
                        ✅ <strong>Устройство синхронизировано.</strong> Сообщения клиентов приходят в единый Inbox CRM.
                      </div>
                    ) : (
                      <div>
                        📱 <strong>Как привязать:</strong> В WhatsApp на телефоне: <i>Настройки / Три точки → Связанные устройства → Привязка устройства</i> и наведите камеру на QR.
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: "flex", gap: "8px", paddingTop: "8px", borderTop: "1px solid #334155" }}>
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(acc.account_id, acc.name)}
                      style={{
                        flex: 1,
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#FCA5A5",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <LogOut size={14} />
                      Отвязать номер
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRestart(acc.account_id)}
                      style={{
                        flex: 1,
                        background: "#2563EB",
                        border: "none",
                        color: "#FFFFFF",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <RefreshCw size={14} />
                      Обновить QR-код
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
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: "#1E293B",
              border: "1px solid #334155",
              borderRadius: "20px",
              padding: "28px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "19px", fontWeight: 800, margin: "0 0 6px", color: "#FFFFFF" }}>
              {editingAcc ? "Редактировать WhatsApp аккаунт" : "Добавить новый WhatsApp номер"}
            </h3>
            <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 20px" }}>
              {editingAcc
                ? "Измените имя менеджера и должность для отображения в CRM."
                : "Будет создана новая сессия. Вы сможете привязать телефон через QR-код."}
            </p>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#E2E8F0", marginBottom: "6px" }}>
                  Имя менеджера / Название номера *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Айгуль, Элина, Алекс"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "#0F172A",
                    border: "1px solid #334155",
                    borderRadius: "10px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#E2E8F0", marginBottom: "6px" }}>
                  Должность / Роль
                </label>
                <input
                  type="text"
                  placeholder="Например: Главный менеджер, Консультант по визам"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "#0F172A",
                    border: "1px solid #334155",
                    borderRadius: "10px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "22px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", color: "#E2E8F0" }}>
                  <input
                    type="checkbox"
                    checked={formIsMain}
                    onChange={(e) => setFormIsMain(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <span>Сделать этот номер <strong>Главным (Руководитель)</strong></span>
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    background: "#334155",
                    border: "none",
                    color: "#E2E8F0",
                    padding: "9px 18px",
                    borderRadius: "10px",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formName.trim()}
                  style={{
                    background: "#10B981",
                    border: "none",
                    color: "#FFFFFF",
                    padding: "9px 20px",
                    borderRadius: "10px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: submitting || !formName.trim() ? 0.6 : 1,
                  }}
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
