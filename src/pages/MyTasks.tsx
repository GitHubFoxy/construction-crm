import { api } from '../api'
import { useUser } from '../auth'
import { useAsync } from '../hooks'
import { Async } from '../ui'
import { TaskList } from './TaskList'
import { usePeople } from './people'

export default function MyTasks() {
  const user = useUser()
  const tasks = useAsync(() => api.tasks({ assigneeId: user.id }), [user.id])
  const people = usePeople()
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Мои задачи</h1>
      <Async state={tasks}>
        <TaskList tasks={tasks.data ?? []} people={people.map} />
      </Async>
    </section>
  )
}
