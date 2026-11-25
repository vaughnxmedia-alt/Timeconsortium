alter table public.staff_members
  add column first_name text not null default '',
  add column last_name text not null default '',
  add column phone text not null default '';
