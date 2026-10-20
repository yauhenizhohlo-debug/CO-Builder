create table public.co_builder_price_overrides (
  room_number text primary key,
  current_price bigint not null check (current_price > 0),
  current_price_per_sqm bigint not null check (current_price_per_sqm > 0),
  revision bigint not null default 0 check (revision >= 0),
  comment text not null,
  author_id text not null,
  changed_at timestamptz not null default now()
);

create table public.co_builder_price_history (
  id uuid primary key default gen_random_uuid(),
  room_number text not null,
  revision bigint not null check (revision > 0),
  old_price bigint not null check (old_price > 0),
  new_price bigint not null check (new_price > 0),
  new_price_per_sqm bigint not null check (new_price_per_sqm > 0),
  comment text not null,
  author_id text not null,
  changed_at timestamptz not null default now(),
  unique (room_number, revision)
);

create index co_builder_price_history_room_changed_idx
  on public.co_builder_price_history (room_number, changed_at desc);

create or replace function public.co_builder_reject_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'PRICE_HISTORY_IMMUTABLE';
end;
$$;

create trigger co_builder_price_history_immutable
before update or delete on public.co_builder_price_history
for each row execute function public.co_builder_reject_history_mutation();

create table public.co_builder_proposal_snapshots (
  id uuid primary key,
  created_at timestamptz not null,
  payload jsonb not null,
  inserted_at timestamptz not null default now()
);

create table public.co_builder_one_page_snapshots (
  id uuid primary key,
  created_at timestamptz not null,
  payload jsonb not null,
  inserted_at timestamptz not null default now()
);

alter table public.co_builder_price_overrides enable row level security;
alter table public.co_builder_price_history enable row level security;
alter table public.co_builder_proposal_snapshots enable row level security;
alter table public.co_builder_one_page_snapshots enable row level security;

revoke all on public.co_builder_price_overrides from anon, authenticated;
revoke all on public.co_builder_price_history from anon, authenticated;
revoke all on public.co_builder_proposal_snapshots from anon, authenticated;
revoke all on public.co_builder_one_page_snapshots from anon, authenticated;

create or replace function public.co_builder_reject_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'SNAPSHOT_IMMUTABLE';
end;
$$;

create trigger co_builder_proposal_snapshots_immutable
before update or delete on public.co_builder_proposal_snapshots
for each row execute function public.co_builder_reject_snapshot_mutation();

create trigger co_builder_one_page_snapshots_immutable
before update or delete on public.co_builder_one_page_snapshots
for each row execute function public.co_builder_reject_snapshot_mutation();

create or replace function public.co_builder_save_price_override(
  p_room_number text,
  p_expected_price bigint,
  p_new_price bigint,
  p_new_price_per_sqm bigint,
  p_comment text,
  p_author_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.co_builder_price_overrides%rowtype;
  next_revision bigint;
  changed timestamptz := now();
begin
  if p_new_price <= 0 or p_new_price_per_sqm <= 0 or btrim(p_comment) = '' or btrim(p_author_id) = '' then
    raise exception 'INVALID_PRICE_OVERRIDE';
  end if;

  insert into public.co_builder_price_overrides (
    room_number, current_price, current_price_per_sqm, revision, comment, author_id, changed_at
  ) values (
    p_room_number, p_expected_price, p_new_price_per_sqm, 0, 'Initial catalog state', p_author_id, changed
  ) on conflict (room_number) do nothing;

  select * into current_row
  from public.co_builder_price_overrides
  where room_number = p_room_number
  for update;

  if current_row.current_price <> p_expected_price then
    raise exception 'PRICE_CONFLICT' using detail = format('Expected %s, actual %s', p_expected_price, current_row.current_price);
  end if;

  next_revision := current_row.revision + 1;

  insert into public.co_builder_price_history (
    room_number, revision, old_price, new_price, new_price_per_sqm, comment, author_id, changed_at
  ) values (
    p_room_number, next_revision, current_row.current_price, p_new_price, p_new_price_per_sqm,
    btrim(p_comment), btrim(p_author_id), changed
  );

  update public.co_builder_price_overrides
  set current_price = p_new_price,
      current_price_per_sqm = p_new_price_per_sqm,
      revision = next_revision,
      comment = btrim(p_comment),
      author_id = btrim(p_author_id),
      changed_at = changed
  where room_number = p_room_number;

  return jsonb_build_object(
    'roomNumber', p_room_number,
    'oldPrice', current_row.current_price,
    'newPrice', p_new_price,
    'newPricePerSqm', p_new_price_per_sqm,
    'comment', btrim(p_comment),
    'authorId', btrim(p_author_id),
    'changedAt', changed,
    'revision', next_revision
  );
end;
$$;

revoke all on function public.co_builder_save_price_override(text, bigint, bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.co_builder_save_price_override(text, bigint, bigint, bigint, text, text) to service_role;
