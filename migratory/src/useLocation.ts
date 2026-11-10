import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type LocationState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'ready'; lat: number; lng: number };

/** Asks for location once and returns where the user is. */
export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setState({ status: 'denied' });
        return;
      }
      // Show a quick last-known fix first, then refine.
      const last = await Location.getLastKnownPositionAsync();
      if (last && !cancelled) setState({ status: 'ready', lat: last.coords.latitude, lng: last.coords.longitude });
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) setState({ status: 'ready', lat: pos.coords.latitude, lng: pos.coords.longitude });
    })().catch(() => {
      if (!cancelled) setState({ status: 'denied' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
