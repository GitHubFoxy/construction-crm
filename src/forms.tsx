import { useState } from 'react'
import { api } from './api'
import type { Profile, Project, Task } from './domain'
import { Field, FormModal, inputClass } from './ui'

export function ProjectForm({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(project?.name ?? '')
  const [address, setAddress] = useState(project?.address ?? '')
  return (
    <FormModal
      title={project ? 'Редактировать объект' : 'Новый объект'}
      onClose={onClose}
      onSubmit={async () => { await api.saveProject({ id: project?.id, name, address }); onSaved() }}
    >
      <Field label="Название"><input className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Адрес"><input className={inputClass} required value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
    </FormModal>
  )
}

export function TaskForm({ task, projectId, projects, workers, onClose, onSaved }: {
  task?: Task
  projectId: string
  projects?: Project[]
  workers: Profile[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [project, setProject] = useState(projectId)
  const [assignee, setAssignee] = useState(task?.assignee_id ?? workers[0]?.id ?? '')
  return (
    <FormModal
      title={task ? 'Редактировать задачу' : 'Новая задача'}
      onClose={onClose}
      onSubmit={async () => {
        await api.saveTask({ id: task?.id, title, description, project_id: project, assignee_id: assignee })
        onSaved()
      }}
    >
      <Field label="Название"><input className={inputClass} required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Описание"><textarea className={inputClass} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {projects && (
        <Field label="Объект">
          <select className={inputClass} required value={project} onChange={(e) => setProject(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Исполнитель">
        <select className={inputClass} required value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.display_name}</option>)}
        </select>
      </Field>
    </FormModal>
  )
}
