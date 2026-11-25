-- Staff desk, manual and Square ticket orders, and the partner pipeline.
-- Existing vendor, sponsor, waitlist, token, and notice rows stay.
-- The server uses the secret key. Anonymous and signed-in Data API roles have no access.

create table public.staff_members (
  id text primary key,
  email text not null unique,
  role text not null,
  status text not null,
  password_hash text not null default '',
  created_at timestamptz not null,
  activated_at timestamptz,
  revoked_at timestamptz,
  constraint staff_members_role_check check (role in ('owner', 'member')),
  constraint staff_members_status_check check (status in ('invited', 'active', 'revoked'))
);

create table public.staff_links (
  id text primary key,
  member_id text not null references public.staff_members (id) on delete cascade,
  purpose text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null,
  constraint staff_links_purpose_check check (purpose in ('invite', 'verify', 'login'))
);

create index staff_links_member_idx on public.staff_links (member_id);

create table public.staff_sessions (
  id text primary key,
  member_id text not null references public.staff_members (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null
);

create index staff_sessions_member_idx on public.staff_sessions (member_id);

create table public.ticket_orders (
  id text primary key,
  created_at timestamptz not null,
  guest_name text not null default '',
  email text not null default '',
  quantity integer not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  payment_status text not null,
  order_reference text not null default '',
  source text not null,
  square_payment_id text not null default '',
  square_order_id text not null default '',
  notes text not null default '',
  recorded_by text not null default '',
  constraint ticket_orders_quantity_check check (quantity >= 1 and quantity <= 100),
  constraint ticket_orders_amount_check check (amount_cents >= 0),
  constraint ticket_orders_status_check check (payment_status in ('unpaid', 'paid', 'refunded')),
  constraint ticket_orders_source_check check (source in ('manual', 'square'))
);

create unique index ticket_orders_square_payment_idx
  on public.ticket_orders (square_payment_id)
  where square_payment_id <> '';

alter table public.sponsors
  add column status text not null default 'new',
  add column notes text not null default '',
  add column source text not null default 'website',
  add column updated_at timestamptz;

update public.sponsors set updated_at = created_at where updated_at is null;

alter table public.sponsors
  alter column updated_at set default now(),
  alter column updated_at set not null,
  add constraint sponsors_status_check check (status in ('new', 'in_conversation', 'confirmed', 'closed')),
  add constraint sponsors_source_check check (source in ('website', 'staff'));

alter table public.staff_members enable row level security;
alter table public.staff_links enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.ticket_orders enable row level security;

revoke all on table public.staff_members from anon, authenticated;
revoke all on table public.staff_links from anon, authenticated;
revoke all on table public.staff_sessions from anon, authenticated;
revoke all on table public.ticket_orders from anon, authenticated;
