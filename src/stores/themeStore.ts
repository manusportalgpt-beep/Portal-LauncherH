import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeId } from '@/lib/theme-engine';

interface ThemeState {
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: 'system',
      setTheme: (themeId) => set({ themeId })
    }),
    { name: 'portal-launcher-theme' }
  )
);
