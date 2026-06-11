import type {ReactElement} from 'react'
import {useEffect, useState} from 'react'
import {Platform, StatusBar, StyleSheet, Text, View} from 'react-native'

import type {ApiHealthStatus} from './src/hooks/useApiHealth'
import {useApiHealth} from './src/hooks/useApiHealth'
import {useMapAppearance} from './src/hooks/useMapAppearance'
import {MapScreen} from './src/screens/MapScreen'

/**
 * Root application shell: optional API status banner plus full-screen map.
 * Renders the map even when the backend is unreachable.
 */
export default function App(): ReactElement {
  const healthStatus = useApiHealth()
  const appearance = useMapAppearance()
  const [bannerVisible, setBannerVisible] = useState(true)

  useEffect(() => {
    // Hide the offline banner after a few seconds so it does not obscure the map.
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
    <View style={styles.container}>
      <StatusBar barStyle={appearance === 'dark' ? 'light-content' : 'dark-content'} />
      {showBanner ? (
        <View
          style={[
            styles.banner,
            healthStatus === 'offline' ? styles.bannerOffline : styles.bannerChecking,
          ]}>
          <Text style={styles.bannerText}>API: {formatHealthStatus(healthStatus)}</Text>
        </View>
      ) : null}
      <MapScreen />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bannerChecking: {
    backgroundColor: '#111827',
  },
  bannerOffline: {
    backgroundColor: '#7f1d1d',
  },
  bannerText: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    ...(Platform.OS === 'web' ? {minHeight: '100%'} : {}),
  },
})

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
