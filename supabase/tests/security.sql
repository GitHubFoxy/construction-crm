begin;
insert into auth.users (id, email) values
('00000000-0000-0000-0000-000000000001', 'manager-test@example.invalid'),
('00000000-0000-0000-0000-000000000002', 'worker-one-test@example.invalid'),
('00000000-0000-0000-0000-000000000003', 'worker-two-test@example.invalid'),
('00000000-0000-0000-0000-000000000004', 'no-profile-test@example.invalid'),
('00000000-0000-0000-0000-000000000005', 'manager-two-test@example.invalid');
insert into public.profiles (id, display_name, role) values
('00000000-0000-0000-0000-000000000001', 'Manager', 'manager'),
('00000000-0000-0000-0000-000000000002', 'Worker 1', 'worker'),
('00000000-0000-0000-0000-000000000003', 'Worker 2', 'worker'),
('00000000-0000-0000-0000-000000000005', 'Manager 2', 'manager');
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Assertion failed: %', message; end if; end $$;
create function pg_temp.assert_denied(statement text, expected_state text default 'P0001') returns void language plpgsql as $$
declare actual_state text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual_state = returned_sqlstate; end;
  if actual_state is distinct from expected_state then
    raise exception 'Expected SQLSTATE %, got % for %', expected_state, actual_state, statement;
  end if;
end $$;
create function pg_temp.transition_error(task uuid) returns text language plpgsql as $$
begin
  perform public.transition_task(task, 'in_progress');
  return 'unexpected success';
