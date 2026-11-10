import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GroupFilter } from '../types';
import { GROUP_COLOURS } from '../sightings';

const CHIPS: { value: GroupFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'duck', label: 'Ducks' },
  { value: 'goose', label: 'Geese' },
  { value: 'coot', label: 'Coots' },
];

interface Props {
  group: GroupFilter;
  search: string;
  onGroup: (g: GroupFilter) => void;
  onSearch: (s: string) => void;
}

export function FilterBar({ group, search, onGroup, onSearch }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {CHIPS.map((c) => {
          const active = c.value === group;
          return (
            <Pressable
              key={c.value}
              onPress={() => onGroup(c.value)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              {c.value !== 'all' && <View style={[styles.swatch, { backgroundColor: GROUP_COLOURS[c.value] }]} />}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={search}
        onChangeText={onSearch}
        placeholder="Search species, e.g. mallard"
        placeholderTextColor="#8a8f98"
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'white', borderRadius: 16, padding: 10, gap: 8, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: '#eef0f3' },
  chipActive: { backgroundColor: '#1b2330' },
  chipText: { fontSize: 15, fontWeight: '600', color: '#1b2330' },
  chipTextActive: { color: 'white' },
  swatch: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'white' },
  search: { fontSize: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#eef0f3', color: '#1b2330' },
});
