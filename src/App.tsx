import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { Placeholder } from './pages/Placeholder';
import { ThemeProvider } from './lib/theme';

// Hash routing: every screen loads from the cached index.html, even offline and on any host.
export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="prep" element={<Placeholder title="Prep lists" phase={2} items={['Location profile (zone, frost dates, winter low)', 'Food calculator (kcal, macros, pails)', 'Water calculator', 'Seeds, supplies, hunting & defence (phase 3)']} />} />
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
