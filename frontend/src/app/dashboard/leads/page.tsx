"use client";
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, EmptyState, DataError } from '@/components/WorkspaceUI';
import { CompanyModal, Field, Loading, Notice } from '@/components/CompanyUI';
import { Directory, LeadRow, Page, json, query, statusNames, errorText } from '@/lib/company';

export default function LeadsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const management = user?.role === 'admin' || user?.role === 'lead_manager';
  const [directory, setDirectory] = useState<Directory>({ users: [], categories: [], countries: [] });
  const [data, setData] = useState<Page<LeadRow>>({ total: 0, items: [] });
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const [category, setCategory] = useState(''); const [assigned, setAssigned] = useState('');
  const [offset, setOffset] = useState(0); const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<LeadRow | 'new' | null>(null);
  const [enrolling, setEnrolling] = useState<LeadRow | null>(null); const [formError, setFormError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [dir, rows] = await Promise.all([api.company<Directory>('/directory'), api.company<Page<LeadRow>>(`/leads?${query({ search, status, category, assigned_user_id: assigned, skip: offset })}`)]); setDirectory(dir); setData(rows); }
    catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }, [search,status,category,assigned,offset]);
  useEffect(() => { const timer = setTimeout(() => void load(),250); return () => clearTimeout(timer); },[load]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError('');
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (enrolling) {
        const result = await api.company<{student_id:number}>(`/leads/${enrolling.customer.id}/enroll?${query({country:String(form.country)})}`, json({}));
        router.push(`/dashboard/students/${result.student_id}`); setEnrolling(null);
      } else {
        const payload = { ...form, assigned_user_id: management ? (form.assigned_user_id ? Number(form.assigned_user_id) : null) : user?.id };
        await api.company(editing === 'new' ? '/leads' : `/leads/${(editing as LeadRow).customer.id}`, json(payload,editing === 'new' ? 'POST' : 'PUT'));
        setEditing(null); await load();
      }
    } catch (e) { setFormError(errorText(e)); } finally { setSaving(false); }
  }
  const selected = editing && editing !== 'new' ? editing : null;
  return <div className="company-stack">
    <PageHeader eyebrow="ПРОДАЖИ" title="База лидов" description="Контакты из переписок и ручные заявки: категории, ответственные и этапы работы."><Link className="company-button" href="/dashboard/customers">Контакты и переписки</Link><button className="company-button primary" onClick={() => { setFormError(''); setEditing('new'); }}><Plus size={16} aria-hidden="true" />Добавить лид</button></PageHeader>
    <div className="company-toolbar">
      <Field label="Поиск"><input value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }} placeholder="Имя, телефон, email" /></Field>
      <Field label="Статус"><select value={status} onChange={e => { setStatus(e.target.value); setOffset(0); }}><option value="">Все статусы</option>{Object.entries(statusNames).map(([key,name]) => <option key={key} value={key}>{name}</option>)}</select></Field>
      <Field label="Категория"><input value={category} onChange={e => { setCategory(e.target.value); setOffset(0); }} placeholder="Точное название" /></Field>
      {management && <Field label="Ответственный"><select value={assigned} onChange={e => { setAssigned(e.target.value); setOffset(0); }}><option value="">Все сотрудники</option>{directory.users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>}
    </div>
    {error && <DataError message={error} onRetry={load} />}
    {loading ? <Loading /> : !error && (data.items.length === 0 ? <EmptyState icon={Users} title="Лиды не найдены" description={management ? 'Измените фильтры или добавьте первый лид.' : 'Здесь появятся лиды, закреплённые за вами.'} /> : <>
      <p className="company-muted">Найдено: {data.total}</p><div className="company-table-wrap"><table className="company-table mobile-cards"><thead><tr><th>Контакт</th><th>Категория / статус</th><th>Ответственный</th><th>Следующее действие</th><th>Управление</th></tr></thead><tbody>{data.items.map(row => <tr key={row.customer.id}>
        <td data-label="Контакт"><span><strong>{row.customer.name || `Контакт #${row.customer.id}`}</strong><small>{row.customer.phone || row.customer.email || 'Нет контактов'}</small></span></td>
        <td data-label="Этап"><span>{statusNames[row.lead.status]}<small>{row.lead.category}</small></span></td>
        <td data-label="Ответственный">{directory.users.find(u => u.id === row.lead.assigned_user_id)?.full_name || 'Не назначен'}</td>
        <td data-label="Следующий шаг">{row.lead.next_action || '—'}</td>
        <td data-label="Управление"><div className="company-toolbar"><button className="company-button" onClick={() => { setFormError(''); setEditing(row); }}>Изменить</button><button className="company-button" onClick={() => { setFormError(''); setEnrolling(row); }}>В ученики</button></div></td>
      </tr>)}</tbody></table></div>
      <div className="company-pager"><button className="company-button" disabled={offset===0} onClick={() => setOffset(offset-100)}>Назад</button><span>{offset+1}–{Math.min(offset+100,data.total)} из {data.total}</span><button className="company-button" disabled={offset+100>=data.total} onClick={() => setOffset(offset+100)}>Далее</button></div>
    </>)}
    {(editing || enrolling) && <CompanyModal title={enrolling ? 'Создать карточку ученика' : editing === 'new' ? 'Новый лид' : 'Работа с лидом'} close={() => { if (!saving) { setEditing(null); setEnrolling(null); } }}><form className="company-form" onSubmit={save}>
      {enrolling ? <div className="full"><Notice>{enrolling.customer.name || `Контакт #${enrolling.customer.id}`} будет связан с карточкой ученика. Повторное действие откроет существующую карточку.</Notice><Field label="Страна поступления"><input name="country" required maxLength={128} list="lead-countries" /><datalist id="lead-countries">{directory.countries.map(c => <option key={c}>{c}</option>)}</datalist></Field></div> : <>
        {editing === 'new' && <><div className="full"><Field label="Имя"><input name="name" required maxLength={255} /></Field></div><Field label="Телефон"><input name="phone" type="tel" maxLength={64} /></Field><Field label="Email"><input name="email" type="email" maxLength={255} /></Field></>}
        <Field label="Категория"><input name="category" defaultValue={selected?.lead.category || 'Без категории'} maxLength={128} required /></Field>
        <Field label="Статус"><select name="status" defaultValue={selected?.lead.status || 'new'}>{Object.entries(statusNames).map(([key,name]) => <option key={key} value={key}>{name}</option>)}</select></Field>
        {management && <div className="full"><Field label="Ответственный"><select name="assigned_user_id" defaultValue={selected?.lead.assigned_user_id || ''}><option value="">Не назначен</option>{directory.users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field></div>}
        <div className="full"><Field label="Следующее действие"><textarea name="next_action" defaultValue={selected?.lead.next_action} maxLength={500} /></Field></div>
      </>}
      {formError && <div className="full"><Notice error>{formError}</Notice></div>}<footer><button className="company-button primary" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button></footer>
    </form></CompanyModal>}
  </div>;
}
