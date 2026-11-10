# Migratory: Waterfowl Maps

Bird migration, snow & ice. One screen: a map of recent duck, goose and coot sightings near you.

Expo (React Native, TypeScript) + MapLibre + Supabase. Lives in this folder and is separate from the
Peasant's Life game in the repo root.

## Build order

- [x] 1. Map on user location
- [x] 2. Sighting dots from eBird (via Supabase function)
- [x] 3. Filter + tap-a-dot
- [ ] 4. Snow/freeze line (NOAA IMS)
- [ ] 5. Push forecast banner
- [ ] 6. Alerts + paywall (RevenueCat, Expo Notifications)

Steps 1–3 are written, typecheck, pass tests and bundle for Android. **They have not been run on a
real phone yet.** Do that before starting step 4.

## What's here

| Path | What it does |
|---|---|
| `App.tsx` | The map screen: location, dots, tap card, filter bar |
| `src/sightings.ts` | Filtering, dot colours, "how many / when" labels |
| `src/api.ts` | Calls the Supabase function (no API keys in the app) |
| `supabase/functions/sightings` | Edge function: pulls eBird, keeps only waterfowl |
| `supabase/functions/_shared/waterfowl.ts` | Sorts eBird taxonomy into ducks / geese / coots |

Species come from the eBird taxonomy at run time: family Anatidae (swans count as geese) plus coots
(genus *Fulica*). Nothing is hardcoded except which genera count as geese.

Dots: blue = ducks, grey = geese & swans, black = coots. Radius 50 km, last 7 days.

## Setup

### 1. Backend (Supabase)

1. Get an eBird API key: https://ebird.org/api/keygen
2. Create a Supabase project, then from this folder:
   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase secrets set EBIRD_API_KEY=your-ebird-key
   npx supabase functions deploy sightings
   ```
3. Test it:
   ```sh
   curl "https://YOUR-PROJECT.supabase.co/functions/v1/sightings?lat=49.9&lng=-97.1" \
     -H "Authorization: Bearer YOUR-ANON-KEY"
   ```

### 2. App

```sh
cp .env.example .env   # fill in your Supabase URL and anon key (both are public)
npm install
```

MapLibre has native code, so **Expo Go won't work**. Use a development build:

```sh
npx expo run:android          # phone plugged in by USB, or
npx eas build --profile development --platform android   # cloud build, install the APK
npx expo start --dev-client   # then open the dev build on the phone
```

iOS is the same with `ios` (needs a Mac for `run:ios`, or EAS).

### Phone check for steps 1–3

- [ ] Opens straight to the map, asks for location once, centres on you
- [ ] Dots appear within ~50 km, in the right colours
- [ ] Tapping a dot shows species, how many, when; tapping the map closes it
- [ ] All / Ducks / Geese / Coots chips filter the dots
- [ ] Typing "mallard" shows only mallards
- [ ] Location denied: map still opens and says to turn location on

## Checks

```sh
npm test            # unit tests (Vitest)
npm run typecheck
npx expo-doctor
```

## Before launch

- **eBird licence:** commercial use (the paid tier) needs written permission from the Cornell Lab.
  Ask before turning on the paywall. "Sightings: eBird.org" credit is already on screen.
- Map tiles: OpenFreeMap (OpenStreetMap data), free with no key. Attribution is shown by MapLibre.

## Not in v1

Flyways, tracked birds, radar, regulations, shooting hours, user reports, songbird mode, accounts.
