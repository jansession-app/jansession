begin;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (octet_length(endpoint) between 1 and 4096),
  p256dh text not null check (octet_length(p256dh) between 1 and 512),
  auth text not null check (octet_length(auth) between 1 and 256),
  locale text not null check (locale in ('it', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from public, anon, authenticated;
grant select on table public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, p256dh, auth, locale)
  on table public.push_subscriptions to authenticated;
grant update (p256dh, auth, locale)
  on table public.push_subscriptions to authenticated;
grant delete on table public.push_subscriptions to authenticated;

create policy "Users read own push subscriptions"
on public.push_subscriptions
for select to authenticated
using (user_id = auth.uid());

create policy "Users create own push subscriptions"
on public.push_subscriptions
for insert to authenticated
with check (user_id = auth.uid());

create policy "Users update own push subscriptions"
on public.push_subscriptions
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users delete own push subscriptions"
on public.push_subscriptions
for delete to authenticated
using (user_id = auth.uid());

commit;
