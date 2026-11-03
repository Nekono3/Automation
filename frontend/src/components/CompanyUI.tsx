"use client";
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function CompanyModal({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="company-modal" aria-labelledby="company-modal-title" onCancel={close}>
    <header><h2 id="company-modal-title">{title}</h2><button type="button" className="icon-button" onClick={close} aria-label="Закрыть"><X size={20} /></button></header>
    {children}
  </dialog>;
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="company-field"><span>{label}</span>{children}</label>;
}
export function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <p className={error ? 'company-notice is-error' : 'company-notice'} role={error ? 'alert' : 'status'}>{children}</p>;
}
export function Loading() { return <p className="company-loading" role="status">Загрузка данных…</p>; }
