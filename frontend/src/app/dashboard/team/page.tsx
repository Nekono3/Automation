"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, EmptyState, DataError } from '@/components/WorkspaceUI';
import { CompanyModal, Field, Loading, Notice } from '@/components/CompanyUI';
import { Directory, KPIResult, Metric, ManagerReport, json, query, today, roleNames, errorText } from '@/lib/company';

export default function TeamPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'lead_manager';
  const [directory, setDirectory] = useState<Directory>({ users: [], categories: [], countries: [] });
  const [metrics, setMetrics] = useState<Metric[]>([]); const [results, setResults] = useState<KPIResult[]>([]);
  const [managers, setManagers] = useState<ManagerReport[]>([]);
  const [period, setPeriod] = useState(today().slice(0,7)); const [employee, setEmployee] = useState('');
  const [department, setDepartment] = useState(''); const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<'metric' | 'result' | KPIResult | null>(null); const [formError, setFormError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const first = `${period}-01`; const [year, month] = period.split('-').map(Number);
      const last = `${period}-${new Date(year, month, 0).getDate()}`;
      const [dir, definitions, values, activity] = await Promise.all([
        api.company<Directory>('/directory'), api.company<Metric[]>('/kpi/metrics'),
        api.company<KPIResult[]>(`/kpi/results?${query({period:first,user_id:employee})}`),
        canManage ? api.company<ManagerReport[]>(`/managers?${query({start:first,end:last})}`) : Promise.resolve([]),
      ]);
      setDirectory(dir); setMetrics(definitions); setResults(values); setManagers(activity);
    } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  },[period,employee,canManage]);
  useEffect(() => { if (!period) return; const timer = setTimeout(() => void load(),0); return () => clearTimeout(timer); },[period,load]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError('');
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (modal === 'metric') await api.company('/kpi/metrics',json(form));
      else await api.company('/kpi/results',json({...form,user_id:Number(form.user_id),metric_id:Number(form.metric_id),period: `${form.period}-01`},'PUT'));
      setModal(null); await load();
    } catch(e) { setFormError(errorText(e)); } finally { setSaving(false); }
  }
  const filtered = results.filter(r => !department || metrics.find(m => m.id === r.metric_id)?.department === department);
  const selected = modal && typeof modal === 'object' ? modal : null;
  return <div className="company-stack">
    <PageHeader eyebrow="КОМАНДА" title="Сотрудники и KPI" description="Индивидуальные цели по должностям и отделам. Результаты и активность за выбранный месяц."><Link className="company-button" href="/dashboard/kpi">Архив KPI продавцов</Link>{canManage && <><button className="company-button" onClick={() => { setFormError(''); setModal('metric'); }}>Новый показатель</button><button className="company-button primary" onClick={() => { setFormError(''); setModal('result'); }}><Plus size={16} aria-hidden="true" />Задать план / факт</button></>}</PageHeader>
    <div className="company-toolbar">
      <Field label="Месяц"><input type="month" value={period} required onChange={e => setPeriod(e.target.value)} /></Field>
      {canManage && <Field label="Сотрудник"><select value={employee} onChange={e => setEmployee(e.target.value)}><option value="">Все сотрудники</option>{directory.users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>}
      <Field label="Отдел"><select value={department} onChange={e => setDepartment(e.target.value)}><option value="">Все отделы</option>{[...new Set(metrics.map(m => m.department))].map(d => <option key={d}>{d}</option>)}</select></Field>
    </div>
    {error && <DataError message={error} onRetry={load} />}{loading ? <Loading /> : !error && <>
      {filtered.length === 0 ? <EmptyState icon={Target} title="Планы на месяц не заданы" description="Добавьте показатель для отдела или должности, затем установите персональный план сотруднику." /> : <div className="company-table-wrap"><table className="company-table mobile-cards"><thead><tr><th>Сотрудник</th><th>Показатель</th><th>План</th><th>Факт</th><th>Выполнение</th>{canManage && <th>Действие</th>}</tr></thead><tbody>{filtered.map(row => {
        const metric = metrics.find(m => m.id === row.metric_id);
        const target = Number(row.target); const actual = Number(row.actual);
        const percent = metric?.direction === 'lower' ? (actual === 0 ? 100 : Math.min(100,target / actual * 100)) : actual / target * 100;
        return <tr key={row.id}><td data-label="Сотрудник"><span><strong>{directory.users.find(u => u.id === row.user_id)?.full_name || `#${row.user_id}`}</strong><small>{roleNames[directory.users.find(u => u.id === row.user_id)?.role || '']}</small></span></td><td data-label="Показатель"><span>{metric?.name}<small>{metric?.department}{metric?.position && ` · ${metric.position}`}{metric?.direction === 'lower' ? ' · меньше — лучше' : ''}</small></span></td><td data-label="План">{row.target} {metric?.unit}</td><td data-label="Факт"><span>{row.actual} {metric?.unit}{row.notes && <small>{row.notes}</small>}</span></td><td data-label="Выполнение"><span>{percent.toFixed(0)}% <progress className="company-progress" value={Math.min(100,percent)} max={100} aria-label={`Выполнение ${metric?.name}: ${percent.toFixed(0)}%`} /></span></td>{canManage && <td data-label="Действие"><button className="company-button" onClick={() => { setFormError(''); setModal(row); }}>Изменить</button></td>}</tr>;
      })}</tbody></table></div>}
      {metrics.length > 0 && <details className="company-card"><summary>Справочник показателей · {metrics.length}</summary><div className="company-table-wrap"><table className="company-table"><thead><tr><th>Показатель</th><th>Отдел / должность</th><th>Единица</th><th>Цель</th></tr></thead><tbody>{metrics.map(m => <tr key={m.id}><td>{m.name}</td><td>{m.department} / {m.position || 'Все должности'}</td><td>{m.unit}</td><td>{m.direction === 'lower' ? 'Снижать' : 'Увеличивать'}</td></tr>)}</tbody></table></div></details>}
      {canManage && <section className="company-stack"><h2>Работа менеджеров</h2><p className="company-muted">Лиды — созданные в выбранном месяце. Сообщения — за месяц по закреплённому WhatsApp-аккаунту; открытые диалоги и непрочитанные — текущее состояние. При общем номере показатели аккаунта совпадают.</p>
        <div className="company-table-wrap"><table className="company-table mobile-cards"><thead><tr><th>Сотрудник</th><th>Лиды / клиенты</th><th>Диалоги / открытые</th><th>Входящие / исходящие</th><th>Ответы менеджера / AI</th><th>Непрочитано</th></tr></thead><tbody>{managers.filter(m => !employee || m.id === Number(employee)).map(m => <tr key={m.id}><td data-label="Сотрудник"><span><strong>{m.name}</strong><small>{roleNames[m.role]}{m.whatsapp_account_id ? ` · WA #${m.whatsapp_account_id}` : ' · без WA'}</small></span></td><td data-label="Лиды / клиенты">{Object.values(m.leads).reduce((a,b) => a+b,0)} / {m.leads.won || 0}</td><td data-label="Диалоги / открытые">{m.whatsapp.conversations || 0} / {m.whatsapp.open_conversations || 0}</td><td data-label="Вход / исход">{m.whatsapp.inbound || 0} / {m.whatsapp.outbound || 0}</td><td data-label="Менеджер / AI">{m.whatsapp.employee_replies || 0} / {m.whatsapp.ai_replies || 0}</td><td data-label="Непрочитано">{m.whatsapp.unread_messages || 0}{m.whatsapp_account_id && <small><Link href={`/dashboard/conversations?whatsapp_account_id=${m.whatsapp_account_id}`}>Открыть переписки</Link></small>}</td></tr>)}</tbody></table></div>
      </section>}
    </>}
    {modal && <CompanyModal title={modal === 'metric' ? 'Новый показатель KPI' : 'Персональный план и результат'} close={() => { if (!saving) setModal(null); }}><form className="company-form" onSubmit={save}>
      {modal === 'metric' ? <><div className="full"><Field label="Название показателя"><input name="name" maxLength={128} required /></Field></div><Field label="Отдел"><input name="department" defaultValue="Продажи" maxLength={128} required /></Field><Field label="Должность"><input name="position" maxLength={128} /></Field><Field label="Единица измерения"><input name="unit" defaultValue="шт." maxLength={32} required /></Field><Field label="Направление цели"><select name="direction"><option value="higher">Больше — лучше</option><option value="lower">Меньше — лучше</option></select></Field></> : <>
        <Field label="Сотрудник"><select name="user_id" defaultValue={selected?.user_id || employee || ''} required><option value="" disabled>Выберите сотрудника</option>{directory.users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>
        <Field label="Показатель"><select name="metric_id" defaultValue={selected?.metric_id || ''} required><option value="" disabled>Выберите показатель</option>{metrics.map(m => <option key={m.id} value={m.id}>{m.department} · {m.name}</option>)}</select></Field>
        <Field label="Месяц"><input type="month" name="period" defaultValue={selected?.period.slice(0,7) || period} required /></Field>
        <Field label="План"><input type="number" name="target" defaultValue={selected?.target} min="0.01" step="0.01" required /></Field>
        <Field label="Факт"><input type="number" name="actual" defaultValue={selected?.actual || '0'} min="0" step="0.01" required /></Field>
        <div className="full"><Field label="Комментарий"><textarea name="notes" maxLength={5000} defaultValue={selected?.notes} /></Field></div>
      </>}
      {formError && <div className="full"><Notice error>{formError}</Notice></div>}<footer><button className="company-button primary" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button></footer>
    </form></CompanyModal>}
  </div>;
}
