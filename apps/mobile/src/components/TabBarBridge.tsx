import type {BottomTabBarProps} from '@react-navigation/bottom-tabs'
import type {ReactElement} from 'react'
import {useEffect, useRef} from 'react'

type TabBarBridgeProps = {
  props: BottomTabBarProps
  onChange: (props: BottomTabBarProps) => void
}

/**
 * Publishes bottom-tab bar props to AppShell without rendering the bar in-tree.
 */
export function TabBarBridge({props, onChange}: TabBarBridgeProps): ReactElement | null {
  const propsRef = useRef(props)
  const publishedKeyRef = useRef<string | null>(null)
  const tabStateKey = `${props.state.key}:${props.state.index}`

  propsRef.current = props

  useEffect(() => {
    const currentProps = propsRef.current

    // Avoid setState loops when React Navigation re-renders with fresh prop objects.
    if (publishedKeyRef.current === tabStateKey) {
      return
    }

    publishedKeyRef.current = tabStateKey
    onChange(currentProps)
  }, [onChange, tabStateKey])

  return null
}
