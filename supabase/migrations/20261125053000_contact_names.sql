-- Names, phone numbers, and the event a partner chose.
-- Existing rows keep working. New columns default to blank.

alter table public.ticket_orders
  add column first_name text not null default '',
  add column last_name text not null default '',
  add column phone text not null default '';

alter table public.vendors
  add column first_name text not null default '',
  add column last_name text not null default '',
  add column phone text not null default '';

alter table public.sponsors
  add column first_name text not null default '',
  add column last_name text not null default '',
  add column phone text not null default '',
  add column event_slug text not null default '';
