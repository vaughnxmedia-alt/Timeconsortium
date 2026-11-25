create table public.notices (
  id text primary key,
  created_at timestamptz not null,
  subject text not null,
  body text not null,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  constraint notices_counts_check check (sent_count >= 0 and failed_count >= 0)
);

create table public.notice_recipients (
  notice_id text not null references public.notices (id) on delete cascade,
  email text not null,
  status text not null,
  primary key (notice_id, email),
  constraint notice_recipients_status_check check (status in ('sent', 'failed'))
);

alter table public.notices enable row level security;
alter table public.notice_recipients enable row level security;

revoke all on table public.notices from anon, authenticated;
revoke all on table public.notice_recipients from anon, authenticated;
