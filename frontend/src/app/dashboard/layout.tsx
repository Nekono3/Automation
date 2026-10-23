"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Inbox,
  Users,
  CalendarDays,
  LayoutDashboard,
  GraduationCap,
  Zap,
  School,
  LogOut,
  ChevronRight,
  Menu,
  X,
  ChevronsUpDown,
} from "lucide-react";
import Link from "next/link";
import { Avatar, Brand } from "@/components/WorkspaceUI";
import { InstagramIcon, WhatsAppIcon } from "@/components/ChannelIcons";

const navigation = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Обзор" },
  { href: "/dashboard/conversations", icon: Inbox, label: "Входящие" },
  { href: "/dashboard/customers", icon: Users, label: "Студенты и контакты" },
  { href: "/dashboard/pipeline", icon: GraduationCap, label: "Поступления" },
  { href: "/dashboard/programs", icon: School, label: "Университеты" },
  { href: "/dashboard/bookings", icon: CalendarDays, label: "Консультации" },
  { href: "/dashboard/automations", icon: Zap, label: "Автоматизации" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, loading, logout, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const current = navigation.find((item) => item.href === pathname);
  const operator = user?.email?.split("@")[0] || "Оператор";

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/");
  }, [loading, isAuthenticated, router]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setUserMenu(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = menuButton.current;
    closeButton.current?.focus();
    return () => trigger?.focus();
  }, [mobileOpen]);

  if (loading || !isAuthenticated)
    return (
      <div className="workspace-loading" role="status">
        <Brand />
        <span className="loading-spinner" />
        <p>Открываем рабочее пространство…</p>
      </div>
    );

  return (
    <div className="workspace-shell">
      <a href="#workspace-content" className="skip-link">
        Перейти к содержимому
      </a>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Закрыть навигацию"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`workspace-sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Рабочее пространство"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
      >
        <div className="sidebar-brand">
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            aria-label="Consulteam — обзор"
          >
            <Brand />
          </Link>
          <button
            className="mobile-close icon-button"
            ref={closeButton}
            aria-label="Закрыть навигацию"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-switcher-icon">
            <GraduationCap size={19} />
          </span>
          <div>
            <strong>Образование за рубежом</strong>
            <span>Рабочее пространство</span>
          </div>
        </div>
        <p className="nav-label">УПРАВЛЕНИЕ</p>
        <nav className="workspace-nav" aria-label="Основная навигация">
          {navigation.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={pathname === href ? "active" : ""}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
              {pathname === href && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-mission">
            <span className="mission-icon">
              <GraduationCap size={23} />
            </span>
            <strong>
              От первого сообщения
              <br />
              до письма о зачислении.
            </strong>
            <p>Весь путь студента — в одном месте.</p>
            <Link
              href="/dashboard/pipeline"
              onClick={() => setMobileOpen(false)}
            >
              Открыть поступления <ChevronRight size={15} />
            </Link>
          </div>
          <div className="sidebar-profile">
            <Avatar name={operator} />
            <div>
              <strong>{operator}</strong>
              <span>
                {user?.is_superuser ? "Администратор" : "Консультант"}
              </span>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Выйти из аккаунта"
              title="Выйти из аккаунта"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-body" inert={mobileOpen}>
        <header className="workspace-topbar">
          <div className="topbar-breadcrumb">
            <button
              className="mobile-menu icon-button"
              ref={menuButton}
              aria-label="Открыть навигацию"
              aria-expanded={mobileOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">Рабочее пространство</span>
            <ChevronRight size={14} aria-hidden="true" />
            <strong>{current?.label || "Consulteam"}</strong>
          </div>
          <div className="topbar-right">
            <div className="topbar-channels" aria-label="Каналы общения">
              <InstagramIcon className="w-4 h-4" />
              <WhatsAppIcon className="w-4 h-4" />
              <span>Единый inbox</span>
            </div>
            <div className="topbar-profile">
              <button
                className="profile-trigger"
                onClick={() => setUserMenu(!userMenu)}
                aria-expanded={userMenu}
                aria-label="Меню аккаунта"
              >
                <Avatar name={operator} />
                <ChevronsUpDown size={14} />
              </button>
              {userMenu && (
                <div className="profile-menu">
                  <p>{user?.email}</p>
                  <button onClick={logout}>
                    <LogOut size={16} /> Выйти из аккаунта
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main
          id="workspace-content"
          className="workspace-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
