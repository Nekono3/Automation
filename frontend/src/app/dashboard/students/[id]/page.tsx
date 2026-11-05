"use client";
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Upload, Download, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import {can} from '@/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, DataError } from '@/components/WorkspaceUI';
import { CompanyModal, Field, Loading, Notice } from '@/components/CompanyUI';
import { Directory, Dossier, Contact, money, query, json, errorText } from '@/lib/company';

export default function StudentDossier({ params }: { params: Promise<{id:string}> }) {
  const { id } = use(params); const { user } = useAuth();
  const canManage = can(user,'finance.read');
  const [data, setData] = useState<Dossier | null>(null);
  const [directory,setDirectory] = useState<Directory>({users:[],categories:[],countries:[]});
  const [error,setError] = useState(''); const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false); const [notice,setNotice] = useState('');
  const [modal,setModal] = useState<'links' | 'stage' | null>(null); const [formError,setFormError] = useState('');
  const [customerSearch,setCustomerSearch] = useState(''); const [customers,setCustomers] = useState<Contact[]>([]);
  const [programSearch,setProgramSearch] = useState('');
  const [programs,setPrograms] = useState<{id:number; university:string; program_name_ru:string; country:string}[]>([]);
  const [customerId,setCustomerId] = useState(''); const [programId,setProgramId] = useState('');
  const [deals,setDeals] = useState<{id:number; title:string}[]>([]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [d,dir] = await Promise.all([api.company<Dossier>(`/students/${id}`),api.company<Directory>('/directory')]); setData(d); setDirectory(dir); }
    catch(e) { setError(errorText(e)); } finally { setLoading(false); }
  },[id]);
  useEffect(() => { const timer = setTimeout(() => void load(),0); return () => clearTimeout(timer); },[load]);
  useEffect(() => {
    if (modal !== 'links') return;
    const timer = setTimeout(() => { api.getCustomers(customerSearch,0,100).then(rows => setCustomers(rows.map(c => ({id:Number(c.id),name:c.name || null,phone:c.phone || null,email:c.email || null})))).catch(e => setFormError(errorText(e))); },250);
    return () => clearTimeout(timer);
  },[modal,customerSearch]);
  useEffect(() => {
    if (modal !== 'links') return;
    const timer = setTimeout(() => { api.getPrograms({search:programSearch,country:data?.student.country,limit:200}).then(setPrograms).catch(e => setFormError(errorText(e))); },250);
    return () => clearTimeout(timer);
  },[modal,programSearch,data?.student.country]);
  useEffect(() => { let active = true; (customerId ? api.getDeals(undefined,customerId) : Promise.resolve([])).then(rows => { if (active) setDeals(rows); }).catch(e => { if (active) setFormError(errorText(e)); }); return () => { active = false; }; },[customerId]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError('');
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (modal === 'links') {
        await api.company(`/students/${id}/links`,json(Object.fromEntries(Object.entries(form).map(([key,value]) => [key,value ? Number(value) : null])),'PUT'));
      } else {
        await api.updateEnrolledStudent(Number(id),{...form,is_completed:form.is_completed === 'on'});
      }
      setModal(null); await load();
    } catch(e) { setFormError(errorText(e)); } finally { setSaving(false); }
  }
  async function upload(file: File) {
    setSaving(true); setNotice('');
    try { await api.uploadStudentDocument(Number(id),file); await load(); }
    catch(e) { setNotice(errorText(e)); } finally { setSaving(false); }
  }
  const totals: Record<string,{income:number;expense:number}> = {};
  for (const t of data?.transactions || []) if (!t.voided_at) { const bucket = totals[t.currency] ||= {income:0,expense:0}; bucket[t.kind] += Number(t.amount); }
  return <div className="company-page company-stack">
    <div><Link className="company-button" href="/dashboard/students"><ArrowLeft size={16} aria-hidden="true" />Все ученики</Link></div>
    {error && <DataError message={error} onRetry={load} />}
    {loading ? <Loading /> : data && <>
      <PageHeader eyebrow={`УЧЕНИК #${data.student.id} · ${data.student.country}`} title={data.student.full_name} description={`${data.student.process_stage} · ${data.student.manager}`}>
        <button className="company-button" onClick={() => { setFormError(''); setModal('stage'); }}>Изменить процесс</button>
        {canManage && <><button disabled={!can(user,'students.update_all')} className="company-button" onClick={() => { setCustomerId(String(data.link?.customer_id || '')); setProgramId(String(data.link?.program_id || '')); setFormError(''); setModal('links'); }}>Связи CRM</button><Link className="company-button primary" href={`/dashboard/finance?${query({student_id:id})}`}>Платежи и комиссии</Link></>}
      </PageHeader>
      <div className="company-grid"><section className="company-card"><h2>Поступление</h2><p>Страна: {data.student.country}</p><p>Ответственный: {data.student.manager}</p><p>Контакт: {data.customer ? `${data.customer.name || ''} · ${data.customer.phone || data.customer.email || ''}` : 'Не связан'}</p><p>Университет: {data.program?.university || 'Не выбран'}</p><p>Программа: {data.program?.program_name_ru || 'Не выбрана'}</p>{data.program?.notes && <p>Требования / примечания: {data.program.notes}</p>}</section>
      <section className="company-card"><h2>Следующий шаг</h2><p>{data.student.next_action || 'Не указан'}</p><p>Риск: {data.student.risk || 'Не указан'}</p><p>{data.student.comment}</p><p>Статус: {data.student.is_completed ? 'Завершено' : 'В процессе'}</p></section></div>
      {canManage && <section className="company-card"><h2>Оплаты и комиссии</h2><Notice>Исторические данные из таблицы: договор {data.student.contract_amount || '—'}, оплачено {data.student.paid_amount}, остаток {data.student.remaining_amount}. Эти значения сохранены отдельно от журнала операций.</Notice>
        <div className="company-metrics">{Object.entries(totals).map(([currency,total]) => <div key={currency}><p>Поступления: {money(total.income,currency)}</p><p>Выплаты: {money(total.expense,currency)}</p><strong>{money(total.income-total.expense,currency)}</strong></div>)}</div>
        {data.transactions.length === 0 ? <p>Новых денежных операций пока нет.</p> : <div className="company-table-wrap"><table className="company-table mobile-cards"><thead><tr><th>Дата</th><th>Сумма</th><th>Этап</th><th>Получатель / комиссия</th></tr></thead><tbody>{data.transactions.map(t => <tr key={t.id}><td data-label="Дата">{t.occurred_on}</td><td data-label="Сумма"><span>{t.kind === 'income' ? '+' : '−'}{money(t.amount,t.currency)}{t.voided_at && <small>Аннулировано</small>}</span></td><td data-label="Этап"><span>{t.stage}<small>{t.description}</small></span></td><td data-label="Комиссия">{t.recipient || '—'}{t.commission_percent != null && ` · ${t.commission_percent}%`}</td></tr>)}</tbody></table></div>}
      </section>}
      <section className="company-card"><h2>Документы</h2><p>PDF, JPEG, PNG, DOCX · до 10 МБ. Скачивание доступно авторизованным сотрудникам.</p>
        <label className="company-button"><Upload size={16} aria-hidden="true" />{saving ? 'Загрузка…' : 'Загрузить документ'}<input type="file" className="sr-only" disabled={saving || !can(user,'student_documents.upload')} accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value=''; }} /></label>
        {notice && <Notice error>{notice}</Notice>}
        {data.documents.length === 0 && <p>Документы пока не загружены.</p>}
        {data.documents.map(doc => <div className="company-doc" key={doc.id}><span>{doc.name}<small className="company-muted"> · {Math.ceil(doc.size / 1024)} КБ</small></span><div className="company-toolbar"><Field label={`Статус: ${doc.name}`}><select disabled={saving || !can(user,'student_documents.review')} value={doc.status} onChange={async e => { setSaving(true); setNotice(''); try { await api.company(`/documents/${doc.id}`,json({status:e.target.value},'PATCH')); await load(); } catch(err) { setNotice(errorText(err)); } finally { setSaving(false); } }}><option value="under_review">На проверке</option><option value="accepted">Принят</option><option value="rejected">Отклонён</option></select></Field><button className="company-button" onClick={() => api.downloadStudentDocument(doc.id,doc.name).catch(e => setNotice(errorText(e)))}><Download size={16} aria-hidden="true" />Скачать</button></div></div>)}
      </section>
      <section className="company-card"><h2>История изменений</h2>{data.history.length === 0 && <p>Новые изменения появятся здесь.</p>}{data.history.map(log => <div className="company-history" key={log.id}><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString('ru-RU')}</time><strong>{directory.users.find(u => u.id === log.user_id)?.full_name || `Сотрудник #${log.user_id}`} · {({update:'Обновление карточки',link:'Связи CRM',enroll:'Создание из лида',upload_document:'Загрузка документа',document_status:'Проверка документа'} as Record<string,string>)[log.action] || log.action}</strong><p>{Object.entries(log.extra_data).map(([key,value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ')}</p></div>)}</section>
    </>}
    {modal && data && <CompanyModal title={modal === 'links' ? 'Связи ученика' : 'Процесс поступления'} close={() => { if (!saving) setModal(null); }}><form className="company-form" onSubmit={save}>
      {modal === 'links' ? <>
        <Field label="Поиск контакта"><input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} /></Field>
        <Field label="Контакт CRM"><select name="customer_id" value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Не связан</option>{data.customer && !customers.some(c => c.id === data.customer?.id) && <option value={data.customer.id}>{data.customer.name}</option>}{customers.map(c => <option key={c.id} value={c.id}>{c.name || c.phone || `#${c.id}`}</option>)}</select></Field>
        <Field label="Сделка"><select key={customerId} name="deal_id" defaultValue={data.link?.deal_id || ''}><option value="">Не связана</option>{deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
        <Field label="Ответственный"><select name="manager_id" defaultValue={data.link?.manager_id || ''}><option value="">Без привязки к сотруднику</option>{directory.users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>
        <Field label="Поиск программы"><input value={programSearch} onChange={e => setProgramSearch(e.target.value)} placeholder="Университет или специальность" /></Field>
        <Field label="Программа университета"><select name="program_id" value={programId} onChange={e => setProgramId(e.target.value)}><option value="">Не выбрана</option>{data.program && !programs.some(p => p.id === data.program?.id) && <option value={data.program.id}>{data.program.university} · {data.program.program_name_ru}</option>}{programs.filter(p => p.country.toLowerCase() === data.student.country.toLowerCase()).map(p => <option key={p.id} value={p.id}>{p.university} · {p.program_name_ru}</option>)}</select></Field>
      </> : <><Field label="Этап поступления"><input name="process_stage" required maxLength={128} defaultValue={data.student.process_stage} /></Field><Field label="Риск"><input name="risk" maxLength={128} defaultValue={data.student.risk} /></Field><div className="full"><Field label="Следующее действие"><input name="next_action" maxLength={255} defaultValue={data.student.next_action} /></Field></div><div className="full"><Field label="Комментарий"><textarea name="comment" defaultValue={data.student.comment || ''} /></Field></div><label className="company-button"><input type="checkbox" name="is_completed" defaultChecked={data.student.is_completed} /> Поступление завершено</label></>}
      {formError && <div className="full"><Notice error>{formError}</Notice></div>}<footer><button className="company-button primary" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button></footer>
    </form></CompanyModal>}
  </div>;
}
