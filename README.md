# Titan Interio Accounts Manager

A second, separate web app to manage money — supplier purchases (with GST and
invoice upload), customer invoices, and staff salary/attendance. Built the same
way as your Stock Manager: React + Supabase + Vercel, free tier.

**This is a completely separate app from Stock Manager** — separate login,
separate database, separate deployment. Nothing here can affect Stock Manager.

---

## Roles

- **Owner** (your father-in-law) — sees everything: Dashboard, Customer Invoices,
  Staff & Salary, Purchases, Users
- **Staff** — manages Purchases (add supplier bills, upload invoices), marks
  Attendance for the whole team. Cannot see Dashboard, Invoices, or Salary details.

---

## Setup (same pattern you already know from Stock Manager)

### 1. Create a NEW Supabase project (don't reuse the Stock Manager one)
1. Go to [supabase.com](https://supabase.com) → **New Project**. Give it a different name, e.g. "titan-interio-accounts".
2. Open **SQL Editor** → paste the entire contents of `supabase/schema.sql` → **Run**.
   This creates all tables, security rules, and a private Storage bucket for invoice files.
3. If the Storage bucket creation at the bottom of that file fails (sometimes happens),
   go to **Storage** in the left sidebar → **New Bucket** → name it exactly `invoices` →
   keep it **Private** (not public) → Create.
4. Go to **Project Settings → API** → copy the **Project URL** and **anon public** key.

### 2. Configure the app
1. Copy `.env.example` to `.env` in this project folder
2. Paste in your NEW project's URL and anon key from step 1.4

### 3. Deploy to Vercel
Same process as Stock Manager:
1. Create a new, empty GitHub repo (e.g. `titan-interio-accounts-manager`)
2. Select ALL items inside this project folder together (Ctrl+A / Cmd+A) and drag
   them onto GitHub's "Add file → Upload files" screen in one go — don't go inside
   folders individually, or the structure will break (exactly like last time).
3. Commit directly to `main`.
4. In Vercel → **Add New → Project** → select this new repo.
5. Add Environment Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (same values as your `.env`).
6. Deploy — you'll get a live URL like `titan-interio-accounts-manager.vercel.app`.

### 4. Create the Owner account
1. Visit your live site → **Create Account** → sign up with your father-in-law's
   (or your own) email.
2. In Supabase SQL Editor, run:
   ```sql
   update profiles set role = 'owner' where email = 'the-signup-email@example.com';
   ```
3. Sign out and back in — the Owner menu (Dashboard, Invoices, Staff & Salary, Users) will appear.

### 5. Add staff
Staff sign up the same way (Create Account) — they stay as "Staff" by default,
no role change needed for them.

---

## Using the app

- **Purchases** (Staff or Owner) — add a supplier bill, enter GST breakup
  (taxable amount + CGST/SGST/IGST), optionally upload the invoice file (PDF or
  photo), set a due date. Record payments against it as you pay suppliers —
  status auto-updates to Partially Paid / Paid.
- **Customer Invoices** (Owner only) — create an invoice with any number of line
  items, auto-totaled. Click **Print** to get a clean PDF-style invoice with your
  logo (use the browser's "Save as PDF" option in the print dialog). Record
  payments as customers pay — status auto-updates.
- **Expenses** (Staff or Owner) — log day-to-day factory spends: travel/site
  visits, snacks, courier, fuel, etc. Pick a category, enter amount, optionally
  attach a receipt photo/PDF. Filterable by month and category. Automatically
  included in the Dashboard's profit calculation.
- **Attendance** (Staff or Owner) — pick a date, mark Present/Absent/Half-day/Leave
  for each staff member, save. One person can mark for the whole team.
- **Staff & Salary** (Owner only) — add staff members with their fixed monthly
  salary. Click "Pay Salary" on any staff member to run that month's payroll —
  add bonus/deduction/advance-recovered, see the calculated net pay, mark as paid.
- **Dashboard** (Owner only) — total owed to suppliers, total owed by customers,
  this month's purchases/sales/salary, a rough profit indicator, and any overdue
  supplier payments.

---

## Costs

Same as Stock Manager — **$0/month** on free tiers (separate free Supabase
project + separate free Vercel project). Invoice file uploads use Supabase
Storage, free up to 1GB.

## Notes carried over from Stock Manager lessons learned
- `vercel.json` is already included — this fixes the "page breaks on refresh"
  issue you hit before, from day one.
- Session handling is already configured to persist properly and avoid
  unexpected logouts.
- If you ever see "failed to fetch" style errors from a feature that calls a
  backend function, it's almost always a redeploy needed after a code change —
  same troubleshooting steps as before will apply if we add things like email
  alerts to this app later.
