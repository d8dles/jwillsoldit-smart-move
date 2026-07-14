-- Command Center schema. Phase 1.
-- All tables: id, user_id -> auth.users, created_at, RLS owner-only.

create table public.ventures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  tier text not null check (tier in ('engine','build','backlog')),
  status text not null default 'active'
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  notes text,
  venture_id uuid references public.ventures(id) on delete set null,
  category text check (category in ('client_followup','listing','airbnb','tiffanie','lance','admin','other')),
  person text,
  priority int not null default 3 check (priority in (1,2,3)),
  status text not null default 'open' check (status in ('open','done','parked')),
  due_date date,
  source text not null default 'manual' check (source in ('manual','inbox','ai_suggested')),
  completed_at timestamptz
);

create table public.daily_three (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  date date not null,
  engine_task_id uuid references public.tasks(id) on delete set null,
  build_task_id uuid references public.tasks(id) on delete set null,
  money_task_id uuid references public.tasks(id) on delete set null,
  engine_done boolean not null default false,
  build_done boolean not null default false,
  money_done boolean not null default false,
  unique (user_id, date)
);

create table public.money_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  label text not null,
  kind text not null check (kind in ('commission','lease_pending','rental_income','bill','expense','invoice_out')),
  amount numeric,
  due_date date,
  status text not null default 'open' check (status in ('open','sent','received','paid')),
  counterparty text
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  type text not null check (type in ('buyer','renter','tenant','airbnb_guest','partner')),
  status text not null default 'active' check (status in ('active','closed','paused')),
  checkin_cadence_days int not null default 7,
  last_contact date,
  notes text
);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  kind text not null check (kind in ('wgu','tenant_lease','other')),
  date date not null,
  notes text
);

create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  raw_text text not null,
  status text not null default 'unsorted' check (status in ('unsorted','triaged','dismissed')),
  triaged_to text check (triaged_to in ('task','money_item','deadline','idea')),
  triaged_ref uuid
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  text text not null,
  venture_id uuid references public.ventures(id) on delete set null,
  status text not null default 'parked'
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('daily','friday_money')),
  date date not null,
  payload jsonb not null default '{}'::jsonb
);

-- Indexes for the queries the one screen actually runs.
create index tasks_user_status_idx on public.tasks (user_id, status);
create index inbox_user_status_idx on public.inbox (user_id, status);
create index clients_user_status_idx on public.clients (user_id, status);
create index deadlines_user_date_idx on public.deadlines (user_id, date);
create index money_items_user_status_idx on public.money_items (user_id, status);
create index check_ins_user_date_idx on public.check_ins (user_id, date);

-- RLS: owner-only on every table.
alter table public.ventures enable row level security;
alter table public.tasks enable row level security;
alter table public.daily_three enable row level security;
alter table public.money_items enable row level security;
alter table public.clients enable row level security;
alter table public.deadlines enable row level security;
alter table public.inbox enable row level security;
alter table public.ideas enable row level security;
alter table public.check_ins enable row level security;

create policy ventures_owner on public.ventures for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_owner on public.tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy daily_three_owner on public.daily_three for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy money_items_owner on public.money_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy clients_owner on public.clients for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy deadlines_owner on public.deadlines for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy inbox_owner on public.inbox for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ideas_owner on public.ideas for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy check_ins_owner on public.check_ins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed the venture tiers for every new account, so day one starts structured.
create or replace function public.seed_ventures_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ventures (user_id, name, tier) values
    (new.id, 'Real Estate', 'engine'),
    (new.id, 'Side Job', 'engine'),
    (new.id, 'The Pass', 'build'),
    (new.id, 'WGU / CompTIA A+', 'build'),
    (new.id, 'Bunz LLC', 'backlog'),
    (new.id, 'Grove Terminal', 'backlog'),
    (new.id, 'Content as a Business', 'backlog');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_ventures_for_user();

-- Completing a client_followup task stamps completed_at and, when the person
-- matches an active client, bumps that client's last_contact automatically.
create or replace function public.on_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
    if new.category = 'client_followup' and new.person is not null then
      update public.clients c
        set last_contact = current_date
      where c.user_id = new.user_id
        and c.status = 'active'
        and lower(c.name) = lower(new.person);
    end if;
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_task_status
  before update on public.tasks
  for each row execute function public.on_task_status_change();

-- These are trigger functions only, not public RPCs. Without this, both are
-- directly callable via PostgREST (/rest/v1/rpc/...) by any signed-in caller
-- because they're SECURITY DEFINER in the exposed public schema.
revoke execute on function public.seed_ventures_for_user() from anon, authenticated;
revoke execute on function public.on_task_status_change() from anon, authenticated;
