import {api} from '@doors/api'
import type {ReactElement, ReactNode} from 'react'
import {createContext, useContext, useEffect, useState} from 'react'

/** Possible states for the optional API health indicator in the app shell. */
export type ApiHealthStatus = 'checking' | 'ok' | 'offline' | 'unknown'

const ApiHealthContext = createContext<ApiHealthStatus>('checking')

/**
 * Polls /health once and shares the result with the app shell and map layers.
 */
export function ApiHealthProvider({children}: {children: ReactNode}): ReactElement {
  const status = useApiHealthPoll()

  return <ApiHealthContext.Provider value={status}>{children}</ApiHealthContext.Provider>
}

/**
 * Reads the shared API health status from context.
 */
export function useApiHealth(): ApiHealthStatus {
  return useContext(ApiHealthContext)
}

/**
 * Polls the backend health endpoint once on mount.
 * Never throws — network failures resolve to `offline`.
 */
function useApiHealthPoll(): ApiHealthStatus {
  const [status, setStatus] = useState<ApiHealthStatus>('checking')

  useEffect(() => {
    // Cancel async updates if the provider unmounts before the request finishes.
    let cancelled = false

    async function checkHealth(): Promise<void> {
      try {
        const {data, error} = await api.health.get()

        if (cancelled) {
          return
        }

        if (error) {
          setStatus('offline')
          return
        }

        setStatus(data?.ok ? 'ok' : 'unknown')
      } catch {
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
