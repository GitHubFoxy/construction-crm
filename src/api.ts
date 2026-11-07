import { createClient } from '@supabase/supabase-js'
import type { HistoryEntry, Profile, Project, Status, Task } from './domain'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

async function ok<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data as T
}

const NOT_FOUND = 'Не найдено или нет доступа'
async function one<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const data = await ok(q)
  if (!data) throw new Error(NOT_FOUND)
  return data
}

const noError = async (q: PromiseLike<{ error: { message: string } | null }>) => {
  const { error } = await q
  if (error) throw new Error(error.message)
}

export const api = {
  profile: (id: string) => one<Profile>(supabase.from('profiles').select('*').eq('id', id).maybeSingle()),
  allProfiles: () => ok<Profile[]>(supabase.from('profiles').select('*')),

  projects: () => ok<Project[]>(supabase.from('projects').select('*').order('name')),
  project: (id: string) => one<Project>(supabase.from('projects').select('*').eq('id', id).maybeSingle()),
  saveProject: (p: Partial<Project> & Pick<Project, 'name' | 'address'>) =>
    noError(
      p.id
        ? supabase.from('projects').update({ name: p.name, address: p.address }).eq('id', p.id)
        : supabase.from('projects').insert({ name: p.name, address: p.address }),
    ),
  deleteProject: (id: string) => noError(supabase.rpc('delete_project', { p_project_id: id })),

  tasks: (filter: { projectId?: string; assigneeId?: string } = {}) => {
    let q = supabase.from('tasks').select('*').order('created_at', { ascending: false })
    if (filter.projectId) q = q.eq('project_id', filter.projectId)
    if (filter.assigneeId) q = q.eq('assignee_id', filter.assigneeId)
    return ok<Task[]>(q)
  },
  task: (id: string) => one<Task>(supabase.from('tasks').select('*').eq('id', id).maybeSingle()),
  saveTask: (t: Pick<Task, 'title' | 'description' | 'project_id' | 'assignee_id'> & { id?: string }) => {
    const { id, ...fields } = t
    return noError(id ? supabase.from('tasks').update(fields).eq('id', id) : supabase.from('tasks').insert(fields))
  },
  deleteTask: (id: string) => noError(supabase.rpc('delete_task', { p_task_id: id })),
  transition: (id: string, status: Status, comment?: string) =>
    noError(supabase.rpc('transition_task', { p_task_id: id, p_status: status, p_comment: comment ?? null })),
  history: (taskId: string) =>
    ok<HistoryEntry[]>(
      supabase.from('task_history').select('*').eq('task_id', taskId).order('changed_at').order('id'),
    ),
}
