import { Link } from 'react-router-dom'
import type { Profile, Task } from '../domain'
import { StatusBadge, formatDate } from '../ui'

export function TaskList({ tasks, people }: { tasks: Task[]; people: Map<string, Profile> }) {
  if (tasks.length === 0) return <p className="text-sm text-slate-500">Задач нет.</p>
  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {tasks.map((t) => (
        <li key={t.id}>
          <Link to={`/tasks/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
            <div>
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-slate-500">
                {people.get(t.assignee_id)?.display_name ?? '—'} · {formatDate(t.created_at)}
              </div>
            </div>
            <StatusBadge status={t.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
