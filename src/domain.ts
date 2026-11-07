export type Role = 'manager' | 'worker'
export type Status = 'new' | 'in_progress' | 'review' | 'accepted' | 'rework'

export interface Profile { id: string; display_name: string; role: Role }
export interface Project { id: string; name: string; address: string }
export interface Task {
  id: string
  title: string
  description: string
  project_id: string
  assignee_id: string
  status: Status
  author_id: string
  created_at: string
}
export interface HistoryEntry {
  id: number
  actor_id: string
  changed_at: string
  from_status: Status | null
  to_status: Status
  comment: string | null
}

export const STATUS_LABEL: Record<Status, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
}

export interface TransitionAction {
  to: Status
  label: string
  commentRequired?: boolean
  danger?: boolean
}

// Зеркало правил transition_task в базе: только решает, какие кнопки показать.
// Сама проверка выполняется в базе.
export function availableActions(task: Task, user: Profile): TransitionAction[] {
  if (user.role === 'worker' && task.assignee_id === user.id) {
    if (task.status === 'new' || task.status === 'rework') return [{ to: 'in_progress', label: 'Взять в работу' }]
    if (task.status === 'in_progress') return [{ to: 'review', label: 'Отправить на проверку' }]
  }
  if (user.role === 'manager' && task.status === 'review') {
    return [
      { to: 'accepted', label: 'Принять' },
      { to: 'rework', label: 'Вернуть на доработку', commentRequired: true, danger: true },
    ]
  }
  return []
}
