"use client";
import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {can} from '@/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, DataError, EmptyState } from '@/components/WorkspaceUI';
import { CompanyModal, Field, Notice, Loading } from '@/components/CompanyUI';
import { Directory, Transaction, Page, Report, json, query, today, money, errorText } from '@/lib/company';

export default function FinancePage() { return <Suspense fallback={<Loading />}><Finance /></Suspense>; }
function Finance() {
  const { user } = useAuth();
  const params = useSearchParams();
  const studentId = params.get('student_id') || '';
  const canManage = can(user,'finance.read');
  const [directory, setDirectory] = useState<Directory>({ users: [], categories: [], countries: [] });
  const [students, setStudents] = useState<{ id: number; full_name: string }[]>([]);
  const [data, setData] = useState<Page<Transaction>>({ total: 0, items: [] });
  const [report, setReport] = useState<Report | null>(null);
  const [start, setStart] = useState(today().slice(0,7) + '-01');
  const [end, setEnd] = useState(today());
  const [currency, setCurrency] = useState('');
  const [category, setCategory] = useState('');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'transaction' | 'category' | null>(null);
  const [voiding, setVoiding] = useState<Transaction | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showVoided, setShowVoided] = useState(false);
  const [grouping, setGrouping] = useState('months');
  const load = useCallback(async () => {
    if (!canManage) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const filter = query({ start, end, currency, category_id: category, student_id: studentId });
      const [dir, rows, totals] = await Promise.all([
        api.company<Directory>('/directory'), api.company<Page<Transaction>>(`/finance/transactions?${filter}&skip=${offset}&include_voided=${showVoided}`),
        api.company<Report>(`/finance/report?${filter}`),
      ]);
      setDirectory(dir); setData(rows); setReport(totals);
    } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }, [canManage, start, end, currency, category, studentId, offset, showVoided]);
  useEffect(() => { const timer = setTimeout(() => void load(),0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { if (canManage) api.company<{id:number;full_name:string}[]>('/finance/students').then(setStudents).catch(() => {}); }, [canManage]);
  const open = (value: 'transaction' | 'category') => { setFormError(''); setModal(value); };
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError('');
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    try {
      if (voiding) { await api.company(`/finance/transactions/${voiding.id}/void`, json({ reason: values.reason })); setVoiding(null); }
      else if (modal === 'category') { await api.company('/finance/categories', json({ name: values.name })); setModal(null); }
      else {
        await api.company('/finance/transactions', json({ ...values, category_id: Number(values.category_id), student_id: values.student_id ? Number(values.student_id) : null,
          commission_percent: values.commission_percent || null })); setModal(null);
      }
      await load();
    } catch (e) { setFormError(errorText(e)); } finally { setSaving(false); }
  }
  if (!canManage) return <Notice>Для финансового модуля требуется разрешение директора.</Notice>;
  return <div className="company-page company-stack">
    <PageHeader eyebrow="УПРАВЛЕНИЕ КОМПАНИЕЙ" title="Финансы" description="Доходы, расходы и прибыль. Каждая валюта учитывается отдельно.">
      <button className="company-button" onClick={() => open('category')}>Категория</button>
      <button className="company-button primary" onClick={() => open('transaction')}><Plus size={16} aria-hidden="true" />Новая операция</button>
    </PageHeader>
    {studentId && <Notice>Операции ученика #{studentId}. <Link href={`/dashboard/students/${studentId}`}>Открыть карточку</Link> · <Link href="/dashboard/finance">Все операции</Link></Notice>}
    <div className="company-toolbar">
      <Field label="Начало периода"><input type="date" value={start} onChange={e => { setStart(e.target.value); setOffset(0); }} /></Field>
      <Field label="Конец периода"><input type="date" value={end} min={start} onChange={e => { setEnd(e.target.value); setOffset(0); }} /></Field>
      <Field label="Валюта"><select value={currency} onChange={e => { setCurrency(e.target.value); setOffset(0); }}><option value="">Все валюты</option>{['KGS','USD','EUR','TRY','CNY','GBP'].map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Категория"><select value={category} onChange={e => { setCategory(e.target.value); setOffset(0); }}><option value="">Все категории</option>{directory.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <button className="company-button" onClick={() => { setStart(today().slice(0,4)+'-01-01'); setEnd(today().slice(0,4)+'-12-31'); setOffset(0); }}>Весь год</button>
    </div>
    {error && <DataError message={error} onRetry={load} />}
    {loading ? <Loading /> : !error && <>
      {report?.totals.map(total => <div key={total.currency} className="company-metrics">
        <div className="company-card"><h2><ArrowDownLeft size={15} aria-hidden="true" /> Доход · {total.currency}</h2><strong>{money(total.income,total.currency)}</strong></div>
        <div className="company-card"><h2><ArrowUpRight size={15} aria-hidden="true" /> Расход · {total.currency}</h2><strong>{money(total.expense,total.currency)}</strong></div>
        <div className="company-card"><h2>{Number(total.profit) < 0 ? 'Убыток' : 'Прибыль'} · {total.currency}</h2><strong>{money(total.profit,total.currency)}</strong></div>
      </div>)}
      {report && report.totals.length > 0 && <div className="company-grid">
        <section className="company-card"><h2>Прибыль по категориям</h2>{report.categories.map(row => <div className="company-doc" key={`${row.currency}-${row.category_id}`}><span>{directory.categories.find(c => c.id === row.category_id)?.name}<small className="company-muted"> · доход {money(row.income,row.currency)} / расход {money(row.expense,row.currency)}</small></span><strong>{money(row.profit,row.currency)}</strong></div>)}</section>
        <section className="company-card"><h2>Динамика за период</h2><Field label="Группировка"><select value={grouping} onChange={e => setGrouping(e.target.value)}><option value="months">По месяцам</option><option value="years">По годам</option></select></Field>{(grouping === 'months' ? report.months : report.years).map((row) => <div className="company-doc" key={`${row.currency}-${'month' in row ? row.month : row.year}`}><span>{'month' in row ? row.month : row.year}<small className="company-muted"> · доход {money(row.income,row.currency)} / расход {money(row.expense,row.currency)}</small></span><strong>{money(row.profit,row.currency)}</strong></div>)}</section>
      </div>}
      <div className="company-toolbar"><h2>Журнал операций · {data.total}</h2><label className="company-button"><input type="checkbox" checked={showVoided} onChange={e => { setShowVoided(e.target.checked); setOffset(0); }} /> Показывать аннулированные</label></div>
      {data.items.length === 0 ? <EmptyState icon={Wallet} title="Операций за период нет" description="Добавьте поступление или расход. Импортированные суммы учеников не включаются автоматически в журнал." /> : <div className="company-table-wrap"><table className="company-table mobile-cards"><thead><tr><th>Дата / категория</th><th>Сумма</th><th>Ученик / этап</th><th>Назначение</th><th>Действие</th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}>
        <td data-label="Дата"><strong>{row.occurred_on}</strong><small>{directory.categories.find(c => c.id === row.category_id)?.name}</small></td>
        <td data-label="Сумма"><span>{row.kind === 'income' ? '+' : '−'}{money(row.amount,row.currency)}{row.voided_at && <small>Аннулировано: {row.void_reason}</small>}</span></td>
        <td data-label="Ученик"><span>{row.student_id ? <Link href={`/dashboard/students/${row.student_id}`}>{students.find(s => s.id === row.student_id)?.full_name || `#${row.student_id}`}</Link> : '—'}<small>{row.stage}</small></span></td>
        <td data-label="Назначение"><span>{row.description || '—'}{row.recipient && <small>{row.recipient}{row.commission_percent != null ? ` · ${row.commission_percent}%` : ''}</small>}</span></td>
        <td data-label="Действие">{!row.voided_at && <button className="company-button" onClick={() => { setFormError(''); setVoiding(row); }}>Аннулировать</button>}</td>
      </tr>)}</tbody></table></div>}
      {data.total > 100 && <div className="company-pager"><button className="company-button" disabled={offset===0} onClick={() => setOffset(offset-100)}>Назад</button><span>{offset+1}–{Math.min(offset+100,data.total)} из {data.total}</span><button className="company-button" disabled={offset+100>=data.total} onClick={() => setOffset(offset+100)}>Далее</button></div>}
    </>}
    {(modal || voiding) && <CompanyModal title={voiding ? 'Аннулировать операцию' : modal === 'category' ? 'Новая категория' : 'Новая операция'} close={() => { if (!saving) { setModal(null); setVoiding(null); } }}><form className="company-form" onSubmit={save}>
      {voiding ? <div className="full"><Notice>Операция {money(voiding.amount,voiding.currency)} останется в истории, но будет исключена из расчётов.</Notice><Field label="Причина"><textarea name="reason" required minLength={3} maxLength={1000} /></Field></div> : modal === 'category' ? <div className="full"><Field label="Название категории"><input name="name" required maxLength={128} /></Field></div> : <>
        <Field label="Тип операции"><select name="kind"><option value="income">Доход</option><option value="expense">Расход</option></select></Field>
        <Field label="Категория"><select name="category_id" required defaultValue=""><option value="" disabled>Выберите категорию</option>{directory.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Сумма"><input name="amount" type="number" min="0.01" step="0.01" required /></Field>
        <Field label="Валюта (код ISO)"><input name="currency" defaultValue={currency || 'KGS'} pattern="[A-Z]{3}" maxLength={3} required /></Field>
        <Field label="Дата операции"><input name="occurred_on" type="date" defaultValue={today()} required /></Field>
        <Field label="Ученик"><select name="student_id" defaultValue={studentId}><option value="">Без привязки</option>{students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Этап оплаты"><input name="stage" placeholder="По умолчанию — текущий этап ученика" maxLength={128} /></Field>
        <Field label="Получатель выплаты"><input name="recipient" maxLength={255} /></Field>
        <Field label="Комиссия, % (для расхода)"><input name="commission_percent" type="number" min="0" max="100" step="0.01" /></Field>
        <div className="full"><Field label="Назначение / комментарий"><textarea name="description" maxLength={5000} /></Field></div>
      </>}
      {formError && <div className="full"><Notice error>{formError}</Notice></div>}
      <footer><button className="company-button primary" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button></footer>
    </form></CompanyModal>}
  </div>;
}
