import { useMemo } from 'react'
import { api } from '../api'
import { useAsync } from '../hooks'

export function usePeople() {
  const { data = [], error } = useAsync(api.allProfiles, [])
  return useMemo(
    () => ({
      error,
      map: new Map(data.map((p) => [p.id, p])),
      workers: data.filter((p) => p.role === 'worker').sort((a, b) => a.display_name.localeCompare(b.display_name)),
    }),
    [data, error],
  )
}
