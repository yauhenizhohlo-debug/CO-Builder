create table public.co_builder_rate_limits (
  scope text not null,
  client_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (scope, client_key, window_started_at)
);

alter table public.co_builder_rate_limits enable row level security;
revoke all on public.co_builder_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.co_builder_rate_limits to service_role;

grant select, insert on public.co_builder_price_overrides to service_role;
grant select, insert on public.co_builder_price_history to service_role;
grant select, insert on public.co_builder_proposal_snapshots to service_role;
grant select, insert on public.co_builder_one_page_snapshots to service_role;

create or replace function public.co_builder_consume_rate_limit(
  p_scope text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz;
  next_count integer;
  retry_after integer;
begin
  if btrim(p_scope) = '' or btrim(p_key) = '' or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  current_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);

  delete from public.co_builder_rate_limits
  where scope = p_scope and client_key = p_key and window_started_at < current_window - interval '2 days';

  insert into public.co_builder_rate_limits (scope, client_key, window_started_at, request_count)
  values (p_scope, p_key, current_window, 1)
  on conflict (scope, client_key, window_started_at)
  do update set request_count = public.co_builder_rate_limits.request_count + 1
  returning request_count into next_count;

  retry_after := greatest(1, ceil(extract(epoch from current_window + make_interval(secs => p_window_seconds) - clock_timestamp()))::integer);
  return jsonb_build_object('allowed', next_count <= p_limit, 'retryAfterSeconds', retry_after);
end;
$$;

revoke all on function public.co_builder_consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.co_builder_consume_rate_limit(text, text, integer, integer) to service_role;