exception when raise_exception then return sqlerrm;
end $$;
set local role anon;
select pg_temp.assert_denied($q$select * from public.tasks$q$, '42501');
select pg_temp.assert_denied($q$select public.transition_task(gen_random_uuid(), 'in_progress')$q$, '42501');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select pg_temp.assert_true((select count(*) = 0 from public.tasks), 'user without profile sees no tasks');
select pg_temp.assert_true((select count(*) = 0 from public.projects), 'user without profile sees no projects');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.projects (id, name, address) values
('10000000-0000-0000-0000-000000000001', 'Project 1', 'Address'),
('10000000-0000-0000-0000-000000000002', 'Project 2', 'Address');
insert into public.tasks (title, project_id, assignee_id) values
('Task 1', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
('Task 2', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'),
('Shared task', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003');
select pg_temp.assert_true((select count(*) = 3 from public.task_history where actor_id = '00000000-0000-0000-0000-000000000001'), 'creation history');
select set_config('test.task_one', (select id::text from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), true);
update public.tasks set project_id = project_id where id = current_setting('test.task_one')::uuid;
select pg_temp.assert_true((select project_id = '10000000-0000-0000-0000-000000000001' from public.tasks where id = current_setting('test.task_one')::uuid), 'unchanged project update');
select pg_temp.assert_denied($q$update public.tasks set status = 'accepted'$q$, '42501');
select pg_temp.assert_denied($q$select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'accepted')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select pg_temp.assert_true((select count(*) = 1 from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Shared task'), 'second worker sees only own shared-project task');
select pg_temp.assert_true(not exists (select 1 from public.task_history where task_id = current_setting('test.task_one')::uuid), 'second worker cannot see first worker history');
select pg_temp.assert_true((select count(*) = 1 from public.task_history where task_id = (select id from public.tasks where title = 'Shared task' and project_id = '10000000-0000-0000-0000-000000000001')), 'second worker sees own history');
select pg_temp.assert_denied($q$select public.transition_task(current_setting('test.task_one')::uuid, 'in_progress')$q$);
select pg_temp.assert_true(pg_temp.transition_error(current_setting('test.task_one')::uuid) = pg_temp.transition_error('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid), 'inaccessible and missing tasks return the same error');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.assert_true((select count(*) = 1 from public.tasks), 'worker sees only own task');
select pg_temp.assert_true((select count(*) = 1 from public.tasks where project_id = '10000000-0000-0000-0000-000000000001'), 'shared project shows only own task');
select pg_temp.assert_denied($q$select public.delete_task(current_setting('test.task_one')::uuid)$q$);
select pg_temp.assert_true((select count(*) = 1 from public.projects), 'worker sees only own project');
select pg_temp.assert_true((select count(*) = 1 from public.task_history), 'worker sees only own history');
select pg_temp.assert_denied($q$select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'accepted')$q$);
select pg_temp.assert_denied($q$insert into public.task_history (task_id, actor_id, to_status) select id, auth.uid(), 'accepted' from public.tasks$q$, '42501');
select pg_temp.assert_denied($q$update public.task_history set comment = 'fake'$q$, '42501');
select pg_temp.assert_denied($q$delete from public.task_history$q$, '42501');
update public.tasks set title = 'fake';
select pg_temp.assert_true((select title = 'Task 1' from public.tasks), 'worker cannot edit task');
select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'in_progress');
select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'review');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select pg_temp.assert_denied($q$select public.transition_task(current_setting('test.task_one')::uuid, 'in_progress')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
update public.tasks set description = 'Edited by second manager' where id = current_setting('test.task_one')::uuid;
select pg_temp.assert_true((select description = 'Edited by second manager' from public.tasks where id = current_setting('test.task_one')::uuid), 'second manager edits task');
select pg_temp.assert_denied($q$select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'rework', '  ')$q$);
select pg_temp.assert_denied($q$select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'rework', E'\t\n')$q$);
select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'rework', 'Please fix');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'in_progress');
select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'review');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.transition_task((select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1'), 'accepted');
select pg_temp.assert_true((select count(*) = 7 from public.task_history where task_id = (select id from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and title = 'Task 1')), 'complete history');
select pg_temp.assert_true((select comment = 'Please fix' from public.task_history where task_id = current_setting('test.task_one')::uuid and to_status = 'rework'), 'rework comment');
select pg_temp.assert_denied($q$delete from public.tasks$q$, '42501');
select pg_temp.assert_denied($q$delete from public.projects$q$, '42501');
select pg_temp.assert_denied($q$update public.tasks set deleted_at = now()$q$, '42501');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select pg_temp.assert_true((select count(*) = 3 from public.tasks where project_id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')), 'second manager sees all tasks');
select public.delete_task(current_setting('test.task_one')::uuid);
select pg_temp.assert_true(not exists (select 1 from public.tasks where id = current_setting('test.task_one')::uuid), 'deleted task hidden');
select pg_temp.assert_denied($q$select public.transition_task(current_setting('test.task_one')::uuid, 'in_progress')$q$);
select public.delete_project('10000000-0000-0000-0000-000000000001');
select pg_temp.assert_true(not exists (select 1 from public.projects where id = '10000000-0000-0000-0000-000000000001'), 'deleted project hidden');
select pg_temp.assert_true(not exists (select 1 from public.tasks where project_id = '10000000-0000-0000-0000-000000000001'), 'deleted project tasks hidden');
select pg_temp.assert_denied($q$insert into public.tasks (title, project_id, assignee_id) values ('test', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')$q$);
reset role;
select pg_temp.assert_true((select count(*) = 7 from public.task_history where task_id = current_setting('test.task_one')::uuid), 'deleted task history retained');
select pg_temp.assert_denied($q$delete from public.tasks where id = current_setting('test.task_one')::uuid$q$, '23503');
select pg_temp.assert_denied($q$delete from public.projects where id = '10000000-0000-0000-0000-000000000001'$q$, '23503');
select pg_temp.assert_true((select count(*) = 2 from public.tasks where project_id = '10000000-0000-0000-0000-000000000001' and deleted_at is not null), 'tasks retained after project deletion');
select pg_temp.assert_true((select count(*) = 1 from public.task_history h join public.tasks t on t.id = h.task_id where t.title = 'Shared task' and t.project_id = '10000000-0000-0000-0000-000000000001'), 'project task history retained');
rollback;
