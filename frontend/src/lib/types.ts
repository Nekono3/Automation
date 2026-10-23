export interface User {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface StudentProfile {
  id: number;
  customer_id: number;
  current_grade_or_status?: string;
  school_or_university?: string;
  gpa?: number;
  language_tests: Record<string, any>;
  target_countries: string[];
  target_degree?: string;
  planned_year?: number;
  budget_expectation?: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  username?: string;
  phone?: string;
  email?: string;
  instagram_id?: string;
  whatsapp_id?: string;
  telegram_id?: string;
  role_type?: 'STUDENT' | 'PARENT' | 'OTHER';
  preferred_language?: 'RU' | 'KY' | 'EN';
  parent_contact_id?: number;
  student_profile?: StudentProfile;
  tags: string[];
  notes?: string;
  last_contact_at?: string;
  created_at: string;
}

export interface DocumentChecklist {
  id: number;
  deal_id: number;
  document_name: string;
  status: 'NOT_SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  file_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: number;
  title: string;
  customer_id: number;
  pipeline_type: 'SALES' | 'ADMISSION';
  stage: string;
  target_country?: string;
  target_degree?: string;
  amount: number;
  currency: string;
  lost_reason?: string;
  assigned_user_id?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  checklists?: DocumentChecklist[];
}

export interface AutomationTrigger {
  id: number;
  name: string;
  keyword: string;
  match_type: 'EXACT' | 'CONTAINS';
  channel: 'ALL' | 'INSTAGRAM' | 'WHATSAPP';
  comment_reply_text?: string;
  dm_reply_text: string;
  attachment_url?: string;
  attachment_name?: string;
  followup_text?: string;
  target_pipeline_stage: string;
  is_active: boolean;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  customer_id: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'ai' | 'employee' | 'system';
  text: string;
  attachments?: any[];
  status: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  customer_id: string;
  channel: string;
  mode: 'ai' | 'human' | 'paused';
  status: 'open' | 'closed' | 'archived';
  priority: number;
  unread_count: number;
  last_message_at: string;
  assigned_user_id?: string;
  last_message_preview?: string;
  customer?: Customer;
  messages?: Message[];
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  currency: string;
  is_active: boolean;
  category?: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  customer_id: string;
  service_id: string;
  service_name_snapshot: string;
  price_snapshot: number;
  currency: string;
  status: 'draft' | 'awaiting_confirmation' | 'confirmed' | 'completed' | 'cancelled';
  scheduled_at: string;
  duration_minutes: number;
  meeting_type: string;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  service?: Service;
}

export interface DashboardStats {
  open_conversations: number;
  ai_conversations: number;
  human_conversations: number;
  pending_bookings: number;
  total_customers: number;
  unread_messages: number;
}

export interface UniversityProgram {
  id: number;
  university: string;
  faculty: string;
  program_name: string;
  program_name_ru: string;
  degree_level: string;
  tuition_fee: string;
  tuition_fee_usd?: number | null;
  currency: string;
  duration: string;
  language: string;
  city: string;
  country: string;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UniversitySummary {
  name: string;
  city: string;
  country: string;
  program_count: number;
  degrees: string[];
}

export interface ProgramsStats {
  total_programs: number;
  total_universities: number;
  total_faculties: number;
  degrees_breakdown: Record<string, number>;
  universities: UniversitySummary[];
}
