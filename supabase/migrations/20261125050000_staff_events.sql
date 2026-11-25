-- Events added from the HQ desk. Reverie & Ember stays in the site config.
-- The server uses the secret key. Anonymous and signed-in Data API roles have no access.

create table public.staff_events (
  id text primary key,
  slug text not null unique,
  name text not null,
  event_date date not null,
  venue text not null,
  created_at timestamptz not null default now(),
  constraint staff_events_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug <> 'reverie-and-ember'),
  constraint staff_events_name_check check (char_length(btrim(name)) between 2 and 80),
  constraint staff_events_venue_check check (char_length(btrim(venue)) between 2 and 120)
);

alter table public.staff_events enable row level security;

revoke all on table public.staff_events from anon, authenticated;
