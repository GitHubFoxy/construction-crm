import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useUser } from '../auth'
import { ProjectForm } from '../forms'
import { useAsync } from '../hooks'
import { Async, Button } from '../ui'

export default function Projects() {
  const user = useUser()
  const projects = useAsync(api.projects, [])
  const [creating, setCreating] = useState(false)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Объекты</h1>
        {user.role === 'manager' && <Button onClick={() => setCreating(true)}>Новый объект</Button>}
      </div>
      <Async state={projects}>
        {projects.data?.length === 0 && <p className="text-sm text-slate-500">Объектов пока нет.</p>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.data?.map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-400">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-slate-500">{p.address}</div>
              </Link>
            </li>
          ))}
        </ul>
      </Async>
      {creating && <ProjectForm onClose={() => setCreating(false)} onSaved={projects.reload} />}
    </section>
  )
}
