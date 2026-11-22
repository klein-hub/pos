export interface Employee {
  id: string;
  auth_user_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  position: string;
  department: string;
  hire_date: string;
  base_salary: number;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  instance_id: string | null;
  id: string;
  aud: string | null;
  role: string | null;
  email: string | null;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
  invited_at: string | null;
  confirmation_token: string | null;
  confirmation_sent_at: string | null;
  recovery_token: string | null;
  recovery_sent_at: string | null;
  email_change_token_new: string | null;
  email_change: string | null;
  email_change_sent_at: string | null;
  last_sign_in_at: string | null;
  raw_app_meta_data: Record<string, unknown> | null;
  raw_user_meta_data: Record<string, unknown> | null;
  is_super_admin: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  phone: string | null;
  phone_confirmed_at: string | null;
  phone_change: string | null;
  phone_change_token: string | null;
  phone_change_sent_at: string | null;
  confirmed_at: string | null;
  email_change_token_current: string | null;
  email_change_confirm_status: number | null;
  banned_until: string | null;
  reauthentication_token: string | null;
  reauthentication_sent_at: string | null;
  is_sso_user: boolean;
  deleted_at: string | null;
  is_anonymous: boolean;
}

export interface Profile {
  id: string;
  company_id: string | null;
  first_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  role_id: string | null;
  last_name: string | null;
  is_deleted: boolean | null;
  role: string;
}

export interface Role {
  id: string;
  name: string;
  created_at: string;
  description: string | null;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  base_pay: number;
  overtime_pay: number;
  deductions: number;
  net_pay: number;
  payment_date: string;
  status: "pending" | "processed" | "paid";
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  company_id: string | null;
  employee_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "half-day";
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
