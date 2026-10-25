"use client";

import { Conversation, Message } from "@/lib/types";
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  ChevronDown,
  Pause,
  Send,
  UserRound,
  UserRoundSearch,
  X,
  Zap,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/WorkspaceUI";
import { InstagramIcon, WhatsAppIcon } from "@/components/ChannelIcons";

interface Props {
  conversation: Conversation;
  messages: Message[];
  loading?: boolean;
  onModeChange: (mode: "ai" | "human" | "paused") => Promise<void>;
  onMessageSent: () => void;
  onBack: () => void;
  onOpenProfile: () => void;
}

const templates = [
  {
    label: "Первое знакомство",
    text: "Здравствуйте! Рады помочь вам с поступлением за рубеж. В какую страну и на какую программу вы планируете поступать?",
  },
  {
    label: "Уровень языка",
    text: "Подскажите, пожалуйста, какой у вас уровень языка? Есть ли результаты IELTS или TOEFL?",
  },
  {
    label: "Образование",
    text: "Подскажите, пожалуйста, какой у вас текущий уровень образования и средний балл? Это поможет подобрать подходящие программы.",
  },
  {
    label: "Консультация",
    text: "Предлагаем обсудить ваши цели на консультации. Подскажите, какие дни и время вам удобны?",
  },
];

