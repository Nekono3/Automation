"use client";

import { Conversation } from "@/lib/types";
import { ArrowDownWideNarrow, Bot, Inbox, Search } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ru } from "date-fns/locale";
import { WhatsAppIcon, InstagramIcon } from "@/components/ChannelIcons";
import { Avatar, EmptyState } from "@/components/WorkspaceUI";

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  loading: boolean;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  loading,
}: Props) {
  const [newest, setNewest] = useState(true);
  const sorted = [...conversations].sort(
    (a, b) =>
      (new Date(b.last_message_at || 0).getTime() -
        new Date(a.last_message_at || 0).getTime()) *
      (newest ? 1 : -1),
  );
  return (
    <section className="conversation-list" aria-label="Список диалогов">
      <div className="conversation-list-header">
        <div>
          <h2>
            Диалоги <span>{conversations.length}</span>
          </h2>
          <button
            className="icon-button"
            onClick={() => setNewest(!newest)}
            aria-label={
              newest ? "Сначала старые диалоги" : "Сначала новые диалоги"
            }
            title={newest ? "Сначала новые" : "Сначала старые"}
          >
            <ArrowDownWideNarrow size={17} />
          </button>
        </div>
        <label className="inbox-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Поиск диалога по имени или телефону"
            placeholder="Имя, телефон, @username"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
      <div className="conversation-list-scroll">
        {loading ? (
          <div className="chart-loading" role="status">
            Загружаем диалоги…
          </div>
        ) : sorted.length ? (
          sorted.map((conversation, index) => {
            const name =
              conversation.customer?.name ||
              conversation.customer?.username ||
              conversation.customer?.phone ||
              `Контакт #${conversation.customer_id}`;
            const date = new Date(conversation.last_message_at);
            const time = Number.isNaN(date.getTime())
              ? ""
              : formatDistanceToNowStrict(date, {
                  locale: ru,
                  addSuffix: true,
                });
            return (
              <button
                key={conversation.id}
                className={`conversation-item ${String(selectedId) === String(conversation.id) ? "is-selected" : ""}`}
                onClick={() => onSelect(conversation.id)}
                aria-pressed={String(selectedId) === String(conversation.id)}
              >
                <span className="conversation-avatar">
                  <Avatar name={name} tone={index} />
                  <span
                    className={`avatar-channel ${conversation.channel === "whatsapp" ? "channel-wa" : "channel-ig"}`}
                  >
                    {conversation.channel === "whatsapp" ? (
                      <WhatsAppIcon className="w-2.5 h-2.5" />
                    ) : (
                      <InstagramIcon className="w-2.5 h-2.5" />
                    )}
                  </span>
                </span>
                <span className="conversation-item-body">
                  <span className="conversation-item-title">
                    <strong>{name}</strong>
                    {conversation.unread_count > 0 && (
                      <span className="unread-badge">
                        {conversation.unread_count}
                      </span>
                    )}
                  </span>
                  <span className="conversation-preview">
                    {conversation.last_message_preview || "Открыть переписку"}
                  </span>
                  <span className="conversation-item-meta">
                    <span>
                      {conversation.mode === "ai" ? (
                        <>
                          <Bot size={12} /> AI-ассистент
                        </>
                      ) : conversation.mode === "paused" ? (
                        "На паузе"
                      ) : (
                        "Консультант"
                      )}
                    </span>
                    {conversation.channel === "whatsapp" && conversation.whatsapp_account && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "6px",
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#34D399",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                        }}
                      >
                        {conversation.whatsapp_account.name}
                      </span>
                    )}
                    <time dateTime={conversation.last_message_at}>{time}</time>
                  </span>

                </span>
              </button>
            );
          })
        ) : (
          <EmptyState
            icon={Inbox}
            title={searchQuery ? "Совпадений нет" : "Пока нет диалогов"}
            description={
              searchQuery
                ? "Попробуйте другое имя, номер или измените фильтры."
                : "Новые обращения студентов появятся здесь."
            }
          />
        )}
      </div>
      <div className="conversation-list-footer">
        <InstagramIcon className="w-3.5 h-3.5" />
        <WhatsAppIcon className="w-3.5 h-3.5" />
        <span>Все обращения в одном месте</span>
      </div>
    </section>
  );
}
