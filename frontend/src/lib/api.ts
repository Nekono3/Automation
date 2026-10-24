import { LoginResponse, User, Conversation, Message, Customer, Booking, Service, DashboardStats, WhatsAppAccount } from './types';


function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
    if (port === '3000') {
      return `${protocol}//${hostname}:8000`;
    }
    return origin;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

class ApiClient {
  private getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${getApiUrl()}/api${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async login(email: string, password: string):Promise<LoginResponse> {
    const response = await fetch(`${getApiUrl()}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async getConversations(params?: any): Promise<Conversation[]> {
    const qs = new URLSearchParams(params || {}).toString();
    return this.request<Conversation[]>(`/conversations?${qs}`);
  }

  async getConversation(id: string): Promise<Conversation> {
    return this.request<Conversation>(`/conversations/${id}`);
  }

  async getMessages(id: string, skip = 0, limit = 50): Promise<Message[]> {
    return this.request<Message[]>(`/conversations/${id}/messages?skip=${skip}&limit=${limit}`);
  }

  async sendMessage(id: string, text: string): Promise<Message> {
    return this.request<Message>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async updateConversationMode(id: string, mode: string, reason?: string): Promise<Conversation> {
    return this.request<Conversation>(`/conversations/${id}/mode`, {
      method: 'PATCH',
      body: JSON.stringify({ mode, reason }),
    });
  }

  async updateConversation(id: string, data: any): Promise<Conversation> {
    return this.request<Conversation>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getCustomers(search = '', skip = 0, limit = 50): Promise<Customer[]> {
    return this.request<Customer[]>(`/customers?search=${search}&skip=${skip}&limit=${limit}`);
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`);
  }

  async updateCustomer(id: string, data: any): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getBookings(params?: any): Promise<Booking[]> {
    const qs = new URLSearchParams(params || {}).toString();
    return this.request<Booking[]>(`/bookings?${qs}`);
  }

  async confirmBooking(id: string): Promise<Booking> {
    return this.request<Booking>(`/bookings/${id}/confirm`, { method: 'POST' });
  }

  async cancelBooking(id: string, reason?: string): Promise<Booking> {
    return this.request<Booking>(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getServices(): Promise<Service[]> {
    return this.request<Service[]>('/services');
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/dashboard/stats');
  }

  // Automations (Comment-to-DM & Keywords)
  async getAutomations(): Promise<import('./types').AutomationTrigger[]> {
    return this.request<import('./types').AutomationTrigger[]>('/automations');
  }

  async createAutomation(data: any): Promise<import('./types').AutomationTrigger> {
    return this.request<import('./types').AutomationTrigger[]>('/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as any;
  }

  async updateAutomation(id: number, data: any): Promise<import('./types').AutomationTrigger> {
    return this.request<import('./types').AutomationTrigger>(`/automations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAutomation(id: number): Promise<any> {
    return this.request<any>(`/automations/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadAutomationAttachment(file: File): Promise<{ status: string; filename: string; saved_filename: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${getApiUrl()}/api/automations/upload-attachment`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.statusText}`);
    }
    return res.json();
  }

  // Deals & Pipelines (Kanban)
  async getDeals(pipelineType?: string, customerId?: string): Promise<import('./types').Deal[]> {
    const params = new URLSearchParams();
    if (pipelineType) params.append('pipeline_type', pipelineType);
    if (customerId) params.append('customer_id', customerId);
    return this.request<import('./types').Deal[]>(`/deals?${params.toString()}`);
  }

  async createDeal(data: any): Promise<import('./types').Deal> {
    return this.request<import('./types').Deal>('/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDealStage(id: number, stage: string, lost_reason?: string): Promise<import('./types').Deal> {
    return this.request<import('./types').Deal>(`/deals/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage, lost_reason }),
    });
  }

  async updateChecklistStatus(checklistId: number, status: string, file_url?: string): Promise<any> {
    return this.request<any>(`/deals/checklists/${checklistId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, file_url }),
    });
  }

  // Student Profile
  async getStudentProfile(customerId: string): Promise<import('./types').StudentProfile | null> {
    return this.request<import('./types').StudentProfile>(`/students/${customerId}/profile`);
  }

  async updateStudentProfile(customerId: string, data: any): Promise<import('./types').StudentProfile> {
    return this.request<import('./types').StudentProfile>(`/students/${customerId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // University Programs Catalog
  async getPrograms(params?: {
    search?: string;
    university?: string;
    faculty?: string;
    degree_level?: string;
    language?: string;
    sort_by?: string;
    skip?: number;
    limit?: number;
  }): Promise<import('./types').UniversityProgram[]> {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          qs.append(k, String(v));
        }
      });
    }
    return this.request<import('./types').UniversityProgram[]>(`/programs?${qs.toString()}`);
  }

  async getProgram(id: number): Promise<import('./types').UniversityProgram> {
    return this.request<import('./types').UniversityProgram>(`/programs/${id}`);
  }

  async createProgram(data: Partial<import('./types').UniversityProgram>): Promise<import('./types').UniversityProgram> {
    return this.request<import('./types').UniversityProgram>('/programs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProgram(id: number, data: Partial<import('./types').UniversityProgram>): Promise<import('./types').UniversityProgram> {
    return this.request<import('./types').UniversityProgram>(`/programs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProgram(id: number): Promise<void> {
    return this.request<void>(`/programs/${id}`, {
      method: 'DELETE',
    });
  }

  async renameUniversity(old_name: string, new_name: string): Promise<{ status: string; affected_programs: number; new_name: string }> {
    return this.request<{ status: string; affected_programs: number; new_name: string }>('/programs/rename-university', {
      method: 'POST',
      body: JSON.stringify({ old_name, new_name }),
    });
  }

  async getProgramUniversities(): Promise<import('./types').UniversitySummary[]> {
    return this.request<import('./types').UniversitySummary[]>('/programs/universities');
  }

  async getProgramsStats(): Promise<import('./types').ProgramsStats> {
    return this.request<import('./types').ProgramsStats>('/programs/stats');
  }

  async syncPrograms(force = true): Promise<{ status: string; seeded_programs: number }> {
    return this.request<{ status: string; seeded_programs: number }>(`/programs/sync?force=${force}`, {
      method: 'POST',
    });
  }

  // Seller KPI System
  async getSellers(): Promise<import('./types').Seller[]> {
    return this.request<import('./types').Seller[]>('/kpi/sellers');
  }

  async createSeller(data: { name: string; role?: string; phone?: string }): Promise<import('./types').Seller> {
    return this.request<import('./types').Seller>('/kpi/sellers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSeller(id: number): Promise<void> {
    return this.request<void>(`/kpi/sellers/${id}`, {
      method: 'DELETE',
    });
  }

  async addKPIScore(data: import('./types').KPIScoreInput): Promise<import('./types').SellerKPIRecord> {
    return this.request<import('./types').SellerKPIRecord>('/kpi/scores', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteKPIRecord(recordId: number): Promise<void> {
    return this.request<void>(`/kpi/records/${recordId}`, {
      method: 'DELETE',
    });
  }

  async syncKPI(force = true): Promise<{ status: string; seeded_records: number }> {
    return this.request<{ status: string; seeded_records: number }>(`/kpi/sync?force=${force}`, {
      method: 'POST',
    });
  }

  // Enrolled Students Tracker (Process & Finance)
  async getEnrolledStudents(params?: {
    search?: string;
    country?: string;
    manager?: string;
    stage?: string;
    risk?: string;
    is_completed?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<import('./types').EnrolledStudent[]> {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          qs.append(k, String(v));
        }
      });
    }
    return this.request<import('./types').EnrolledStudent[]>(`/enrolled-students?${qs.toString()}`);
  }

  async getEnrolledStudentsStats(): Promise<import('./types').EnrolledStudentsStats> {
    return this.request<import('./types').EnrolledStudentsStats>('/enrolled-students/stats');
  }

  async getEnrolledStudent(id: number): Promise<import('./types').EnrolledStudent> {
    return this.request<import('./types').EnrolledStudent>(`/enrolled-students/${id}`);
  }

  async createEnrolledStudent(data: Partial<import('./types').EnrolledStudent>): Promise<import('./types').EnrolledStudent> {
    return this.request<import('./types').EnrolledStudent>('/enrolled-students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEnrolledStudent(id: number, data: Partial<import('./types').EnrolledStudent>): Promise<import('./types').EnrolledStudent> {
    return this.request<import('./types').EnrolledStudent>(`/enrolled-students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteEnrolledStudent(id: number): Promise<void> {
    return this.request<void>(`/enrolled-students/${id}`, {
      method: 'DELETE',
    });
  }

  async syncEnrolledStudents(force = true): Promise<{ status: string; seeded_students: number }> {
    return this.request<{ status: string; seeded_students: number }>(`/enrolled-students/sync?force=${force}`, {
      method: 'POST',
    });
  }

  // --- WhatsApp Accounts ---
  async getWhatsAppAccounts(): Promise<WhatsAppAccount[]> {
    return this.request<WhatsAppAccount[]>('/whatsapp/accounts');
  }

  async createWhatsAppAccount(data: { name: string; role?: string; is_main?: boolean; color?: string; account_id?: string }): Promise<WhatsAppAccount> {
    return this.request<WhatsAppAccount>('/whatsapp/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWhatsAppAccount(accountId: string, data: Partial<WhatsAppAccount>): Promise<WhatsAppAccount> {
    return this.request<WhatsAppAccount>(`/whatsapp/accounts/${accountId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWhatsAppAccount(accountId: string): Promise<void> {
    return this.request<void>(`/whatsapp/accounts/${accountId}`, {
      method: 'DELETE',
    });
  }

  async disconnectWhatsAppSession(accountId: string): Promise<void> {
    return this.request<void>(`/whatsapp/accounts/${accountId}/disconnect`, {
      method: 'POST',
    });
  }

  async restartWhatsAppSession(accountId: string): Promise<void> {
    return this.request<void>(`/whatsapp/accounts/${accountId}/restart`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();


