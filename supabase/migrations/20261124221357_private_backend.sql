-- Private queue for vendor requests, sponsorship inquiries, ticket-list
-- signups, and vendor access tokens. The server uses the secret key.
-- Anonymous and signed-in Data API roles have no access.

create table public.vendors (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  contact_name text not null,
  business_name text not null,
  specialty text not null default '',
  specialty_group text not null default '',
  specialty_other text not null default '',
  email text not null,
  portfolio text not null default '',
  contribution text not null default '',
  status text not null,
  staff_notes text not null default '',
  included text not null default '',
  fee_required boolean not null default false,
  fee_label text not null default '',
  checkout_url text not null default '',
  square_payment_link_id text not null default '',
  square_order_id text not null default '',
  confirmation_deadline text not null default '',
  agreement_accepted_at text not null default '',
  payment_completed_at text not null default '',
  logo_url text not null default '',
  description text not null default '',
  setup_needs text not null default '',
  published boolean not null default false,
  public_name text not null default '',
  public_specialty text not null default '',
  public_summary text not null default '',
  public_portfolio text not null default '',
  public_logo_url text not null default '',
  receipt_sent boolean not null default false,
  acceptance_sent boolean not null default false,
  constraint vendors_status_check check (
    status in ('submitted', 'under_review', 'accepted_pending', 'confirmed', 'declined')
  )
);

create index vendors_email_idx on public.vendors (email);
create index vendors_square_order_idx on public.vendors (square_order_id);

create table public.sponsors (
  id text primary key,
  created_at timestamptz not null,
  contact_name text not null,
  organization text not null,
  email text not null,
  interest text not null,
  message text not null default '',
  notified boolean not null default false,
  constraint sponsors_interest_check check (interest in ('financial', 'in-kind', 'discussing'))
);

create table public.ticket_list (
  id text primary key,
  created_at timestamptz not null,
  email text not null unique
);

create table public.access_tokens (
  hash text primary key,
  vendor_id text not null references public.vendors (id) on delete cascade,
  expires_at timestamptz not null
);

create index access_tokens_vendor_idx on public.access_tokens (vendor_id);

alter table public.vendors enable row level security;
alter table public.sponsors enable row level security;
alter table public.ticket_list enable row level security;
alter table public.access_tokens enable row level security;

revoke all on table public.vendors from anon, authenticated;
revoke all on table public.sponsors from anon, authenticated;
revoke all on table public.ticket_list from anon, authenticated;
revoke all on table public.access_tokens from anon, authenticated;
