import type {ReactElement} from 'react'
import {useEffect, useState} from 'react'
import {StatusBar} from 'react-native'
import {SafeAreaProvider} from 'react-native-safe-area-context'

import {AppShell} from '@/components/AppShell'
import {Box} from '@/components/ui/box'
import {GluestackUIProvider} from '@/components/ui/gluestack-ui-provider'
import {Text} from '@/components/ui/text'
import {ApiHealthProvider, type ApiHealthStatus, useApiHealth} from '@/contexts/ApiHealthContext'
import {useMapAppearance} from '@/hooks/useMapAppearance'

import './global.css'

/**
 * Root application shell: optional API status banner plus map shell with navigation.
 * Renders the map even when the backend is unreachable.
 */
export default function App(): ReactElement {
  return (
    <ApiHealthProvider>
      <AppContent />
    </ApiHealthProvider>
  )
}

/** Inner app content that reads shared API health from context. */
function AppContent(): ReactElement {
  const healthStatus = useApiHealth()
  const appearance = useMapAppearance()
  const [bannerVisible, setBannerVisible] = useState(true)

  useEffect(() => {
    if (healthStatus !== 'offline') {
      return
    }

    const timeoutId = setTimeout(() => {
      setBannerVisible(false)
    }, 4000)

    return (): void => {
      clearTimeout(timeoutId)
    }
  }, [healthStatus])

  const showBanner = bannerVisible && (healthStatus === 'checking' || healthStatus === 'offline')

  return (
    <GluestackUIProvider mode={appearance}>
      <SafeAreaProvider>
        <Box className="flex-1 web:min-h-full">
          <StatusBar barStyle={appearance === 'dark' ? 'light-content' : 'dark-content'} />
          {showBanner ? (
            <Box
              className={`px-3 py-1.5 ${healthStatus === 'offline' ? 'bg-red-900' : 'bg-gray-900'}`}>
              <Text className="text-xs font-semibold text-gray-50">
                API: {formatHealthStatus(healthStatus)}
              </Text>
            </Box>
          ) : null}
          <AppShell />
        </Box>
      </SafeAreaProvider>
    </GluestackUIProvider>
  )
}

/** Human-readable label for the dev health banner. */
function formatHealthStatus(status: ApiHealthStatus): string {
  switch (status) {
    case 'checking':
      return 'checking…'
    case 'ok':
      return 'ok'
    case 'offline':
      return 'offline'
    case 'unknown':
      return 'unknown'
  }
}
