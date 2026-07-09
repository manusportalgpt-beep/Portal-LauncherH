import { useEffect, useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SplashScreen } from '@/components/splash/SplashScreen';
import { MainLayout } from '@/components/layout/MainLayout';
import { HomePage } from '@/pages/HomePage';
import { DiscoverPage } from '@/pages/DiscoverPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { InstancesPage } from '@/pages/InstancesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { InstanceSettings } from '@/pages/InstanceSettings';
import { ModDetail } from '@/pages/ModDetail';
import { SkinSelectorPage } from '@/pages/SkinSelectorPage';
import { GalleryPage } from '@/pages/GalleryPage';
import { FindProjectsPage } from '@/pages/FindProjectsPage';
import { useThemeStore } from '@/stores/themeStore';
import { useTheme } from '@/lib/theme-engine';
import { DownloadProgressOverlay } from '@/components/DownloadProgress';
import { useNotifStore } from '@/stores/notificationStore';
import { useInstanceStore } from '@/stores/instanceStore';
import { useAuthStore } from '@/stores/authStore';
import { loadAuthFromRust } from '@/lib/auth-loader';

const WELCOME_KEY = 'portal-welcome-shown';

function App() {
  const [loading, setLoading] = useState(true);
  const themeId = useThemeStore((state) => state.themeId);
  useTheme(themeId);
  const addNotif = useNotifStore(s => s.add);
  const instances = useInstanceStore(s => s.instances);
  const hasLoadedAuth = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setLoading(false), 1800);
    return () => window.clearTimeout(timeout);
  }, []);

  // Load auth from Rust (auth.json) on first app launch ONLY
  useEffect(() => {
    if (hasLoadedAuth.current) return; // Prevent multiple calls
    hasLoadedAuth.current = true;

    loadAuthFromRust().catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Welcome notification — shown once when there are no instances
  useEffect(() => {
    if (loading) return;
    const shown = localStorage.getItem(WELCOME_KEY);
    if (!shown && instances.length === 0) {
      localStorage.setItem(WELCOME_KEY, '1');
      addNotif({
        type: 'system',
        title: 'Welcome to Portal Launcher!',
        body: 'Thank you for installing Portal Launcher. We\'re glad you\'ll be using it — enjoy!',
      });
    }
  }, [loading]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <AnimatePresence>
        {loading ? <SplashScreen onComplete={() => setLoading(false)} /> : null}
      </AnimatePresence>
      {!loading && (
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/discover/:source/:modId" element={<ModDetail />} />
            <Route path="/find-projects" element={<FindProjectsPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/instances" element={<InstancesPage />} />
            <Route path="/instances/:id/settings" element={<InstanceSettings />} />
            <Route path="/skins" element={<SkinSelectorPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/:section" element={<SettingsPage />} />
          </Routes>
          <DownloadProgressOverlay />
        </MainLayout>
      )}
    </div>
  );
}

export default App;
