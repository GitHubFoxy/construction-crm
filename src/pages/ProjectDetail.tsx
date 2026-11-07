import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useUser } from '../auth'
import { ProjectForm, TaskForm } from '../forms'
import { useAsync } from '../hooks'
import { Async, Button, ErrorText } from '../ui'
import { TaskList } from './TaskList'
import { usePeople } from './people'

export default function ProjectDetail() {
  const { id = '' } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const project = useAsync(() => api.project(id), [id])
  const tasks = useAsync(() => api.tasks({ projectId: id }), [id])
  const people = usePeople()
  const [dialog, setDialog] = useState<'edit' | 'task'>()
  const [error, setError] = useState<string>()
  const isManager = user.role === 'manager'

  async function remove() {
    if (!confirm('Удалить объект вместе с задачами?')) return
    try {
      await api.deleteProject(id)
      navigate('/')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Async state={project}>
      {project.data && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold">{project.data.name}</h1>
              <p className="text-sm text-slate-500">{project.data.address}</p>
            </div>
            {isManager && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setDialog('edit')}>Редактировать</Button>
                <Button variant="danger" onClick={remove}>Удалить</Button>
              </div>
            )}
          </div>
          <ErrorText>{error ?? people.error}</ErrorText>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Задачи</h2>
            {isManager && <Button onClick={() => setDialog('task')}>Новая задача</Button>}
          </div>
          <Async state={tasks}>
            <TaskList tasks={tasks.data ?? []} people={people.map} />
          </Async>
          {dialog === 'edit' && <ProjectForm project={project.data} onClose={() => setDialog(undefined)} onSaved={project.reload} />}
          {dialog === 'task' && (
            <TaskForm projectId={id} workers={people.workers} onClose={() => setDialog(undefined)} onSaved={tasks.reload} />
          )}
        </section>
      )}
    </Async>
  )
}
