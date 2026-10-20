create or replace function public.co_builder_reject_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'PRICE_HISTORY_IMMUTABLE';
end;
$$;

create or replace function public.co_builder_reject_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'SNAPSHOT_IMMUTABLE';
end;
$$;
