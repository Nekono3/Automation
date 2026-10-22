"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  GraduationCap,
  MessageCircle,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/WorkspaceUI";
import { InstagramIcon, WhatsAppIcon } from "@/components/ChannelIcons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, authLoading, router]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.login(email, password);
      login(response.access_token, response.user);
    } catch {
      setError(
        "Не удалось войти. Проверьте почту и пароль и попробуйте ещё раз.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section
        className="login-story"
        aria-label="Consulteam — образование за рубежом"
      >
        <Brand />
        <div className="login-story-content">
          <span className="login-eyebrow">
            <span /> CONSULTEAM WORKSPACE
          </span>
          <h1>
            Большое будущее
            <br />
            начинается
            <br />с одного диалога<span>.</span>
          </h1>
          <p>
            Помогайте студентам поступать в университеты мечты. Мы соберём
            диалоги, документы и консультации в одном пространстве.
          </p>
          <div className="admission-journey">
            <div className="journey-step">
              <span>
                <MessageCircle size={20} />
              </span>
              <div>
                <small>01 / ЗНАКОМСТВО</small>
                <strong>Первое сообщение</strong>
              </div>
              <InstagramIcon className="w-5 h-5" />
              <WhatsAppIcon className="w-5 h-5" />
            </div>
            <div className="journey-connector" />
            <div className="journey-step">
              <span>
                <FileCheck2 size={20} />
              </span>
              <div>
                <small>02 / СОПРОВОЖДЕНИЕ</small>
                <strong>Заявка в университет</strong>
              </div>
            </div>
            <div className="journey-connector" />
            <div className="journey-step journey-finish">
              <span>
                <GraduationCap size={22} />
              </span>
              <div>
                <small>03 / НОВАЯ ГЛАВА</small>
                <strong>Вы поступили!</strong>
              </div>
              <ArrowRight size={19} />
            </div>
          </div>
        </div>
        <div className="login-story-footer">
          <span>Люди. Возможности. Образование.</span>
          <span>consulteam.</span>
        </div>
      </section>
      <main className="login-form-side">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-form-wrap">
          <span className="eyebrow">РАДЫ ВАС ВИДЕТЬ</span>
          <h2>С возвращением</h2>
          <p className="login-subtitle">
            Войдите в рабочее пространство команды.
          </p>
          <form onSubmit={handleLogin}>
            <label htmlFor="email">Рабочая почта</label>
            <div className="login-input">
              <Mail size={18} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="name@consulteam.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <label htmlFor="password">Пароль</label>
            <div className="login-input">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Введите ваш пароль"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                aria-describedby={error ? "login-error" : undefined}
                aria-invalid={!!error}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <p id="login-error" className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="button button-primary login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner" /> Входим…
                </>
              ) : (
                <>
                  Войти в пространство <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <div className="login-help">
            <ShieldCheck size={17} />
            <p>
              Доступ только для команды Consulteam.
              <br />
              Нет аккаунта? Обратитесь к администратору.
            </p>
          </div>
        </div>
        <footer className="login-footer">
          Consulteam CRM <span>Создаём возможности вместе.</span>
        </footer>
      </main>
    </div>
  );
}
