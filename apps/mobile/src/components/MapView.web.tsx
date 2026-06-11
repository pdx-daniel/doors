import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {useEffect, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  LIBERTY_STYLE_URL,
} from '../constants/map';

/**
 * Web map renderer backed by maplibre-gl v5.
 * Attaches MapLibre to the DOM node behind an RN-web `View` ref.
 */
export function MapView() {
  const hostRef = useRef<View>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    // RN-web exposes the underlying DOM element through the View ref.
    const hostElement = hostRef.current as unknown as HTMLDivElement | null;
    if (!hostElement || mapRef.current) {
      return;
    }

    // Create the MapLibre instance against the host DOM node.
    const map = new maplibregl.Map({
      container: hostElement,
      style: LIBERTY_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    mapRef.current = map;

    // Resize once tiles load in case layout settled after first paint.
    map.once('load', () => {
      map.resize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <View ref={hostRef} style={styles.map} />;
}

/** Layout for a map that fills all space offered by its parent. */
const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
