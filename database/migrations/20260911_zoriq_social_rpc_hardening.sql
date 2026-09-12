-- Applied to Supabase project juordakzclqefpuauzjq on 2026-09-11.
-- Harden SECURITY DEFINER social RPCs so they enforce auth, visibility and block rules.

create schema if not exists private;

create or replace function private.can_view_social_post(p_post_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = p.author_id and b.blocked_id = p_user_id)
           or (b.blocker_id = p_user_id and b.blocked_id = p.author_id)
      )
      and (
        p.visibility = 'public'::post_visibility
        or p.author_id = p_user_id
        or (
          p.visibility = 'followers'::post_visibility
          and p_user_id is not null
          and exists (
            select 1 from public.user_follows uf
            where uf.follower_id = p_user_id
              and uf.following_id = p.author_id
          )
        )
      )
  );
$$;
revoke all on function private.can_view_social_post(uuid,uuid) from public, anon, authenticated;

create or replace function public.social_toggle_like(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid:=auth.uid(); active boolean:=false; c bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not private.can_view_social_post(p_post_id,uid) then raise exception 'post_not_visible'; end if;
  if exists(select 1 from public.post_likes where post_id=p_post_id and user_id=uid) then
    delete from public.post_likes where post_id=p_post_id and user_id=uid;
  else
    insert into public.post_likes(post_id,user_id) values(p_post_id,uid) on conflict do nothing;
    active:=true;
  end if;
  select count(*) into c from public.post_likes where post_id=p_post_id;
  update public.posts set likes_count=c where id=p_post_id;
  return jsonb_build_object('active',active,'count',c);
end $$;

create or replace function public.social_toggle_bookmark(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid:=auth.uid(); active boolean:=false; c bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not private.can_view_social_post(p_post_id,uid) then raise exception 'post_not_visible'; end if;
  if exists(select 1 from public.post_bookmarks where post_id=p_post_id and user_id=uid) then
    delete from public.post_bookmarks where post_id=p_post_id and user_id=uid;
  else
    insert into public.post_bookmarks(post_id,user_id) values(p_post_id,uid) on conflict do nothing;
    active:=true;
  end if;
  select count(*) into c from public.post_bookmarks where post_id=p_post_id;
  update public.posts set bookmarks_count=c where id=p_post_id;
  return jsonb_build_object('active',active,'count',c);
end $$;

create or replace function public.social_toggle_repost(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid:=auth.uid(); active boolean:=false; c bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not private.can_view_social_post(p_post_id,uid) then raise exception 'post_not_visible'; end if;
  if exists(select 1 from public.post_reposts where post_id=p_post_id and user_id=uid) then
    delete from public.post_reposts where post_id=p_post_id and user_id=uid;
  else
    insert into public.post_reposts(post_id,user_id) values(p_post_id,uid) on conflict do nothing;
    active:=true;
  end if;
  select count(*) into c from public.post_reposts where post_id=p_post_id;
  update public.posts set reposts_count=c where id=p_post_id;
  return jsonb_build_object('active',active,'count',c);
end $$;

create or replace function public.social_set_reaction(p_post_id uuid, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid:=auth.uid(); current text; c bigint; active text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not private.can_view_social_post(p_post_id,uid) then raise exception 'post_not_visible'; end if;
  if p_emoji not in ('👍','❤️','🔥','🚀','😂','😮','😢') then raise exception 'invalid_reaction'; end if;
  select emoji into current from public.post_reactions where post_id=p_post_id and user_id=uid;
  if current=p_emoji then
    delete from public.post_reactions where post_id=p_post_id and user_id=uid;
    active:=null;
  else
    insert into public.post_reactions(post_id,user_id,emoji) values(p_post_id,uid,p_emoji)
      on conflict(post_id,user_id) do update set emoji=excluded.emoji;
    active:=p_emoji;
  end if;
  select count(*) into c from public.post_reactions where post_id=p_post_id;
  return jsonb_build_object('emoji',active,'count',c);
end $$;

create or replace function public.social_add_comment(p_post_id uuid, p_body text)
returns public.comments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid:=auth.uid(); rec public.comments;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not private.can_view_social_post(p_post_id,uid) then raise exception 'post_not_visible'; end if;
  if length(trim(coalesce(p_body,'')))<1 or length(p_body)>1000 then raise exception 'invalid_comment'; end if;
  insert into public.comments(post_id,author_id,body) values(p_post_id,uid,trim(p_body)) returning * into rec;
  update public.posts set comments_count=(select count(*) from public.comments where post_id=p_post_id) where id=p_post_id;
  return rec;
end $$;

create or replace function public.social_toggle_follow(p_following_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid:=auth.uid(); active boolean:=false; requested boolean:=false; c bigint; visibility text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if uid=p_following_id then raise exception 'cannot_follow_self'; end if;
  if exists(select 1 from public.user_blocks where (blocker_id=uid and blocked_id=p_following_id) or (blocker_id=p_following_id and blocked_id=uid)) then
    raise exception 'follow_unavailable';
  end if;
  select profile_visibility into visibility from public.profiles where id=p_following_id;
  if visibility is null then raise exception 'profile_not_found'; end if;
  if exists(select 1 from public.user_follows where follower_id=uid and following_id=p_following_id) then
    delete from public.user_follows where follower_id=uid and following_id=p_following_id;
    delete from public.follow_requests where requester_id=uid and target_id=p_following_id;
  elsif visibility in ('followers','private') then
    insert into public.follow_requests(requester_id,target_id) values(uid,p_following_id) on conflict do nothing;
    requested:=true;
  else
    insert into public.user_follows(follower_id,following_id) values(uid,p_following_id) on conflict do nothing;
    active:=true;
  end if;
  select count(*) into c from public.user_follows where following_id=p_following_id;
  return jsonb_build_object('active',active,'requested',requested,'followers',c);
end $$;

create or replace function public.social_accept_follow_request(p_requester_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid:=auth.uid(); c bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.follow_requests where requester_id=p_requester_id and target_id=uid) then raise exception 'request_not_found'; end if;
  if exists(select 1 from public.user_blocks where (blocker_id=uid and blocked_id=p_requester_id) or (blocker_id=p_requester_id and blocked_id=uid)) then raise exception 'follow_unavailable'; end if;
  insert into public.user_follows(follower_id,following_id) values(p_requester_id,uid) on conflict do nothing;
  delete from public.follow_requests where requester_id=p_requester_id and target_id=uid;
  insert into public.notifications(user_id,type,title,body,icon,metadata)
    values(p_requester_id,'follow_accepted','Solicitação aceita','Sua solicitação para seguir foi aceita.','🤝',jsonb_build_object('profile_id',uid));
  select count(*) into c from public.user_follows where following_id=uid;
  return jsonb_build_object('accepted',true,'followers',c);
end $$;

create or replace function public.start_direct_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare me uuid:=auth.uid(); cid uuid; allowed boolean; mode text;
begin
  if me is null then raise exception 'authentication required'; end if;
  if other_user is null or other_user=me then raise exception 'invalid recipient'; end if;
  select coalesce(allow_messages,true),coalesce(dm_mode,'following') into allowed,mode from public.profiles where id=other_user;
  if not found then raise exception 'recipient_not_found'; end if;
  if allowed is false or mode='nobody' then raise exception 'recipient does not allow messages'; end if;
  if mode='following' and not exists(select 1 from public.user_follows where follower_id=other_user and following_id=me) then
    raise exception 'recipient_only_accepts_following';
  end if;
  if exists(select 1 from public.user_blocks where (blocker_id=me and blocked_id=other_user) or (blocker_id=other_user and blocked_id=me)) then raise exception 'messaging unavailable'; end if;
  select c.id into cid
  from public.conversations c
  where c.kind='direct'
    and (select count(*) from public.conversation_members cm where cm.conversation_id=c.id)=2
    and exists(select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=me)
    and exists(select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=other_user)
  order by c.created_at desc limit 1;
  if cid is null then
    insert into public.conversations(kind,created_by) values('direct',me) returning id into cid;
    insert into public.conversation_members(conversation_id,user_id,last_read_at) values(cid,me,now()),(cid,other_user,null);
  end if;
  return cid;
end $$;

revoke all on function public.social_toggle_like(uuid) from public, anon;
revoke all on function public.social_toggle_bookmark(uuid) from public, anon;
revoke all on function public.social_toggle_repost(uuid) from public, anon;
revoke all on function public.social_set_reaction(uuid,text) from public, anon;
revoke all on function public.social_add_comment(uuid,text) from public, anon;
revoke all on function public.social_toggle_follow(uuid) from public, anon;
revoke all on function public.social_accept_follow_request(uuid) from public, anon;
revoke all on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.social_toggle_like(uuid) to authenticated;
grant execute on function public.social_toggle_bookmark(uuid) to authenticated;
grant execute on function public.social_toggle_repost(uuid) to authenticated;
grant execute on function public.social_set_reaction(uuid,text) to authenticated;
grant execute on function public.social_add_comment(uuid,text) to authenticated;
grant execute on function public.social_toggle_follow(uuid) to authenticated;
grant execute on function public.social_accept_follow_request(uuid) to authenticated;
grant execute on function public.start_direct_conversation(uuid) to authenticated;
