import { NavLink } from 'react-router-dom';
import { Compass, Library, Users, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const items = [
  { label: 'nav.discover', to: '/discover', icon: Compass },
  { label: 'nav.library', to: '/library', icon: Library },
  { label: 'nav.friends', to: '/friends', icon: Users },
  { label: 'nav.settings', to: '/settings', icon: Settings }
];

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="w-72 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-6 px-3 py-4 rounded-2xl bg-[var(--color-surface-hover)] shadow-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-text-secondary)]">Portal Launcher</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">Portal</h1>
      </div>
      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                  isActive ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {t(item.label)}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
