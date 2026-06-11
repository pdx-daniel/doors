import {api} from '@doors/api'
import {useEffect, useState} from 'react'

/** Possible states for the optional API health indicator in the app shell. */
export type ApiHealthStatus = 'checking' | 'ok' | 'offline' | 'unknown'

/**
 * Polls the backend health endpoint once on mount.
 * Never throws — network failures and Eden errors resolve to `offline`.
 */
export function useApiHealth(): ApiHealthStatus {
  const [status, setStatus] = useState<ApiHealthStatus>('checking')

  useEffect(() => {
    // Cancel async updates if the component unmounts before the request finishes.
    let cancelled = false

    async function checkHealth(): Promise<void> {
      try {
        // Ask Eden for the typed /health response.
        const {data, error} = await api.health.get()

        // Ignore stale responses after unmount.
        if (cancelled) {
          return
        }

        // Eden reports transport or HTTP-layer failures via `error`.
        if (error) {
          setStatus('offline')
          return
        }

        // Treat a successful body with `ok: true` as healthy.
        setStatus(data?.ok ? 'ok' : 'unknown')
      } catch {
        // Fetch can throw when the server is down or the device is offline.
        if (!cancelled) {
          setStatus('offline')
        }
      }
    }

    void checkHealth()

    return (): void => {
      cancelled = true
    }
  }, [])

  return status
}
