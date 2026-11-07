import { useState, type FormEvent, type ReactNode } from 'react'
import { STATUS_LABEL, type Status } from './domain'

const STATUS_STYLE: Record<Status, string> = {
  new: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-800',
  review: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  rework: 'bg-red-100 text-red-800',
}

export const StatusBadge = ({ status }: { status: Status }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
)

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

const btn = 'rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50'
export const Button = ({ variant = 'primary', ...p }: React.ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'danger' }) => (
  <button
    {...p}
    className={`${btn} ${{ primary: 'bg-blue-600 text-white hover:bg-blue-700', secondary: 'border border-slate-300 bg-white hover:bg-slate-50', danger: 'bg-red-600 text-white hover:bg-red-700' }[variant]}`}
  />
)

export const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm'
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1 text-sm font-medium text-slate-700">
    <span>{label}</span>
    {children}
  </label>
)

export const ErrorText = ({ children }: { children?: string }) =>
  children ? <p role="alert" className="text-sm text-red-600">{children}</p> : null

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

// Форма в модалке: показывает ошибку базы и блокирует кнопку на время запроса.
export function FormModal({ title, submitLabel = 'Сохранить', onClose, onSubmit, children }: {
  title: string
  submitLabel?: string
  onClose: () => void
  onSubmit: () => Promise<void>
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await onSubmit()
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {children}
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button disabled={busy}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  )
}

export function Async({ state, children }: { state: { data?: unknown; error?: string; loading: boolean }; children: ReactNode }) {
  if (state.error) return <ErrorText>{state.error}</ErrorText>
  if (state.loading) return <p className="text-sm text-slate-500">Загрузка…</p>
  return <>{children}</>
}
