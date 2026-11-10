import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Sighting } from '../types';
import { countLabel, GROUP_COLOURS, whenLabel } from '../sightings';

export function SightingCard({ sighting, onClose }: { sighting: Sighting; onClose: () => void }) {
  return (
    <Pressable onPress={onClose} style={styles.card} accessibilityHint="Tap to close">
      <View style={[styles.dot, { backgroundColor: GROUP_COLOURS[sighting.group] }]} />
      <View style={styles.body}>
        <Text style={styles.name}>{sighting.name}</Text>
        <Text style={styles.line}>
          {countLabel(sighting.count)} · {whenLabel(sighting.when, new Date())}
        </Text>
      </View>
      <Text style={styles.close}>✕</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 16, padding: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'white' },
  body: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', color: '#1b2330' },
  line: { fontSize: 15, color: '#4a5260', marginTop: 2 },
  close: { fontSize: 18, color: '#8a8f98', paddingHorizontal: 4 },
});
