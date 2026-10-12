import { LoginResponse, User, Conversation, Message, Customer, Booking, Service, DashboardStats } from './types';

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
    const res = await fetch(`${this.baseUrl}/automations/upload-attachment`, {
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
}

export const api = new ApiClient();
