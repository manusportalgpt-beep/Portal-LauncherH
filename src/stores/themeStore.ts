import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeId = 'light' | 'dark' | 'red-dark' | 'green-dark' | 'purple-dark' | 'pink-dark' | 'pixel';

interface ThemeState {
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: 'dark',
      setTheme: (themeId) => set({ themeId })
    }),
    { name: 'portal-launcher-theme' }
  )
);
