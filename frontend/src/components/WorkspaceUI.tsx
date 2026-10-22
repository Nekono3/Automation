import Image from "next/image";
import { AlertCircle, ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Image
          src="/consulteam-brand.jpg"
          alt=""
          width={48}
          height={48}
          priority
        />
      </span>
      {!compact && (
        <span>
          <strong>
            consulteam<span className="brand-period">.</span>
          </strong>
          <small>EDUCATION WORKSPACE</small>
        </span>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={24} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="section-link">
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
    </Link>
  );
}

export function Avatar({ name, tone = 0 }: { name: string; tone?: number }) {
  return (
    <span
      className={`person-avatar avatar-tone-${tone % 4}`}
      aria-hidden="true"
    >
      {name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}

export function DataError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="data-error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{message}</span>
      <button onClick={onRetry}>Повторить</button>
    </div>
  );
}
