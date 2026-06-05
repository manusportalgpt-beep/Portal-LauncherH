import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SplashScreen } from '@/components/splash/SplashScreen';
import { MainLayout } from '@/components/layout/MainLayout';
import { DiscoverPage } from '@/pages/DiscoverPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { InstancesPage } from '@/pages/InstancesPage';
import { FriendsPage } from '@/pages/FriendsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { InstanceSettings } from '@/pages/InstanceSettings';
import { ModDetail } from '@/pages/ModDetail';
import { useThemeStore } from '@/stores/themeStore';
import { useTheme } from '@/lib/theme-engine';

function App() {
  const [loading, setLoading] = useState(true);
  const themeId = useThemeStore((state) => state.themeId);
  const { t } = useTranslation();

  useTheme(themeId);

  useEffect(() => {
    const timeout = window.setTimeout(() => setLoading(false), 1600);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <AnimatePresence>{loading ? <SplashScreen onComplete={() => setLoading(false)} /> : null}</AnimatePresence>
      {!loading && (
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/discover" replace />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/discover/:source/:modId" element={<ModDetail />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/instances" element={<InstancesPage />} />
            <Route path="/instances/:id/settings" element={<InstanceSettings />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/:section" element={<SettingsPage />} />
          </Routes>
        </MainLayout>
      )}
    </div>
  );
}

export default App;
