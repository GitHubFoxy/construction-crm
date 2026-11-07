import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { supabase } from './api'
import { AuthProvider, useAuth } from './auth'
import Login from './pages/Login'
import MyTasks from './pages/MyTasks'
import ProjectDetail from './pages/ProjectDetail'
import Projects from './pages/Projects'
import TaskDetail from './pages/TaskDetail'
import { Button } from './ui'

function Layout() {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-sm">
          <Link to="/" className="font-semibold">Объекты</Link>
          {user.role === 'worker' && <Link to="/my" className="hover:underline">Мои задачи</Link>}
          <span className="ml-auto text-slate-500">
            {user.display_name} · {user.role === 'manager' ? 'постановщик' : 'исполнитель'}
          </span>
          <Button variant="secondary" onClick={() => supabase.auth.signOut()}>Выйти</Button>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl p-4"><Outlet /></main>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            <Route path="my" element={<MyTasks />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
