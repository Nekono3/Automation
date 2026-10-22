"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationList } from "@/components/ConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { CustomerInspector } from "@/components/CustomerInspector";
import { EmptyState, PageHeader } from "@/components/WorkspaceUI";
import { api } from "@/lib/api";
import { Conversation, Message, Booking } from "@/lib/types";
import { AlertCircle, Bot, Inbox, RefreshCw } from "lucide-react";

function ConversationsContent() {
  const searchParams = useSearchParams();
  const targetCustomerId = searchParams.get("customer_id");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");
  const [channel, setChannel] = useState("all");
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
      const data = await api.getConversations();
      setConversations(data);
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
    if (channel !== "all" && item.channel !== channel) return false;
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
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
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
