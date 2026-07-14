export type Tier = 'engine' | 'build' | 'backlog';

export interface Venture {
  id: string;
  name: string;
  tier: Tier;
  status: string;
}

export type TaskCategory =
  | 'client_followup'
  | 'listing'
  | 'airbnb'
  | 'tiffanie'
  | 'lance'
  | 'admin'
  | 'other';

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  venture_id: string | null;
  category: TaskCategory | null;
  person: string | null;
  priority: number;
  status: 'open' | 'done' | 'parked';
  due_date: string | null;
  source: string;
  completed_at: string | null;
  created_at: string;
}

export interface DailyThree {
  id: string;
  date: string;
  engine_task_id: string | null;
  build_task_id: string | null;
  money_task_id: string | null;
  engine_done: boolean;
  build_done: boolean;
  money_done: boolean;
}

export type MoneyKind =
  | 'commission'
  | 'lease_pending'
  | 'rental_income'
  | 'bill'
  | 'expense'
  | 'invoice_out';

export interface MoneyItem {
  id: string;
  label: string;
  kind: MoneyKind;
  amount: number | null;
  due_date: string | null;
  status: 'open' | 'sent' | 'received' | 'paid';
  counterparty: string | null;
  created_at: string;
}

export type ClientType = 'buyer' | 'renter' | 'tenant' | 'airbnb_guest' | 'partner';

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  status: string;
  checkin_cadence_days: number;
  last_contact: string | null;
  notes: string | null;
}

export type DeadlineKind = 'wgu' | 'tenant_lease' | 'other';

export interface Deadline {
  id: string;
  title: string;
  kind: DeadlineKind;
  date: string;
  notes: string | null;
}

export interface InboxItem {
  id: string;
  raw_text: string;
  status: string;
  created_at: string;
}
