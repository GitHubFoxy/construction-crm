import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../api'
import { useAuth } from '../auth'
import { Button, ErrorText, Field, inputClass } from '../ui'

export default function Login() {
  const { user, error: profileError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setError(error ? (error.status === 400 ? 'Неверный email или пароль' : `Ошибка входа: ${error.message}`) : undefined)
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
      <h1 className="text-xl font-semibold">Вход в CRM</h1>
      <Field label="Email"><input className={inputClass} type="email" name="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Пароль"><input className={inputClass} type="password" name="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <ErrorText>{error ?? profileError}</ErrorText>
      <Button disabled={busy} className="w-full">Войти</Button>
    </form>
  )
}
