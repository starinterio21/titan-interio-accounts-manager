-- ============================================================
-- Titan Interio Accounts Manager — Database Schema
-- Separate Supabase project from Stock Manager.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. PROFILES (login users — Owner or Staff)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

-- 2. SUPPLIERS (for purchases)
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  gstin text,
  created_at timestamptz not null default now()
);

-- 3. CUSTOMERS (for invoices)
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

-- 4. PURCHASES (supplier bills — GST included)
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id),
  bill_number text,
  description text,
  bill_date date not null default current_date,
  taxable_amount numeric not null default 0,
  cgst numeric not null default 0,
  sgst numeric not null default 0,
  igst numeric not null default 0,
  total_amount numeric not null default 0,
  invoice_file_path text,  -- path in Supabase Storage
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'partially_paid', 'paid')),
  amount_paid numeric not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_purchases_supplier on purchases(supplier_id);
create index if not exists idx_purchases_status on purchases(status);

-- 5. PURCHASE PAYMENTS (partial payment tracking)
create table if not exists purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  amount numeric not null,
  payment_date date not null default current_date,
  payment_mode text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- 6. CUSTOMER INVOICES (sales — no GST)
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid references customers(id),
  invoice_date date not null default current_date,
  total_amount numeric not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid', 'partially_paid', 'paid')),
  amount_received numeric not null default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_invoices_customer on invoices(customer_id);
create index if not exists idx_invoices_status on invoices(status);

-- 7. INVOICE LINE ITEMS
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  rate numeric not null default 0,
  amount numeric not null default 0
);

-- 8. INVOICE PAYMENTS (partial payment tracking)
create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric not null,
  payment_date date not null default current_date,
  payment_mode text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- 9. STAFF MEMBERS (payroll entities — separate from login accounts)
create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  designation text,
  fixed_salary numeric not null default 0,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 10. ATTENDANCE
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references staff_members(id),
  date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'half_day', 'leave')),
  marked_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique(staff_member_id, date)
);

create index if not exists idx_attendance_staff on attendance(staff_member_id);
create index if not exists idx_attendance_date on attendance(date);

-- 11. SALARY PAYMENTS (monthly payroll runs)
create table if not exists salary_payments (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references staff_members(id),
  month int not null check (month between 1 and 12),
  year int not null,
  base_salary numeric not null default 0,
  bonus numeric not null default 0,
  deduction numeric not null default 0,
  advance_deducted numeric not null default 0,
  net_pay numeric not null default 0,
  paid_on date,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique(staff_member_id, month, year)
);

-- ============================================================
-- FUNCTION: auto-create profile when a new user signs up
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, 'staff');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- FUNCTIONS: auto-update payment status + totals on payment insert
-- ============================================================
create or replace function update_purchase_status()
returns trigger as $$
declare
  total_paid numeric;
  bill_total numeric;
begin
  select coalesce(sum(amount), 0) into total_paid from purchase_payments where purchase_id = new.purchase_id;
  select total_amount into bill_total from purchases where id = new.purchase_id;

  update purchases set
    amount_paid = total_paid,
    status = case
      when total_paid >= bill_total then 'paid'
      when total_paid > 0 then 'partially_paid'
      else 'unpaid'
    end
  where id = new.purchase_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_purchase_payment on purchase_payments;
create trigger trg_purchase_payment
  after insert on purchase_payments
  for each row execute function update_purchase_status();

create or replace function update_invoice_status()
returns trigger as $$
declare
  total_received numeric;
  invoice_total numeric;
begin
  select coalesce(sum(amount), 0) into total_received from invoice_payments where invoice_id = new.invoice_id;
  select total_amount into invoice_total from invoices where id = new.invoice_id;

  update invoices set
    amount_received = total_received,
    status = case
      when total_received >= invoice_total then 'paid'
      when total_received > 0 then 'partially_paid'
      else 'unpaid'
    end
  where id = new.invoice_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_invoice_payment on invoice_payments;
create trigger trg_invoice_payment
  after insert on invoice_payments
  for each row execute function update_invoice_status();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table purchases enable row level security;
alter table purchase_payments enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table invoice_payments enable row level security;
alter table staff_members enable row level security;
alter table attendance enable row level security;
alter table salary_payments enable row level security;

create or replace function current_user_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- PROFILES
create policy "Users view all profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "Owner updates profiles" on profiles for update using (current_user_role() = 'owner');
create policy "Insert own profile" on profiles for insert with check (auth.uid() = id or current_user_role() = 'owner');

