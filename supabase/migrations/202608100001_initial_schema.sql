begin;

create extension if not exists pgcrypto;

create type public.jam_visibility as enum ('private', 'link', 'public');
create type public.jam_member_role as enum ('organizer', 'co-organizer', 'musician');
create type public.preparation_state as enum ('UNKNOWN', 'NEEDS_LISTENING', 'KNOWS_STRUCTURE', 'READY');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(trim(display_name)) between 1 and 60),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 50),
  is_standard boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profile_instruments (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, instrument_id)
);

create table public.jams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  starts_at timestamptz not null,
  location text check (location is null or char_length(location) <= 180),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  visibility public.jam_visibility not null default 'link',
  proposals_open boolean not null default true,
  assignments_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jam_members (
  jam_id uuid not null references public.jams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.jam_member_role not null default 'musician',
  joined_at timestamptz not null default now(),
  primary key (jam_id, user_id)
);

create table public.jam_invites (
  token text primary key check (token ~ '^[A-Z0-9]{6,20}$'),
  jam_id uuid not null unique references public.jams(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  jam_id uuid not null references public.jams(id) on delete cascade,
  proposer_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 160),
  artist text not null check (char_length(trim(artist)) between 1 and 160),
  listening_url text check (listening_url is null or listening_url ~ '^https?://'),
  bpm smallint check (bpm between 20 and 400),
  musical_key text check (musical_key is null or char_length(musical_key) <= 20),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.song_role_slots (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete restrict,
  position smallint not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (song_id, instrument_id, position)
);

create table public.role_assignments (
  slot_id uuid primary key references public.song_role_slots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.role_volunteers (
  song_id uuid not null references public.songs(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (song_id, instrument_id, user_id)
);

create table public.song_preparation (
  song_id uuid not null references public.songs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  state public.preparation_state not null default 'UNKNOWN',
  updated_at timestamptz not null default now(),
  primary key (song_id, user_id)
);

create table public.setlist_items (
  id uuid primary key default gen_random_uuid(),
  jam_id uuid not null references public.jams(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (jam_id, song_id),
  constraint setlist_position_unique unique (jam_id, position) deferrable initially immediate
);

create index jams_creator_idx on public.jams(creator_id);
create index jams_starts_at_idx on public.jams(starts_at);
create index jam_members_user_idx on public.jam_members(user_id);
create index songs_jam_idx on public.songs(jam_id, created_at desc);
create index song_role_slots_song_idx on public.song_role_slots(song_id);
create index role_assignments_user_idx on public.role_assignments(user_id);
create index role_volunteers_user_idx on public.role_volunteers(user_id);
create index song_preparation_user_idx on public.song_preparation(user_id, state);
create index setlist_items_jam_position_idx on public.setlist_items(jam_id, position);

insert into public.instruments (name, is_standard) values
  ('Voce', true), ('Chitarra', true), ('Basso', true), ('Batteria', true),
  ('Tastiere', true), ('Percussioni', true)
on conflict (name) do nothing;

create function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger jams_set_updated_at before update on public.jams for each row execute function public.set_updated_at();
create trigger songs_set_updated_at before update on public.songs for each row execute function public.set_updated_at();
create trigger preparation_set_updated_at before update on public.song_preparation for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.make_invite_token() returns text language plpgsql volatile as $$
declare token text;
begin
  loop
    token := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from public.jam_invites where jam_invites.token = token);
  end loop;
  return token;
end;
$$;

create function public.initialize_jam() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.jam_members (jam_id, user_id, role) values (new.id, new.creator_id, 'organizer');
  if new.visibility = 'link' then
    insert into public.jam_invites (token, jam_id, created_by) values (public.make_invite_token(), new.id, new.creator_id);
  end if;
  return new;
end;
$$;
create trigger on_jam_created after insert on public.jams for each row execute function public.initialize_jam();

commit;
