import { Camera, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { backendConfigured, fetchSightings } from './src/api';
import { FilterBar } from './src/components/FilterBar';
import { SightingCard } from './src/components/SightingCard';
import { filterSightings, toFeatureCollection } from './src/sightings';
import type { GroupFilter, Sighting } from './src/types';
import { useLocation } from './src/useLocation';

// Free OpenStreetMap vector tiles, no key needed.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
// Middle of North America, used only until we know where the user is.
const FALLBACK_CENTER: [number, number] = [-97, 45];

export default function App() {
  return (
    <SafeAreaProvider>
      <MapScreen />
    </SafeAreaProvider>
  );
}

function MapScreen() {
  const location = useLocation();
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Rounded so the last-known fix and the fresh fix don't fetch twice.
  const lat = location.status === 'ready' ? Number(location.lat.toFixed(2)) : null;
  const lng = location.status === 'ready' ? Number(location.lng.toFixed(2)) : null;

  useEffect(() => {
    if (lat === null || lng === null || !backendConfigured) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSightings(lat, lng)
      .then((list) => !cancelled && setSightings(list))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const visible = useMemo(() => filterSightings(sightings, group, search), [sightings, group, search]);
  const shapes = useMemo(() => toFeatureCollection(visible), [visible]);
  const selected = visible.find((s) => s.id === selectedId) ?? null;

  const center: [number, number] =
    location.status === 'ready' ? [location.lng, location.lat] : FALLBACK_CENTER;

  const notice =
    location.status === 'denied'
      ? 'Turn on location to see birds near you.'
      : !backendConfigured
        ? 'Sightings backend not set up yet.'
        : error
          ? error
          : !loading && location.status === 'ready' && visible.length === 0
            ? sightings.length === 0
              ? 'No waterfowl reported within 50 km this week.'
              : 'No matches for this filter.'
            : null;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE}
        compass={false}
        attributionPosition={{ bottom: 8, left: 8 }}
        logo={false}
        onPress={() => setSelectedId(null)}
      >
        <Camera center={center} zoom={location.status === 'ready' ? 9 : 3} duration={600} />
        {location.status === 'ready' && <UserLocation />}
        <GeoJSONSource
          id="sightings"
          data={shapes}
          hitbox={{ top: 12, right: 12, bottom: 12, left: 12 }}
          onPress={(e) => {
            const id = e.nativeEvent.features[0]?.properties?.id;
            if (typeof id === 'string') setSelectedId(id);
          }}
        >
          <Layer
            id="sighting-dots"
            type="circle"
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 12, 8],
              'circle-color': ['get', 'colour'],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.5,
            }}
          />
        </GeoJSONSource>
      </Map>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none" edges={['top', 'bottom']}>
        <View style={styles.top} pointerEvents="box-none">
          {(loading || location.status === 'loading') && (
            <View style={styles.pill}>
              <ActivityIndicator size="small" />
              <Text style={styles.pillText}>{location.status === 'loading' ? 'Finding you…' : 'Loading sightings…'}</Text>
            </View>
          )}
          {notice && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{notice}</Text>
            </View>
          )}
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          {selected && <SightingCard sighting={selected} onClose={() => setSelectedId(null)} />}
          <FilterBar group={group} search={search} onGroup={setGroup} onSearch={setSearch} />
          <Text style={styles.credit}>Sightings: eBird.org</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#dfe6ec' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'space-between' },
  top: { paddingHorizontal: 16, paddingTop: 8, gap: 8, alignItems: 'center' },
  bottom: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'white', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
  pillText: { fontSize: 14, color: '#1b2330', fontWeight: '500' },
  credit: { fontSize: 11, color: '#4a5260', textAlign: 'right' },
});