-- SUPPLIERS — Staff manages (purchases is staff's job)
create policy "Authenticated view suppliers" on suppliers for select using (auth.role() = 'authenticated');
create policy "Authenticated manage suppliers" on suppliers for all using (auth.role() = 'authenticated');

-- CUSTOMERS — Owner manages (invoices is owner's job)
create policy "Authenticated view customers" on customers for select using (auth.role() = 'authenticated');
create policy "Owner manages customers" on customers for insert with check (current_user_role() = 'owner');
create policy "Owner updates customers" on customers for update using (current_user_role() = 'owner');
create policy "Owner deletes customers" on customers for delete using (current_user_role() = 'owner');

-- PURCHASES — Staff manages, Owner can view
create policy "Authenticated view purchases" on purchases for select using (auth.role() = 'authenticated');
create policy "Authenticated manage purchases" on purchases for all using (auth.role() = 'authenticated');

create policy "Authenticated view purchase_payments" on purchase_payments for select using (auth.role() = 'authenticated');
create policy "Authenticated insert purchase_payments" on purchase_payments for insert with check (auth.role() = 'authenticated');

-- INVOICES — Owner only
create policy "Owner views invoices" on invoices for select using (current_user_role() = 'owner');
create policy "Owner manages invoices" on invoices for insert with check (current_user_role() = 'owner');
create policy "Owner updates invoices" on invoices for update using (current_user_role() = 'owner');
create policy "Owner deletes invoices" on invoices for delete using (current_user_role() = 'owner');

create policy "Owner views invoice_items" on invoice_items for select using (current_user_role() = 'owner');
create policy "Owner manages invoice_items" on invoice_items for all using (current_user_role() = 'owner');

create policy "Owner views invoice_payments" on invoice_payments for select using (current_user_role() = 'owner');
create policy "Owner manages invoice_payments" on invoice_payments for insert with check (current_user_role() = 'owner');

-- STAFF MEMBERS — Owner manages, Staff can view (needed to mark attendance)
create policy "Authenticated view staff_members" on staff_members for select using (auth.role() = 'authenticated');
create policy "Owner manages staff_members" on staff_members for insert with check (current_user_role() = 'owner');
create policy "Owner updates staff_members" on staff_members for update using (current_user_role() = 'owner');
create policy "Owner deletes staff_members" on staff_members for delete using (current_user_role() = 'owner');

-- ATTENDANCE — Both can view, both can mark (Staff's job, Owner can too)
create policy "Authenticated view attendance" on attendance for select using (auth.role() = 'authenticated');
create policy "Authenticated mark attendance" on attendance for insert with check (auth.role() = 'authenticated');
create policy "Authenticated update attendance" on attendance for update using (auth.role() = 'authenticated');

-- SALARY PAYMENTS — Owner only
create policy "Owner views salary_payments" on salary_payments for select using (current_user_role() = 'owner');
create policy "Owner manages salary_payments" on salary_payments for all using (current_user_role() = 'owner');

-- ============================================================
-- STORAGE: bucket for purchase invoice files
-- Run separately if this fails — Storage buckets are sometimes
-- easier to create via Dashboard > Storage > New Bucket ("invoices", private)
-- ============================================================
insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "Authenticated upload invoices" on storage.objects for insert
  with check (bucket_id = 'invoices' and auth.role() = 'authenticated');
create policy "Authenticated read invoices" on storage.objects for select
  using (bucket_id = 'invoices' and auth.role() = 'authenticated');

-- ============================================================
-- Make the FIRST user who signs up the Owner
-- ============================================================
-- update profiles set role = 'owner' where email = 'YOUR_EMAIL_HERE';
-- ============================================================
-- Titan Interio Accounts Manager — Add Expenses Module
-- Run this in Supabase SQL Editor AFTER your main schema.sql
-- (Safe to run even if you haven't deployed yet — just include
-- this after schema.sql either way.)
-- ============================================================

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null default 'Miscellaneous',
  amount numeric not null default 0,
  description text,
  paid_by text,
  receipt_file_path text,  -- optional, path in Supabase Storage
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_date on expenses(expense_date);
create index if not exists idx_expenses_category on expenses(category);

alter table expenses enable row level security;

-- Both Owner and Staff can view, add, and manage expenses
create policy "Authenticated view expenses" on expenses for select using (auth.role() = 'authenticated');
create policy "Authenticated manage expenses" on expenses for all using (auth.role() = 'authenticated');
