import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Library, User, Settings, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  color: string;
  color2: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/home',     icon: Home,     label: 'Home',     color: '#8B5CF6', color2: '#C084FC', end: true },
  { to: '/discover', icon: Compass,  label: 'Discover', color: '#22D3EE', color2: '#67E8F9' },
  { to: '/library',  icon: Library,  label: 'Library',  color: '#F472B6', color2: '#F9A8D4' },
  { to: '/skins',    icon: User,     label: 'Skin',     color: '#38BDF8', color2: '#7DD3FC' },
  { to: '/settings', icon: Settings, label: 'Settings', color: '#A78BFA', color2: '#DDD6FE' },
];

function Pedestal({ color, color2, active }: { color: string; color2: string; active: boolean }) {
  return (
    <div className="relative flex flex-col items-center justify-end" style={{ width: 52, height: 54 }}>
      <div
        className="absolute inset-x-0 bottom-0 h-2.5 rounded-full blur-lg"
        style={{ background: active ? `${color}90` : `${color2}55` }}
      />
      <div
        className="relative flex items-center justify-center rounded-2xl border transition-all"
        style={{
          width: 44,
          height: 44,
          background: active ? `linear-gradient(180deg, ${color}15, ${color2}08)` : `rgba(255,255,255,0.06)`,
          borderColor: active ? `${color}55` : 'rgba(255,255,255,0.1)',
          boxShadow: active ? `0 0 22px ${color}33` : '0 0 0 1px rgba(255,255,255,0.05)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `radial-gradient(circle at top, ${color}55, transparent 45%)`,
            opacity: active ? 1 : 0.55,
          }}
        />
      </div>
    </div>
  );
}

function PedestalButton({ item }: { item: NavItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      data-testid={`nav-${item.label.toLowerCase()}`}
      className="group relative flex items-center justify-center"
      style={{ width: 58, height: 62 }}
    >
      {({ isActive }) => (
        <motion.div
          className="relative flex flex-col items-center justify-center"
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          <Pedestal color={item.color} color2={item.color2} active={isActive} />
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-2xl"
            style={{
              top: 6,
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))',
              border: `1px solid ${isActive ? item.color : 'rgba(255,255,255,0.22)'}`,
              backdropFilter: 'blur(14px) saturate(160%)',
              WebkitBackdropFilter: 'blur(14px) saturate(160%)',
              boxShadow: isActive
                ? `0 0 18px ${item.color}33, inset 0 1px 0 rgba(255,255,255,0.4)`
                : `0 3px 10px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)`,
              transition: 'all 0.25s ease',
            }}
          >
            <Icon
              size={16}
              strokeWidth={2}
              style={{
                color: isActive ? '#fff' : item.color2,
                filter: isActive ? `drop-shadow(0 0 6px ${item.color})` : 'none',
              }}
            />
          </div>
          <span
            className="absolute text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
            style={{
              top: 50,
              color: '#FFFFFF',
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            {item.label}
          </span>
        </motion.div>
      )}
    </NavLink>
  );
}

export function TopNav() {
  const [open, setOpen] = useState(false);

  return (
    // Fixed overlay hover zone at the very top. It doesn't push content anymore.
    <div
      className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center"
      style={{ pointerEvents: 'none' }}
    >
      {/* Hover trigger zone — spans the width of the dock area at the top edge */}
      <div
        className="flex flex-col items-center"
        style={{ pointerEvents: 'auto' }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {/* Small white indicator bar, visible while the dock is hidden */}
        <AnimatePresence>
          {!open && (
            <motion.div
              key="handle"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="rounded-full"
              style={{
                marginTop: 6,
                width: 46,
                height: 5,
                background: 'rgba(255,255,255,0.55)',
                boxShadow: '0 0 10px rgba(255,255,255,0.35)',
              }}
            />
          )}
        </AnimatePresence>

        {/* The dock itself — slides down from behind the top edge on hover */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="dock"
              initial={{ opacity: 0, y: -90 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -90 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="flex items-center gap-2 px-3 py-2 rounded-3xl"
              style={{
                marginTop: 10,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))',
                border: '1px solid rgba(255,255,255,0.16)',
                backdropFilter: 'blur(22px) saturate(180%)',
                WebkitBackdropFilter: 'blur(22px) saturate(180%)',
                boxShadow: '0 14px 38px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
              }}
            >
              {NAV.map((item) => (
                <PedestalButton key={item.to} item={item} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TopNav;
