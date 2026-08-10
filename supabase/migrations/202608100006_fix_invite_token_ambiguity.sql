begin;

create or replace function public.make_invite_token() returns text
language plpgsql volatile set search_path = public as $$
declare generated_token text;
begin
  loop
    generated_token := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12));
    exit when not exists (
      select 1
      from public.jam_invites as invite
      where invite.token = generated_token
    );
  end loop;
  return generated_token;
end;
$$;

revoke all on function public.make_invite_token() from public, anon, authenticated;

commit;
