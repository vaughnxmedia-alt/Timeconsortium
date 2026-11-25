-- Profile photos for staff accounts. Email and password stay on staff_members.
-- The server uses the secret key. Anonymous and signed-in Data API roles have no access.

create table public.staff_avatars (
  member_id text primary key references public.staff_members (id) on delete cascade,
  content_type text not null,
  image bytea not null,
  updated_at timestamptz not null default now(),
  constraint staff_avatars_type_check check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint staff_avatars_size_check check (octet_length(image) between 1 and 1500000)
);

alter table public.staff_avatars enable row level security;

revoke all on table public.staff_avatars from anon, authenticated;
