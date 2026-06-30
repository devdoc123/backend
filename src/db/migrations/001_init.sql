-- ============================================================
-- Gym Management System - Initial schema
-- PostgreSQL (Supabase compatible)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------- ENUM types ----------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner','manager','receptionist','accountant','trainer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('active','inactive','frozen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM ('male','female','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('active','expired','cancelled','upcoming');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('unpaid','partial','paid','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash','card','bank_transfer','jazzcash','easypaisa','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE income_category AS ENUM ('membership','registration','personal_training','supplement','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM ('rent','salaries','electricity','maintenance','internet','cleaning','equipment','marketing','miscellaneous');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inventory_txn_type AS ENUM ('purchase','sale','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  password_hash   text NOT NULL,
  full_name       text NOT NULL,
  role            user_role NOT NULL,
  phone           text,
  commission_rate numeric(5,2) NOT NULL DEFAULT 0, -- % for trainers
  is_active       boolean NOT NULL DEFAULT true,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- refresh tokens (rotation) ----------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti         text NOT NULL UNIQUE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by text,
  user_agent  text,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- ---------- settings (singleton) ----------
CREATE TABLE IF NOT EXISTS settings (
  id                        boolean PRIMARY KEY DEFAULT true CHECK (id),
  gym_name                  text NOT NULL DEFAULT 'My Gym',
  address                   text,
  phone                     text,
  currency                  text NOT NULL DEFAULT 'PKR',
  default_grace_period_days int NOT NULL DEFAULT 5,
  reminder_offsets          jsonb NOT NULL DEFAULT '[-3,0,3,7]'::jsonb, -- days relative to due date
  reminder_template         text NOT NULL DEFAULT 'Dear {name}, your membership payment of {currency} {amount} is {status}. Due date: {due_date}. Thank you - {gym}.',
  updated_at                timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_settings_updated ON settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- membership plans ----------
CREATE TABLE IF NOT EXISTS membership_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  description       text,
  duration_days     int NOT NULL CHECK (duration_days > 0),
  price             numeric(12,2) NOT NULL CHECK (price >= 0),
  registration_fee  numeric(12,2) NOT NULL DEFAULT 0 CHECK (registration_fee >= 0),
  grace_period_days int NOT NULL DEFAULT 5 CHECK (grace_period_days >= 0),
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_plans_updated ON membership_plans;
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON membership_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- members ----------
CREATE TABLE IF NOT EXISTS members (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code       text NOT NULL UNIQUE,
  full_name         text NOT NULL,
  father_name       text,
  phone             text NOT NULL,
  emergency_contact text,
  gender            gender_type,
  date_of_birth     date,
  joining_date      date NOT NULL DEFAULT CURRENT_DATE,
  height_cm         numeric(5,1),
  weight_kg         numeric(5,1),
  goal              text,
  medical_notes     text,
  status            member_status NOT NULL DEFAULT 'active',
  notes             text,
  trainer_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_trainer ON members(trainer_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_name_trgm ON members USING gin (lower(full_name) gin_trgm_ops);
DROP TRIGGER IF EXISTS trg_members_updated ON members;
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- memberships (subscription periods) ----------
CREATE TABLE IF NOT EXISTS memberships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_id           uuid NOT NULL REFERENCES membership_plans(id),
  plan_name         text NOT NULL,            -- snapshot
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  grace_period_days int NOT NULL DEFAULT 5,
  price             numeric(12,2) NOT NULL DEFAULT 0,
  registration_fee  numeric(12,2) NOT NULL DEFAULT 0,
  discount          numeric(12,2) NOT NULL DEFAULT 0,
  total_amount      numeric(12,2) NOT NULL DEFAULT 0,
  status            membership_status NOT NULL DEFAULT 'active',
  trainer_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memberships_member ON memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_end ON memberships(end_date);
DROP TRIGGER IF EXISTS trg_memberships_updated ON memberships;
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- invoices ----------
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  text NOT NULL UNIQUE,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  membership_id   uuid REFERENCES memberships(id) ON DELETE SET NULL,
  total_amount    numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid     numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance         numeric(12,2) NOT NULL DEFAULT 0,
  status          invoice_status NOT NULL DEFAULT 'unpaid',
  due_date        date NOT NULL,
  notes           text,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_member ON invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);
DROP TRIGGER IF EXISTS trg_invoices_updated ON invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- payments (immutable ledger) ----------
CREATE TABLE IF NOT EXISTS payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  method        payment_method NOT NULL DEFAULT 'cash',
  reference     text,
  note          text,
  paid_at       timestamptz NOT NULL DEFAULT now(),
  recorded_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- ---------- attendance ----------
CREATE TABLE IF NOT EXISTS attendance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  attend_date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  marked_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, attend_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attend_date);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);

-- ---------- income (general accounting) ----------
CREATE TABLE IF NOT EXISTS income (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    income_category NOT NULL,
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  source      text,
  member_id   uuid REFERENCES members(id) ON DELETE SET NULL,
  trainer_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  payment_id  uuid REFERENCES payments(id) ON DELETE SET NULL, -- link to membership payments
  description text,
  received_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_income_received ON income(received_at);
CREATE INDEX IF NOT EXISTS idx_income_category ON income(category);

-- ---------- expenses ----------
CREATE TABLE IF NOT EXISTS expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    expense_category NOT NULL,
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  vendor      text,
  description text,
  spent_at    timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_spent ON expenses(spent_at);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ---------- inventory ----------
CREATE TABLE IF NOT EXISTS inventory_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  sku           text UNIQUE,
  category      text,
  quantity      int NOT NULL DEFAULT 0,
  unit_price    numeric(12,2) NOT NULL DEFAULT 0,
  cost_price    numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_inventory_updated ON inventory_items;
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type        inventory_txn_type NOT NULL,
  quantity    int NOT NULL CHECK (quantity > 0),
  unit_price  numeric(12,2) NOT NULL DEFAULT 0,
  total       numeric(12,2) NOT NULL DEFAULT 0,
  member_id   uuid REFERENCES members(id) ON DELETE SET NULL,
  income_id   uuid REFERENCES income(id) ON DELETE SET NULL,
  note        text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_txn_item ON inventory_transactions(item_id);

-- ---------- reminder dispatch log ----------
CREATE TABLE IF NOT EXISTS reminder_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid REFERENCES invoices(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reminder_type text NOT NULL, -- e.g. "due_-3", "due_0", "due_3", "due_7"
  channel      text NOT NULL DEFAULT 'whatsapp',
  message      text NOT NULL,
  sent_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminder_member ON reminder_logs(member_id);

-- ---------- audit logs ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name  text,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text,
  description text,
  metadata    jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ---------- counters for human-friendly sequential codes ----------
CREATE TABLE IF NOT EXISTS counters (
  name  text PRIMARY KEY,
  value bigint NOT NULL DEFAULT 0
);
INSERT INTO counters(name, value) VALUES ('member_code', 0) ON CONFLICT DO NOTHING;
INSERT INTO counters(name, value) VALUES ('invoice_number', 0) ON CONFLICT DO NOTHING;
INSERT INTO counters(name, value) VALUES ('receipt_number', 0) ON CONFLICT DO NOTHING;

-- atomically increment and return a counter
CREATE OR REPLACE FUNCTION next_counter(counter_name text) RETURNS bigint AS $$
DECLARE
  next_val bigint;
BEGIN
  INSERT INTO counters(name, value) VALUES (counter_name, 1)
  ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
  RETURNING value INTO next_val;
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;
