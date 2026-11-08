import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { Placeholder } from './pages/Placeholder';
import { PrepHub } from './pages/prep/PrepHub';
import { LocationPage } from './pages/prep/Location';
import { HouseholdPage } from './pages/prep/Household';
import { FoodPage } from './pages/prep/Food';
import { WaterPage } from './pages/prep/Water';
import { SeedsPage } from './pages/prep/Seeds';
import { SuppliesPage } from './pages/prep/Supplies';
import { HuntingPage } from './pages/prep/Hunting';
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
            <Route path="stock" element={<Placeholder title="Stock & rotation" phase={4} items={['On hand vs. targets', 'Expiry and FIFO alerts', 'Use-this-month list']} />} />
            <Route path="guide" element={<Placeholder title="Field guide" phase={5} items={['Foraging with lookalikes on the same screen', 'Winter shelter, fire, water, navigation', 'Cold injuries, wound care, ice safety']} />} />
            <Route path="journal" element={<Placeholder title="Journal" phase={6} items={['Dated logs with photos and GPS', 'Offline map pins, PIN-locked caches', 'Garden log, year over year']} />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
