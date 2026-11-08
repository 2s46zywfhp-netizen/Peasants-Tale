import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { PrepHub } from './pages/prep/PrepHub';
import { LocationPage } from './pages/prep/Location';
import { HouseholdPage } from './pages/prep/Household';
import { FoodPage } from './pages/prep/Food';
import { WaterPage } from './pages/prep/Water';
import { SeedsPage } from './pages/prep/Seeds';
import { SuppliesPage } from './pages/prep/Supplies';
import { HuntingPage } from './pages/prep/Hunting';
import { StockPage } from './pages/Stock';
import { GuideHome, SectionPage, EntryPage, PrintGuide, CalendarPage } from './pages/guide/GuidePages';
import { ImportPage, MyEntries, UserEntryPage } from './pages/guide/UserGuide';
import { JournalList, JournalEntryPage, GardenPage } from './pages/journal/JournalPages';
import { MapPage } from './pages/journal/MapPage';
import { HelpPage } from './pages/Help';
import { CreditsPage } from './pages/Credits';
import { ThemeProvider } from './lib/theme';

// Hash routing: every screen loads from the cached index.html, even offline and on any host.
export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="prep" element={<PrepHub />} />
            <Route path="prep/location" element={<LocationPage />} />
            <Route path="prep/household" element={<HouseholdPage />} />
            <Route path="prep/food" element={<FoodPage />} />
            <Route path="prep/water" element={<WaterPage />} />
            <Route path="prep/seeds" element={<SeedsPage />} />
            <Route path="prep/supplies" element={<SuppliesPage />} />
            <Route path="prep/hunting" element={<HuntingPage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="guide" element={<GuideHome />} />
            <Route path="guide/s/:id" element={<SectionPage />} />
            <Route path="guide/e/:id" element={<EntryPage />} />
            <Route path="guide/print/:id" element={<PrintGuide />} />
            <Route path="guide/calendar" element={<CalendarPage />} />
            <Route path="guide/import" element={<ImportPage />} />
            <Route path="guide/mine" element={<MyEntries />} />
            <Route path="guide/mine/:id" element={<UserEntryPage />} />
            <Route path="journal" element={<JournalList />} />
            <Route path="journal/map" element={<MapPage />} />
            <Route path="journal/garden" element={<GardenPage />} />
            <Route path="journal/:id" element={<JournalEntryPage />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="credits" element={<CreditsPage />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
