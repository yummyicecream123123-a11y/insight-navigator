
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);

-- analyses
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  asset_type text not null,
  time_range text not null,
  image_path text,
  indicators jsonb not null default '[]'::jsonb,
  layer1 jsonb,
  layer2 jsonb,
  layer3 jsonb,
  final_verdict text,
  confidence numeric,
  created_at timestamptz not null default now()
);
alter table public.analyses enable row level security;
create policy "analyses select own" on public.analyses for select using (auth.uid() = user_id);
create policy "analyses insert own" on public.analyses for insert with check (auth.uid() = user_id);
create policy "analyses delete own" on public.analyses for delete using (auth.uid() = user_id);
create index analyses_user_created on public.analyses(user_id, created_at desc);

-- profile auto-create trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- storage bucket for chart uploads (private)
insert into storage.buckets (id, name, public) values ('chart-uploads','chart-uploads', false)
on conflict (id) do nothing;

create policy "chart upload own folder" on storage.objects for insert
  with check (bucket_id = 'chart-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "chart read own folder" on storage.objects for select
  using (bucket_id = 'chart-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "chart delete own folder" on storage.objects for delete
  using (bucket_id = 'chart-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
