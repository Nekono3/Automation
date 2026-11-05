import type { User } from '@/lib/types';
import { securityText } from '@/i18n/security';
export function can(user: User | null | undefined, ...permissions: string[]) {
  return permissions.some(permission => user?.permissions?.includes(permission));
}
export function roleLabel(role?: string) {
  const canonical = role === 'admin' ? 'director' : role === 'lead_manager' ? 'head_of_sales' : role;
  return securityText.ru.roles[canonical as keyof typeof securityText.ru.roles] || 'Сотрудник';
}
export const navigationPermissions: Record<string,string[]> = {
  '/dashboard':['dashboard.read_all'], '/dashboard/conversations':['communication.read_all','communication.read_team','communication.read_assigned'],
  '/dashboard/customers':['leads.read_all','leads.read_team','leads.read_own'], '/dashboard/leads':['leads.read_all','leads.read_team','leads.read_own'],
  '/dashboard/pipeline':['leads.read_all','leads.read_team','leads.read_own'], '/dashboard/students':['students.read_all','students.read_assigned'],
  '/dashboard/programs':['universities.read'], '/dashboard/kpi':['kpi.legacy_manage'], '/dashboard/team':['kpi.read_all','kpi.read_team','kpi.read_own'],
  '/dashboard/finance':['finance.read'], '/dashboard/bookings':['bookings.manage'], '/dashboard/automations':['automations.manage'], '/dashboard/whatsapp':['communication.manage_accounts'],
};
export function landing(user: User | null | undefined) {
  if (can(user,'dashboard.read_all')) return '/dashboard';
  if (can(user,'finance.read')) return '/dashboard/finance';
  if (can(user,'leads.read_own','leads.read_team')) return '/dashboard/leads';
  if (can(user,'students.read_assigned')) return '/dashboard/students';
  return '/dashboard/team';
}
