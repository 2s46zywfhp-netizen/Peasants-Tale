import { useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../lib/theme';
import { useOnline } from '../lib/useOnline';
import { IconBook, IconBox, IconEye, IconGear, IconHome, IconList, IconMoon, IconPen, IconSun } from './Icons';
import { UpdateBanner } from './UpdateBanner';

const TABS = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/prep', label: 'Prep', Icon: IconList },
  { to: '/stock', label: 'Stock', Icon: IconBox },
  { to: '/guide', label: 'Guide', Icon: IconBook },
  { to: '/journal', label: 'Journal', Icon: IconPen },
];

export function Layout() {
  const { theme, cycleTheme } = useTheme();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const online = useOnline();
  const ThemeIcon = theme === 'light' ? IconSun : theme === 'dark' ? IconMoon : IconEye;
  const themeName = theme === 'light' ? 'Sun' : theme === 'dark' ? 'Dark' : 'Night';

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header
        className="no-print sticky top-0 z-10 flex items-center gap-2 border-b-2 border-line bg-bg px-3"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Link to="/" className="mr-auto py-2 text-xl font-extrabold tracking-wide">
          NORTH<span className="text-accent">PREP</span>
        </Link>
        <span
          className={`rounded border-2 px-2 py-0.5 text-sm font-bold ${online ? 'border-ok text-ok' : 'border-accent text-accent'}`}
          role="status"
        >
          {online ? 'ONLINE' : 'OFFLINE'}
        </span>
        <button type="button" className="btn px-2" onClick={cycleTheme} aria-label={`Display mode: ${themeName}. Tap to change.`}>
          <ThemeIcon />
        </button>
        <NavLink to="/settings" className="btn px-2" aria-label="Settings and backup">
          <IconGear />
        </NavLink>
      </header>

      <UpdateBanner />

      <main className="mx-auto w-full max-w-2xl flex-1 p-4 pb-28">
        <Outlet />
      </main>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t-2 border-line bg-bg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main"
      >
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-[4rem] flex-col items-center justify-center gap-0.5 text-sm font-bold ${isActive ? 'bg-accent text-accent-ink' : 'text-ink'}`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