export function ChatPanel({
  conversation,
  messages,
  loading,
  onModeChange,
  onMessageSent,
  onBack,
  onOpenProfile,
}: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [modeLoading, setModeLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isWA = conversation.channel === "whatsapp";
  const channel = isWA
    ? "WhatsApp"
    : conversation.channel === "telegram"
      ? "Telegram"
      : "Instagram";
  const name =
    conversation.customer?.name ||
    conversation.customer?.username ||
    conversation.customer?.phone ||
    `Контакт #${conversation.customer_id}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "end",
    });
  }, [messages]);
  const changeMode = async (mode: "ai" | "human" | "paused") => {
    setModeLoading(true);
    setError("");
    try {
      await onModeChange(mode);
    } catch {
      setError("Не удалось изменить режим. Попробуйте ещё раз.");
    } finally {
      setModeLoading(false);
    }
  };
  const send = async () => {
    if (
      !input.trim() ||
      sending ||
      modeLoading ||
      conversation.status !== "open"
    )
      return;
    setSending(true);
    setError("");
    try {
      if (conversation.mode !== "human") await onModeChange("human");
      await api.sendMessage(conversation.id, input.trim());
      setInput("");
      onMessageSent();
    } catch {
      setError("Сообщение не отправлено. Текст сохранён — попробуйте ещё раз.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="chat-panel" aria-label={`Переписка: ${name}`}>
      <header className="chat-header">
        <button
          className="icon-button chat-back"
          onClick={onBack}
          aria-label="К списку диалогов"
        >
          <ArrowLeft size={20} />
        </button>
        <Avatar name={name} />
        <div className="chat-heading">
          <h2>{name}</h2>
          <span>
            {isWA ? (
              <WhatsAppIcon className="w-3 h-3" />
            ) : (
              <InstagramIcon className="w-3 h-3" />
            )}
            {channel}
            {isWA && conversation.whatsapp_account && (
              <>
                <span className="chat-heading-divider">•</span>
                <span style={{ color: "#34D399", fontWeight: 600 }}>
                  Менеджер: {conversation.whatsapp_account.name}
                </span>
              </>
            )}
            <span className="chat-heading-divider">/</span>
            {conversation.status === "open"
              ? "Открытый диалог"
              : "Диалог закрыт"}
          </span>
        </div>

        <button
          className="icon-button"
          onClick={onOpenProfile}
          aria-label="Открыть профиль студента"
          title="Профиль студента"
        >
          <UserRoundSearch size={20} />
        </button>
      </header>
      <div className="chat-mode-bar">
        <span>
          {conversation.mode === "ai" ? (
            <Bot size={16} />
          ) : conversation.mode === "human" ? (
            <UserRound size={16} />
          ) : (
            <Pause size={16} />
          )}
          <span>
            {conversation.mode === "ai"
              ? "AI-ассистент ведёт диалог"
              : conversation.mode === "human"
                ? "Вы отвечаете студенту (Консультант)"
                : "Автоответы на паузе"}
          </span>
        </span>

        {/* Per-chat Quick Mode Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={modeLoading || sending}
            onClick={() => void changeMode("ai")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
              conversation.mode === "ai"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
            title="Переключить этот диалог на AI-ассистента"
          >
            <Bot size={13} className={conversation.mode === "ai" ? "text-emerald-600" : "text-slate-400"} />
            <span>AI-чат-бот</span>
          </button>

          <button
            type="button"
            disabled={modeLoading || sending}
            onClick={() => void changeMode("human")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
              conversation.mode === "human"
                ? "bg-blue-50 text-[#283876] border-blue-300 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
            title="Переключить этот диалог на консультанта"
          >
            <UserRound size={13} className={conversation.mode === "human" ? "text-[#283876]" : "text-slate-400"} />
            <span>Консультант</span>
          </button>

          <button
            type="button"
            disabled={modeLoading || sending}
            onClick={() => void changeMode("paused")}
            className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer border ${
              conversation.mode === "paused"
                ? "bg-amber-50 text-amber-700 border-amber-300 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
            title="Поставить диалог на паузу"
          >
            <Pause size={12} className={conversation.mode === "paused" ? "text-amber-600" : "text-slate-400"} />
          </button>
        </div>

        {/* Existing Dropdown preserved */}
        <label className="mode-select hidden sm:flex">
          <span className="sr-only">Режим ответа</span>
          <select
            value={conversation.mode}
            disabled={modeLoading || sending}
            onChange={(event) =>
              void changeMode(event.target.value as "ai" | "human" | "paused")
            }
          >
            <option value="ai">AI-ассистент</option>
            <option value="human">Консультант</option>
            <option value="paused">Пауза</option>
          </select>
          <ChevronDown size={13} />
        </label>
      </div>
      <div
        className="chat-messages"
        aria-label="История сообщений"
        aria-busy={loading}
      >
        {loading ? (
          <div className="chart-loading" role="status">
            Загружаем сообщения…
          </div>
        ) : !messages.length ? (
          <div className="chat-start">
            <MessageStart />
            <p>Начало вашей истории с {name}</p>
            <span>Помогите студенту сделать первый шаг.</span>
          </div>
        ) : (
          messages.map((message, index) => {
            const date = new Date(message.created_at);
            const previous = messages[index - 1];
            const separator =
              !previous ||
              new Date(previous.created_at).toDateString() !==
                date.toDateString();
            const inbound = message.direction === "inbound";
            return (
              <div key={message.id}>
                {separator && (
                  <div className="chat-date">
                    {date.toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                )}
                <div
                  className={`message-row ${inbound ? "inbound" : "outbound"}`}
                >
                  <div
                    className={`message-bubble ${message.sender_type === "ai" ? "ai-message" : ""}`}
                  >
                    <span className="message-author">
                      {inbound ? (
                        name
                      ) : message.sender_type === "ai" ? (
                        <>
                          <Bot size={12} /> AI-ассистент
                        </>
                      ) : (
                        "Консультант"
                      )}
                    </span>
                    <p>{message.text}</p>
                    {!!message.attachments?.length && (
                      <span className="message-attachment-note">
                        Вложение доступно в {channel}
                      </span>
                    )}
                    <span className="message-time">
                      {date.toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {!inbound && message.status === "read" && (
                        <CheckCheck size={13} aria-label="Прочитано" />
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      {showTemplates && (
        <div className="reply-templates">
          <div>
            <strong>Быстрые ответы</strong>
            <button
              className="icon-button"
              onClick={() => setShowTemplates(false)}
              aria-label="Закрыть быстрые ответы"
            >
              <X size={16} />
            </button>
          </div>
          {templates.map((template) => (
            <button
              key={template.label}
              onClick={() => {
                setInput(template.text);
                setShowTemplates(false);
                textareaRef.current?.focus();
              }}
            >
              <strong>{template.label}</strong>
              <span>{template.text}</span>
            </button>
          ))}
        </div>
      )}
      <div className="chat-composer">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {conversation.status !== "open" ? (
          <p className="composer-hint">
            Этот диалог закрыт. История сообщений доступна для просмотра.
          </p>
        ) : (
          <>
            <label htmlFor="reply-message" className="composer-label">
              Ответ в {channel}
            </label>
            <textarea
              id="reply-message"
              ref={textareaRef}
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Напишите сообщение студенту…"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <div className="composer-toolbar">
              <button
                className="template-trigger"
                onClick={() => setShowTemplates(!showTemplates)}
                aria-expanded={showTemplates}
              >
                <Zap size={16} />
                <span>Быстрые ответы</span>
              </button>
              <span className="composer-key-hint">
                Shift + Enter — новая строка
              </span>
              <button
                className="button button-primary"
                disabled={!input.trim() || sending || modeLoading}
                onClick={() => void send()}
              >
                {sending ? "Отправка…" : "Отправить"}
                <Send size={15} />
              </button>
            </div>
            {conversation.mode === "ai" && (
              <p className="composer-hint">
                При отправке ответа диалог перейдёт к консультанту.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function MessageStart() {
  return (
    <span className="empty-icon">
      <GraduationIcon />
    </span>
  );
}
function GraduationIcon() {
  return <Bot size={24} />;
}
