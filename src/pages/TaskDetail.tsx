import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useUser } from '../auth'
import { availableActions, STATUS_LABEL, type TransitionAction } from '../domain'
import { TaskForm } from '../forms'
import { useAsync } from '../hooks'
import { Async, Button, ErrorText, Field, FormModal, StatusBadge, formatDate, inputClass } from '../ui'
import { usePeople } from './people'

export default function TaskDetail() {
  const { id = '' } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const task = useAsync(() => api.task(id), [id])
  const history = useAsync(() => api.history(id), [id])
  const projectId = task.data?.project_id
  const projects = useAsync(api.projects, [])
  const project = projects.data?.find((p) => p.id === projectId)
  const people = usePeople()
  const [pending, setPending] = useState<TransitionAction>()
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string>()

  const name = (uid: string) => people.map.get(uid)?.display_name ?? '—'
  const reload = () => { task.reload(); history.reload() }

  async function run(action: TransitionAction, text?: string) {
    await api.transition(id, action.to, text)
    reload()
  }

  async function remove() {
    if (!confirm('Удалить задачу?')) return
    try {
      await api.deleteTask(id)
      navigate(`/projects/${projectId}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function click(action: TransitionAction) {
    if (action.commentRequired) {
      setComment('')
      setPending(action)
    } else {
      run(action).catch((e: Error) => setError(e.message))
    }
  }

  return (
    <Async state={task}>
      {task.data && (
        <section className="space-y-6">
          <div className="space-y-2">
            {project && (
              <Link to={`/projects/${project.id}`} className="text-sm text-blue-600 hover:underline">← {project.name}</Link>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-xl font-semibold">{task.data.title}</h1>
              <StatusBadge status={task.data.status} />
            </div>
            <p className="whitespace-pre-wrap text-slate-700">{task.data.description || 'Без описания'}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-sm text-slate-500">
              <dt>Исполнитель</dt><dd>{name(task.data.assignee_id)}</dd>
              <dt>Автор</dt><dd>{name(task.data.author_id)}</dd>
              <dt>Создана</dt><dd>{formatDate(task.data.created_at)}</dd>
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            {availableActions(task.data, user).map((a) => (
              <Button key={a.to} variant={a.danger ? 'danger' : 'primary'} onClick={() => click(a)}>{a.label}</Button>
            ))}
            {user.role === 'manager' && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>Редактировать</Button>
                <Button variant="secondary" onClick={remove}>Удалить</Button>
              </>
            )}
          </div>
          <ErrorText>{error ?? people.error}</ErrorText>

          <div className="space-y-2">
            <h2 className="font-semibold">История</h2>
            <Async state={history}>
              <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
                {history.data?.map((h) => (
                  <li key={h.id} className="text-sm">
                    <div>
                      <b>{name(h.actor_id)}</b>: {h.from_status ? `${STATUS_LABEL[h.from_status]} → ` : 'создана → '}
                      {STATUS_LABEL[h.to_status]}
                    </div>
                    <div className="text-xs text-slate-500">{formatDate(h.changed_at)}</div>
                    {h.comment && <div className="mt-1 rounded bg-slate-100 p-2">{h.comment}</div>}
                  </li>
                ))}
              </ol>
            </Async>
          </div>

          {pending && (
            <FormModal title={pending.label} submitLabel="Подтвердить" onClose={() => setPending(undefined)} onSubmit={() => run(pending, comment)}>
              <Field label="Комментарий (обязателен)">
                <textarea className={inputClass} rows={4} required value={comment} onChange={(e) => setComment(e.target.value)} />
              </Field>
            </FormModal>
          )}
          {editing && (
            <TaskForm task={task.data} projectId={task.data.project_id} projects={projects.data} workers={people.workers} onClose={() => setEditing(false)} onSaved={reload} />
          )}
        </section>
      )}
    </Async>
  )
}
