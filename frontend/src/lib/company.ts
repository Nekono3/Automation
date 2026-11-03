export interface Staff { id: number; full_name: string; role: string; whatsapp_account_id: number | null }
export interface Category { id: number; name: string }
export interface Directory { users: Staff[]; categories: Category[]; countries: string[] }
export interface Contact { id: number; name: string | null; phone: string | null; email: string | null }
export interface Lead { customer_id: number; assigned_user_id: number | null; category: string; status: string; next_action: string }
export interface LeadRow { customer: Contact; lead: Lead }
export interface Page<T> { total: number; items: T[] }
export interface Transaction { id: number; category_id: number; kind: 'income' | 'expense'; amount: string; currency: string; occurred_on: string; description: string; student_id: number | null; deal_id: number | null; stage: string; recipient: string; commission_percent: string | null; voided_at: string | null; void_reason: string | null }
export interface Total { currency: string; income: string; expense: string; profit: string }
export interface Report { totals: Total[]; categories: (Total & { category_id: number })[]; months: (Total & { month: string })[]; years: (Total & { year: string })[] }
export interface Metric { id: number; name: string; department: string; position: string; unit: string; direction: 'higher' | 'lower' }
export interface KPIResult { id: number; user_id: number; metric_id: number; period: string; target: string; actual: string; notes: string }
export interface ManagerReport { id: number; name: string; role: string; whatsapp_account_id: number | null; leads: Record<string, number>; whatsapp: Record<string, number> }
export interface StudentDoc { id: number; name: string; size: number; status: string; created_at: string }
export interface StudentLink { customer_id: number | null; deal_id: number | null; manager_id: number | null; program_id: number | null }
export interface Dossier {
  student: { id: number; full_name: string; country: string; process_stage: string; manager: string; contract_amount: string; paid_amount: string; remaining_amount: string; comment: string | null; next_action: string; risk: string; is_completed: boolean };
  link: StudentLink | null; customer: Contact | null;
  program: { id: number; university: string; program_name_ru: string; notes: string | null } | null;
  documents: StudentDoc[]; transactions: Transaction[];
  history: { id: number; action: string; created_at: string; user_id: number; extra_data: Record<string, unknown> }[];
}
export const statusNames: Record<string, string> = { new: 'Новый', contacted: 'В работе', qualified: 'Квалифицирован', won: 'Клиент', lost: 'Отказ' };
export const roleNames: Record<string, string> = { admin: 'Администратор', lead_manager: 'РОП', manager: 'Менеджер', mentor: 'Ментор' };
export const money = (value: string | number, currency: string) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))} ${currency}`;
export const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; };
export const query = (values: Record<string, string | number | null | undefined>) => new URLSearchParams(Object.entries(values).filter(([,v]) => v !== '' && v != null).map(([k,v]) => [k, String(v)])).toString();
export const json = (data: unknown, method = 'POST') => ({ method, body: JSON.stringify(data) });
export const errorText = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить действие';
