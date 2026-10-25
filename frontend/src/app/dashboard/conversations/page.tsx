"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationList } from "@/components/ConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { CustomerInspector } from "@/components/CustomerInspector";
import { EmptyState, PageHeader } from "@/components/WorkspaceUI";
import { api } from "@/lib/api";
import { Conversation, Message, Booking, WhatsAppAccount, GlobalAIModeState } from "@/lib/types";
import { AlertCircle, Bot, Inbox, RefreshCw, UserRound, CheckCircle2, Sparkles, Loader2 } from "lucide-react";

function ConversationsContent() {
  const searchParams = useSearchParams();
  const targetCustomerId = searchParams.get("customer_id");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [waAccounts, setWaAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");
  const [channel, setChannel] = useState("all");

  // Global AI Chatbot state
  const [globalAiState, setGlobalAiState] = useState<GlobalAIModeState | null>(null);
  const [globalAiLoading, setGlobalAiLoading] = useState(false);
  const [globalAiToast, setGlobalAiToast] = useState("");
  const [channelScope, setChannelScope] = useState<"all" | "whatsapp" | "instagram">("all");

  const [messages, setMessages] = useState<Message[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileDialog = useRef<HTMLDialogElement>(null);
  const selectedRef = useRef<string | null>(null);
  const targetHandled = useRef<string | null>(null);
  const detailsGeneration = useRef(0);

  const sync = useCallback(async () => {
    try {
      const [data, accounts, globalAi] = await Promise.all([
        api.getConversations(),
        api.getWhatsAppAccounts().catch(() => []),
        api.getGlobalAIMode().catch(() => null),
      ]);
      setConversations(data);
      if (accounts && accounts.length) setWaAccounts(accounts);
      if (globalAi) setGlobalAiState(globalAi);
      setError("");
      if (targetCustomerId && targetHandled.current !== targetCustomerId) {
        const match = data.find(
          (item) => String(item.customer_id) === targetCustomerId,
        );
        if (match) {
          setSelectedId(match.id);
          targetHandled.current = targetCustomerId;
        }
      }
    } catch {
      setError(
        "Не удалось обновить диалоги. Проверьте соединение и повторите попытку.",
      );
    } finally {
      setLoading(false);
    }
  }, [targetCustomerId]);

  useEffect(() => {
    const start = setTimeout(() => void sync(), 0);
    const interval = setInterval(() => void sync(), 5000);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [sync]);

  useEffect(() => {
    selectedRef.current = selectedId;
    const generation = ++detailsGeneration.current;
    if (!selectedId) return;
    const customerId = conversations.find(
      (item) => String(item.id) === String(selectedId),
    )?.customer_id;
    const load = async (silent: boolean) => {
      if (!silent) {
        setMessagesLoading(true);
        setMessages([]);
        setBookings([]);
      }
      try {
        const data = await api.getMessages(selectedId, 0, 100);
        if (generation !== detailsGeneration.current) return;
        setMessages((previous) =>
          JSON.stringify(previous) === JSON.stringify(data) ? previous : data,
        );
        if (!silent && customerId) {
          const records = await api.getBookings({ customer_id: customerId });
          if (generation === detailsGeneration.current) setBookings(records);
        }
      } catch {
        if (generation === detailsGeneration.current)
          setError(
            "Не удалось загрузить историю диалога. Попробуйте обновить данные.",
          );
      } finally {
        if (generation === detailsGeneration.current) setMessagesLoading(false);
      }
    };
    const start = setTimeout(() => void load(false), 0);
    const interval = setInterval(() => void load(true), 4000);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
      detailsGeneration.current = generation + 1;
    };
    // Polling the conversation list must not reset an open message history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (profileOpen) profileDialog.current?.showModal();
    else profileDialog.current?.close();
  }, [profileOpen]);

  const selected = conversations.find(
    (item) => String(item.id) === String(selectedId),
  );
  const filtered = conversations.filter((item) => {
    if (channel !== "all") {
      if (channel === "instagram" && item.channel !== "instagram") return false;
      if (channel === "whatsapp" && item.channel !== "whatsapp") return false;
      if (channel.startsWith("wa_")) {
        const accId = Number(channel.replace("wa_", ""));
        if (item.channel !== "whatsapp" || item.whatsapp_account_id !== accId) return false;
      }
    }
    if (view === "open" && item.status !== "open") return false;
    if (view === "unread" && !item.unread_count) return false;
    if (view === "ai" && item.mode !== "ai") return false;
    if (view === "unassigned" && item.assigned_user_id) return false;
    const term = search.toLowerCase().trim();
    return (
      !term ||
      [
        item.customer?.name,
        item.customer?.username,
        item.customer?.phone,
        String(item.customer_id),
      ].some((value) => value?.toLowerCase().includes(term))
    );
  });

  const modeChange = async (mode: "ai" | "human" | "paused") => {
    if (!selectedId) return;
    await api.updateConversationMode(selectedId, mode);
    setConversations((previous) =>
      previous.map((item) =>
        String(item.id) === String(selectedId) ? { ...item, mode } : item,
      ),
    );
  };
  const reloadMessages = async () => {
    const id = selectedRef.current;
    if (!id) return;
    try {
      const data = await api.getMessages(id, 0, 100);
      if (selectedRef.current === id) setMessages(data);
    } catch {
      setError("Сообщение отправлено, но обновить историю не удалось.");
    }
  };
  const bookingAction = async (id: string, confirm: boolean) => {
    if (confirm) await api.confirmBooking(id);
    else await api.cancelBooking(id, "Отменено консультантом");
    if (selected?.customer_id)
      setBookings(await api.getBookings({ customer_id: selected.customer_id }));
  };

  const handleGlobalModeSwitch = async (targetMode: "ai" | "human") => {
    setGlobalAiLoading(true);
    try {
      const res = await api.updateGlobalAIMode({
        mode: targetMode,
        channel: channelScope,
        apply_to_existing: true,
      });
      setGlobalAiState(res);
      setConversations((prev) =>
        prev.map((item) => {
          if (channelScope === "whatsapp" && item.channel !== "whatsapp") return item;
          if (channelScope === "instagram" && item.channel !== "instagram") return item;
          return { ...item, mode: targetMode };
        })
      );
      const scopeLabel =
        channelScope === "all"
          ? "для ВСЕХ чатов (WhatsApp и Instagram)"
          : channelScope === "whatsapp"
          ? "для чатов WhatsApp"
          : "для чатов Instagram";
      const msg =
        targetMode === "ai"
          ? `🤖 AI-чат-бот включен ${scopeLabel}`
          : `👤 Все чаты ${scopeLabel} переведены на Консультантов (ИИ отключен)`;
      setGlobalAiToast(msg);
      setTimeout(() => setGlobalAiToast(""), 4500);
    } catch {
      setError("Не удалось изменить глобальный режим ИИ. Попробуйте ещё раз.");
    } finally {
      setGlobalAiLoading(false);
    }
  };

  return (
    <div className={`inbox-page ${selected ? "has-selection" : ""}`}>
      <div className="inbox-page-heading">
        <PageHeader
          eyebrow="ОБЩЕНИЕ СО СТУДЕНТАМИ"
          title="Каждый диалог — возможность."
          description="Instagram и WhatsApp в едином рабочем пространстве."
        >
          <button
            className="icon-button refresh-button"
            onClick={() => {
              void sync();
              void reloadMessages();
            }}
            aria-label="Обновить диалоги"
          >
            <RefreshCw size={17} />
          </button>
        </PageHeader>

        {/* Global AI Chatbot Controller */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 my-3 shadow-sm transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
            {/* Left: Info & Live Status */}
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                  globalAiState?.global_mode === "ai"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-blue-50 text-[#283876] border-blue-200"
                }`}
              >
                {globalAiState?.global_mode === "ai" ? (
                  <Bot className="w-5 h-5" />
                ) : (
                  <UserRound className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Управление AI-чат-ботом
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${
                      globalAiState?.global_mode === "ai"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-[#283876] border-blue-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        globalAiState?.global_mode === "ai"
                          ? "bg-emerald-500"
                          : "bg-[#283876]"
                      }`}
                    />
                    {globalAiState?.global_mode === "ai"
                      ? "ИИ-чат-бот активен"
                      : "Режим Консультантов"}
                  </span>
                  {globalAiState && (
                    <span className="text-[11px] text-slate-400 font-medium">
                      (ИИ: {globalAiState.ai_open} • Консультанты: {globalAiState.human_open})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {globalAiState?.global_mode === "ai"
                    ? "ИИ автоматически отвечает в WhatsApp и Instagram. Вы также можете переключать каждый чат отдельно."
                    : "ИИ отключен глобально — все входящие сообщения обрабатывают живые консультанты."}
                </p>
              </div>
            </div>

            {/* Right: Scope & Global Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              {/* Channel Scope Selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-xs">
                <span className="text-slate-400 text-[11px] font-medium">Канал:</span>
                <select
                  value={channelScope}
                  onChange={(e) => setChannelScope(e.target.value as any)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all">Все (WhatsApp + Insta)</option>
                  <option value="whatsapp">Только WhatsApp</option>
                  <option value="instagram">Только Instagram</option>
                </select>
              </div>

              {/* Action Buttons: AI vs Consultant */}
              <div className="inline-flex bg-slate-100/90 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  disabled={globalAiLoading}
                  onClick={() => handleGlobalModeSwitch("ai")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    globalAiState?.global_mode === "ai"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                  title="Включить AI-чат-бота во всех чатах"
                >
                  {globalAiLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
                  <span>AI-чат-бот (Все чаты)</span>
                </button>

                <button
                  type="button"
                  disabled={globalAiLoading}
                  onClick={() => handleGlobalModeSwitch("human")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    globalAiState?.global_mode === "human"
                      ? "bg-[#283876] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                  title="Перевести все диалоги на Консультантов"
                >
                  {globalAiLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserRound className="w-3.5 h-3.5" />
                  )}
                  <span>Консультант (Все чаты)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {globalAiToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 mb-3 animate-in fade-in shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{globalAiToast}</span>
          </div>
        )}
        <div className="inbox-filters">
          <div className="inbox-views" aria-label="Фильтры диалогов">
            {[
              { id: "all", label: "Все диалоги" },
              { id: "open", label: "Открытые" },
              { id: "unread", label: "Непрочитанные" },
              { id: "ai", label: "AI-ассистент" },
              { id: "unassigned", label: "Без ответственного" },
            ].map((item) => (
              <button
                key={item.id}
                aria-pressed={view === item.id}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="channel-filter">
            <span className="sr-only">Канал общения</span>
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="all">Все каналы</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">Все WhatsApp</option>
              {waAccounts.map((acc) => (
                <option key={acc.id} value={`wa_${acc.id}`}>
                  🟢 WA: {acc.name} ({acc.role})
                </option>
              ))}
            </select>

          </label>
        </div>
      </div>
      {error && (
        <div className="data-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}
      <div className="inbox-workspace">
        <ConversationList
          conversations={filtered}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setProfileOpen(false);
          }}
          searchQuery={search}
          onSearchChange={setSearch}
          loading={loading}
        />
        {selected ? (
          <ChatPanel
            key={selected.id}
            conversation={selected}
            messages={messages}
            loading={messagesLoading}
            onModeChange={modeChange}
            onMessageSent={() => void reloadMessages()}
            onBack={() => setSelectedId(null)}
            onOpenProfile={() => setProfileOpen(true)}
          />
        ) : (
          <div className="chat-empty">
            <EmptyState
              icon={Inbox}
              title="С чего начнём сегодня?"
              description="Выберите диалог, чтобы ответить студенту, уточнить его цели и помочь с поступлением."
            />
            <div className="chat-empty-tip">
              <Bot size={16} />
              AI-ассистент и команда работают вместе
            </div>
          </div>
        )}
      </div>
      <dialog
        ref={profileDialog}
        className="student-dialog"
        onClose={() => setProfileOpen(false)}
        onClick={(event) => {
          if (event.target === profileDialog.current) setProfileOpen(false);
        }}
        aria-label="Профиль студента"
      >
        {selected?.customer && (
          <CustomerInspector
            key={selected.customer.id}
            customer={selected.customer}
            bookings={bookings}
            onConfirmBooking={(id) => bookingAction(id, true)}
            onCancelBooking={(id) => bookingAction(id, false)}
            onClose={() => setProfileOpen(false)}
          />
        )}
      </dialog>
    </div>
  );
}
export default function ConversationsPage() {
  return (
    <Suspense
      fallback={
        <div className="workspace-loading" role="status">
          Загружаем входящие…
        </div>
      }
    >
      <ConversationsContent />
    </Suspense>
  );
}
