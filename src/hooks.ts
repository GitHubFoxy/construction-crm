import { useCallback, useEffect, useState } from 'react'

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const [version, setVersion] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loader = useCallback(load, deps)

  useEffect(() => {
    let cancelled = false
    loader().then(
      (d) => !cancelled && (setData(d), setError(undefined)),
      (e: Error) => !cancelled && setError(e.message),
    )
    return () => { cancelled = true }
  }, [loader, version])

  return { data, error, loading: !data && !error, reload: () => setVersion((v) => v + 1) }
}
