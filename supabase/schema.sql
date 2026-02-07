-- LugatLab schema + RLS
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  timezone text not null default 'Asia/Tashkent',
  created_at timestamptz not null default now()
);

create table if not exists public.words (
  id bigint generated always as identity primary key,
  word text not null,
  translation_uz text not null,
  example text not null default '',
  level text not null default 'A1' check (level in ('A1', 'A2', 'B1', 'B2')),
  category text not null default 'general',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists words_level_active_idx on public.words(level, is_active);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score >= 0),
  total integer not null default 10 check (total > 0),
  duration_sec integer not null default 0 check (duration_sec >= 0),
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_created_idx on public.quiz_attempts(user_id, created_at desc);

create table if not exists public.user_word_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id bigint not null references public.words(id) on delete cascade,
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  mastery_score numeric(4, 3) not null default 0 check (mastery_score >= 0 and mastery_score <= 1),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

create index if not exists user_word_progress_mastery_idx on public.user_word_progress(user_id, mastery_score asc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_enabled_idx on public.push_subscriptions(user_id, enabled);

create table if not exists public.reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  daily_time_local text not null default '20:00',
  timezone text not null default 'Asia/Tashkent',
  last_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (daily_time_local ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute procedure public.set_updated_at();

drop trigger if exists reminder_settings_set_updated_at on public.reminder_settings;
create trigger reminder_settings_set_updated_at
before update on public.reminder_settings
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.words enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.user_word_progress enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_settings enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id);

drop policy if exists "words_read_authenticated" on public.words;
create policy "words_read_authenticated" on public.words
for select to authenticated
using (true);

drop policy if exists "quiz_attempts_select_own" on public.quiz_attempts;
create policy "quiz_attempts_select_own" on public.quiz_attempts
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
create policy "quiz_attempts_insert_own" on public.quiz_attempts
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_word_progress_select_own" on public.user_word_progress;
create policy "user_word_progress_select_own" on public.user_word_progress
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_word_progress_insert_own" on public.user_word_progress;
create policy "user_word_progress_insert_own" on public.user_word_progress
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_word_progress_update_own" on public.user_word_progress;
create policy "user_word_progress_update_own" on public.user_word_progress
for update to authenticated
using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions
for update to authenticated
using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "reminder_settings_select_own" on public.reminder_settings;
create policy "reminder_settings_select_own" on public.reminder_settings
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "reminder_settings_insert_own" on public.reminder_settings;
create policy "reminder_settings_insert_own" on public.reminder_settings
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "reminder_settings_update_own" on public.reminder_settings;
create policy "reminder_settings_update_own" on public.reminder_settings
for update to authenticated
using (auth.uid() = user_id);
