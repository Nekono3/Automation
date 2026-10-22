"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Booking, Conversation, DashboardStats, Deal } from "@/lib/types";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileCheck2,
  GraduationCap,
  Inbox,
  MessageCircle,
  RefreshCw,
  Users,
  AlertCircle,
} from "lucide-react";
import {
  Avatar,
  EmptyState,
  PageHeader,
  SectionLink,
} from "@/components/WorkspaceUI";
import { InstagramIcon, WhatsAppIcon } from "@/components/ChannelIcons";

const stages = [
  { id: "DOCS_COLLECTION", label: "Документы", className: "stage-documents" },
  { id: "ESSAY_AND_PORTFOLIO", label: "Эссе и CV", className: "stage-essay" },
  {
    id: "APPLICATIONS_SUBMITTED",
    label: "Заявки поданы",
    className: "stage-applied",
  },
  { id: "OFFER_RECEIVED", label: "Оффер получен", className: "stage-offer" },
  { id: "VISA_STAGE", label: "Оформление визы", className: "stage-visa" },
  {
    id: "ENROLLED_AND_DEPARTED",
    label: "Зачислены",
    className: "stage-enrolled",
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [updated, setUpdated] = useState<Date | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.getDashboardStats(),
      api.getBookings(),
      api.getConversations(),
      api.getDeals("ADMISSION"),
    ]);
    const errors: string[] = [];
    if (results[0].status === "fulfilled") setStats(results[0].value);
    else errors.push("показатели");
    if (results[1].status === "fulfilled") setBookings(results[1].value);
    else errors.push("консультации");
    if (results[2].status === "fulfilled") setConversations(results[2].value);
    else errors.push("диалоги");
    if (results[3].status === "fulfilled") setDeals(results[3].value);
    else errors.push("поступления");
    setFailed(errors);
    setUpdated(new Date());
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const metric = (value: number | undefined) =>
    loading || failed.includes("показатели")
      ? "—"
      : (value ?? 0).toLocaleString("ru-RU");
  const upcoming = bookings
    .filter(
      (booking) =>
        booking.scheduled_at &&
        new Date(booking.scheduled_at).getTime() >= (updated?.getTime() ?? 0) &&
        ["confirmed", "awaiting_confirmation", "draft"].includes(
          booking.status,
        ),
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )
    .slice(0, 3);
  const recent = [...conversations]
    .sort(
      (a, b) =>
        new Date(b.last_message_at).getTime() -
        new Date(a.last_message_at).getTime(),
    )
    .slice(0, 4);
  const stageCounts = stages.map((stage) => ({
    ...stage,
    count: deals.filter((deal) => deal.stage === stage.id).length,
  }));
  const maxCount = Math.max(...stageCounts.map((stage) => stage.count), 1);
  const enrolled = stageCounts[5].count;
  const date = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
  const metrics = [
    {
      label: "Студенты и контакты",
      value: stats?.total_customers,
      icon: Users,
      detail: "В вашей базе",
      href: "/dashboard/customers",
      tone: "blue",
    },
    {
      label: "Активные диалоги",
      value: stats?.open_conversations,
      icon: MessageCircle,
      detail: "Instagram и WhatsApp",
      href: "/dashboard/conversations",
      tone: "teal",
    },
    {
      label: "AI-сопровождение",
      value: stats?.ai_conversations,
      icon: Bot,
      detail: "Ассистент ведёт диалог",
      href: "/dashboard/conversations",
      tone: "violet",
    },
    {
      label: "Ждут подтверждения",
      value: stats?.pending_bookings,
      icon: CalendarDays,
      detail: "Записи на консультацию",
      href: "/dashboard/bookings",
      tone: "amber",
    },
  ];

  return (
    <div className="overview-page">
      <PageHeader
        eyebrow="ВАШ РАБОЧИЙ ДЕНЬ"
        title="Большие цели. Понятный план."
        description="Все диалоги, студенты и поступления — под вашим контролем."
      >
        <span className="date-label">
          <CalendarDays size={16} />
          {date}
        </span>
        <button
          className="icon-button refresh-button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Обновить данные"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </PageHeader>
      {failed.length > 0 && (
        <div className="data-error" role="alert">
          <AlertCircle size={18} />
          <span>Не удалось загрузить: {failed.join(", ")}.</span>
          <button onClick={() => void load()} disabled={loading}>
            Повторить
          </button>
        </div>
      )}
      <div className="overview-banner">
        <div className="overview-banner-icon">
          <GraduationCap size={29} strokeWidth={1.5} />
        </div>
        <div>
          <span className="eyebrow">КАЖДЫЙ ШАГ ИМЕЕТ ЗНАЧЕНИЕ</span>
          <h2>Помогаем студентам двигаться к мечте.</h2>
          <p>От первого «здравствуйте» до зачисления в университет.</p>
        </div>
        <Link href="/dashboard/pipeline" className="button button-banner">
          К поступлениям <ArrowRight size={17} />
        </Link>
        <div className="banner-orbit orbit-one" />
        <div className="banner-orbit orbit-two" />
      </div>
      <section className="metric-grid" aria-label="Основные показатели">
        {metrics.map(({ label, value, icon: Icon, detail, href, tone }) => (
          <Link href={href} className="metric-card" key={label}>
            <div className="metric-top">
              <span className={`metric-icon tone-${tone}`}>
                <Icon size={20} strokeWidth={1.7} />
              </span>
              <ArrowUpRight size={17} className="metric-arrow" />
            </div>
            <span className="metric-value">{metric(value)}</span>
            <h2>{label}</h2>
            <p>{detail}</p>
          </Link>
        ))}
      </section>
      <div className="overview-grid">
        <section className="surface pipeline-summary">
          <div className="section-heading">
            <div>
              <h2>Путь к поступлению</h2>
              <p>Студенты на каждом этапе сопровождения</p>
            </div>
            <SectionLink href="/dashboard/pipeline">Вся воронка</SectionLink>
          </div>
          {loading ? (
            <div className="chart-loading" role="status">
              Загружаем поступления…
            </div>
          ) : failed.includes("поступления") ? (
            <EmptyState
              icon={AlertCircle}
              title="Поступления недоступны"
              description="Обновите данные, чтобы загрузить воронку."
            />
          ) : (
            <>
              <div
                className="pipeline-chart"
                role="img"
                aria-label={stageCounts
                  .map((stage) => `${stage.label}: ${stage.count}`)
                  .join("; ")}
              >
                {stageCounts.map((stage, index) => (
                  <div className="pipeline-chart-column" key={stage.id}>
                    <span className="chart-value">{stage.count}</span>
                    <div className="chart-track">
                      <div
                        className={`chart-bar ${stage.className}`}
                        style={{
                          height: stage.count
                            ? `${Math.max(12, (stage.count / maxCount) * 100)}%`
                            : "3px",
                        }}
                      />
                    </div>
                    <span className="chart-step">0{index + 1}</span>
                    <span className="chart-label">{stage.label}</span>
                  </div>
                ))}
              </div>
              <div className="pipeline-footer">
                <span>
                  <span className="legend-dot" />
                  {deals.length} заявок в сопровождении
                </span>
                <span>
                  <GraduationCap size={16} />
                  {enrolled} зачислены
                </span>
              </div>
            </>
          )}
        </section>
        <section className="surface consultations-summary">
          <div className="section-heading">
            <div>
              <h2>Ближайшие консультации</h2>
              <p>Время для следующего важного шага</p>
            </div>
            <Link
              href="/dashboard/bookings"
              className="icon-button"
              aria-label="Все консультации"
            >
              <ArrowUpRight size={18} />
            </Link>
          </div>
          {loading ? (
            <div className="chart-loading" role="status">
              Загружаем расписание…
            </div>
          ) : failed.includes("консультации") ? (
            <EmptyState
              icon={AlertCircle}
              title="Расписание недоступно"
              description="Обновите данные и попробуйте ещё раз."
            />
          ) : upcoming.length ? (
            <div className="upcoming-list">
              {upcoming.map((booking, index) => (
                <Link
                  href="/dashboard/bookings"
                  className="upcoming-item"
                  key={booking.id}
                >
                  <div className="booking-time">
                    <strong>
                      {new Date(booking.scheduled_at).toLocaleTimeString(
                        "ru-RU",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </strong>
                    <span>
                      {new Date(booking.scheduled_at).toLocaleDateString(
                        "ru-RU",
                        { day: "numeric", month: "short" },
                      )}
                    </span>
                  </div>
                  <div className="upcoming-content">
                    <strong>
                      {booking.customer_name ||
                        `Контакт #${booking.customer_id}`}
                    </strong>
                    <span>{booking.service_name_snapshot}</span>
                    <small>
                      <Clock3 size={12} />
                      {booking.duration_minutes} мин{" "}
                      <span
                        className={`status-tag ${booking.status === "confirmed" ? "status-success" : "status-warning"}`}
                      >
                        {booking.status === "confirmed"
                          ? "Подтверждена"
                          : "Ожидает"}
                      </span>
                    </small>
                  </div>
                  <Avatar name={booking.customer_name || "К"} tone={index} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Впереди свободное время"
              description="Новые записи студентов появятся здесь, как только будет назначена консультация."
            />
          )}
          <Link href="/dashboard/bookings" className="card-footer-link">
            Открыть расписание <ArrowRight size={15} />
          </Link>
        </section>
        <section className="surface recent-conversations">
          <div className="section-heading">
            <div>
              <h2>Последние диалоги</h2>
              <p>Оставайтесь на связи со студентами</p>
            </div>
            <SectionLink href="/dashboard/conversations">
              Все входящие
            </SectionLink>
          </div>
          {loading ? (
            <div className="chart-loading" role="status">
              Загружаем диалоги…
            </div>
          ) : failed.includes("диалоги") ? (
            <EmptyState
              icon={AlertCircle}
              title="Диалоги недоступны"
              description="Обновите данные, чтобы загрузить сообщения."
            />
          ) : recent.length ? (
            <div className="recent-list">
              {recent.map((conversation, index) => {
                const name =
                  conversation.customer?.name ||
                  conversation.customer?.username ||
                  `Контакт #${conversation.customer_id}`;
                return (
                  <Link
                    className="recent-item"
                    href={`/dashboard/conversations?customer_id=${conversation.customer_id}`}
                    key={conversation.id}
                  >
                    <Avatar name={name} tone={index} />
                    <div className="recent-person">
                      <strong>{name}</strong>
                      <span>
                        {conversation.last_message_preview ||
                          "Открыть переписку"}
                      </span>
                    </div>
                    <span className="recent-channel">
                      {conversation.channel === "whatsapp" ? (
                        <WhatsAppIcon className="w-4 h-4" />
                      ) : (
                        <InstagramIcon className="w-4 h-4" />
                      )}
                      <span>
                        {conversation.channel === "whatsapp"
                          ? "WhatsApp"
                          : "Instagram"}
                      </span>
                    </span>
                    <span
                      className={`status-tag ${conversation.mode === "ai" ? "status-brand" : ""}`}
                    >
                      {conversation.mode === "ai" ? (
                        <Bot size={13} />
                      ) : (
                        <Users size={13} />
                      )}
                      {conversation.mode === "ai"
                        ? "AI-ассистент"
                        : conversation.mode === "paused"
                          ? "Пауза"
                          : "Консультант"}
                    </span>
                    {conversation.unread_count > 0 ? (
                      <span className="unread-badge">
                        {conversation.unread_count}
                      </span>
                    ) : (
                      <ChevronRight size={16} className="row-chevron" />
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Inbox}
              title="Здесь начнутся новые истории"
              description="Сообщения из Instagram и WhatsApp появятся в едином inbox."
            />
          )}
        </section>
        <section className="surface focus-card">
          <span className="focus-eyebrow">
            <FileCheck2 size={17} /> ФОКУС КОМАНДЫ
          </span>
          <h2>
            Ни один запрос
            <br />
            не останется без ответа.
          </h2>
          <p>
            Начните с непрочитанных сообщений и записей, которые ждут вашего
            подтверждения.
          </p>
          <div className="focus-counts">
            <Link href="/dashboard/conversations">
              <span>Непрочитанные</span>
              <strong>
                {metric(stats?.unread_messages)}
                <ArrowUpRight size={15} />
              </strong>
            </Link>
            <Link href="/dashboard/bookings">
              <span>Ждут подтверждения</span>
              <strong>
                {metric(stats?.pending_bookings)}
                <ArrowUpRight size={15} />
              </strong>
            </Link>
          </div>
          <Link
            href="/dashboard/conversations"
            className="button button-primary"
          >
            Разобрать входящие <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <footer className="overview-footer">
        <span>Consulteam · Больше возможностей для каждого студента</span>
        <span>
          {loading
            ? "Обновление…"
            : updated
              ? `Обновлено в ${updated.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
        </span>
      </footer>
    </div>
  );
}
