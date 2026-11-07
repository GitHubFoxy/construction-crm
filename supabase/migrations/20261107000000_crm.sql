create type public.user_role as enum ('manager', 'worker');
create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  role public.user_role not null
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text not null check (length(trim(address)) > 0),
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  project_id uuid not null references public.projects(id) on delete restrict,
  assignee_id uuid not null references public.profiles(id),
  status public.task_status not null default 'new',
  author_id uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index tasks_project_id_idx on public.tasks(project_id);
create index tasks_assignee_id_idx on public.tasks(assignee_id);

create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete restrict,
  actor_id uuid not null references public.profiles(id),
  changed_at timestamptz not null default clock_timestamp(),
  from_status public.task_status,
  to_status public.task_status not null,
  comment text
);
create index task_history_task_id_idx on public.task_history(task_id, changed_at, id);

create function public.is_manager() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'manager') $$;
revoke all on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;

create function public.validate_task_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.assignee_id and role = 'worker') then
    raise exception 'Assignee must be a worker';
  end if;
  return new;
end $$;
revoke all on function public.validate_task_assignee() from public, anon, authenticated;
create trigger validate_task_assignee before insert or update of assignee_id on public.tasks
for each row execute function public.validate_task_assignee();

create function public.log_task_creation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.task_history (task_id, actor_id, from_status, to_status)
  values (new.id, new.author_id, null, new.status);
  return new;
end $$;
revoke all on function public.log_task_creation() from public, anon, authenticated;
create trigger log_task_creation after insert on public.tasks
for each row execute function public.log_task_creation();

create function public.transition_task(p_task_id uuid, p_status public.task_status, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks%rowtype;
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into t from public.tasks
  where id = p_task_id and deleted_at is null and (assignee_id = actor or public.is_manager())
  for update;
  if not found then raise exception 'Task not found or inaccessible'; end if;
  if not (
    (t.assignee_id = actor and exists (select 1 from public.profiles where id = actor and role = 'worker') and
      ((t.status = 'new' and p_status = 'in_progress') or
       (t.status = 'in_progress' and p_status = 'review') or
       (t.status = 'rework' and p_status = 'in_progress')))
    or
    (public.is_manager() and t.status = 'review' and p_status in ('accepted', 'rework'))
  ) then raise exception 'Transition not allowed'; end if;
  if p_status = 'rework' and (p_comment is null or p_comment !~ '[^[:space:]]') then
    raise exception 'Comment is required when returning a task';
  end if;
  update public.tasks set status = p_status where id = t.id;
  insert into public.task_history (task_id, actor_id, from_status, to_status, comment)
  values (t.id, actor, t.status, p_status, nullif(trim(p_comment), ''));
end $$;
revoke all on function public.transition_task(uuid, public.task_status, text) from public, anon;
grant execute on function public.transition_task(uuid, public.task_status, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy projects_read on public.projects for select to authenticated using (
  deleted_at is null and ((select public.is_manager()) or exists
    (select 1 from public.tasks where project_id = projects.id and assignee_id = (select auth.uid())))
);
create policy projects_insert on public.projects for insert to authenticated with check ((select public.is_manager()));
create policy projects_update on public.projects for update to authenticated
  using (deleted_at is null and (select public.is_manager())) with check (deleted_at is null and (select public.is_manager()));
create policy tasks_read on public.tasks for select to authenticated using (
  deleted_at is null and ((select public.is_manager()) or assignee_id = (select auth.uid()))
);
create policy tasks_insert on public.tasks for insert to authenticated with check ((select public.is_manager()) and author_id = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (deleted_at is null and (select public.is_manager())) with check (deleted_at is null and (select public.is_manager()));
create policy history_read on public.task_history for select to authenticated using (
  exists (select 1 from public.tasks where id = task_history.task_id)
);

revoke all on public.profiles, public.projects, public.tasks, public.task_history from anon, authenticated;
grant select on public.profiles, public.task_history to authenticated;
grant select, insert on public.projects to authenticated;
grant update (name, address) on public.projects to authenticated;
grant select on public.tasks to authenticated;
grant insert (title, description, project_id, assignee_id), update (title, description, project_id, assignee_id) on public.tasks to authenticated;

create function public.check_active_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.project_id is not distinct from old.project_id then
    return new;
  end if;
  perform 1 from public.projects where id = new.project_id and deleted_at is null for share;
  if not found then raise exception 'Project not found or deleted'; end if;
  return new;
end $$;

revoke all on function public.check_active_project() from public, anon, authenticated;
create trigger check_active_project before insert or update of project_id on public.tasks
for each row execute function public.check_active_project();

create function public.delete_task(p_task_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  update public.tasks set deleted_at = clock_timestamp() where id = p_task_id and deleted_at is null;
  if not found then raise exception 'Task not found'; end if;
end $$;
revoke all on function public.delete_task(uuid) from public, anon;
grant execute on function public.delete_task(uuid) to authenticated;

create function public.delete_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  update public.projects set deleted_at = clock_timestamp() where id = p_project_id and deleted_at is null;
  if not found then raise exception 'Project not found'; end if;
  update public.tasks set deleted_at = clock_timestamp() where project_id = p_project_id and deleted_at is null;
end $$;
revoke all on function public.delete_project(uuid) from public, anon;
grant execute on function public.delete_project(uuid) to authenticated;

