import { useEffect } from 'react';

export interface ThemeDefinition {
  id: string;
  name: string;
  isDark: boolean;
  colors: Record<string, string>;
}

const themes: Record<string, ThemeDefinition> = {
  dark: {
    id: 'dark',
    name: 'Dark',
    isDark: true,
    colors: {
      background: '#0D1117',
      surface: '#161B22',
      surfaceHover: '#1C2333',
      text: '#E6EDF3',
      textSecondary: '#8B949E',
      primary: '#6C5CE7',
      primaryText: '#FFFFFF',
      border: '#30363D'
    }
  },
  light: {
    id: 'light',
    name: 'Light',
    isDark: false,
    colors: {
      background: '#FFFFFF',
      surface: '#F8F9FA',
      surfaceHover: '#F1F3F5',
      text: '#212529',
      textSecondary: '#6C757D',
      primary: '#6C5CE7',
      primaryText: '#FFFFFF',
      border: '#DEE2E6'
    }
  }
};

export function applyTheme(themeId: string) {
  const theme = themes[themeId] || themes.dark;
  const root = document.documentElement;

  root.style.setProperty('--color-bg', theme.colors.background);
  root.style.setProperty('--color-surface', theme.colors.surface);
  root.style.setProperty('--color-surface-hover', theme.colors.surfaceHover);
  root.style.setProperty('--color-text', theme.colors.text);
  root.style.setProperty('--color-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--color-primary', theme.colors.primary);
  root.style.setProperty('--color-primary-text', theme.colors.primaryText);
  root.style.setProperty('--color-border', theme.colors.border);
}

export function useTheme(themeId: string) {
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);
}
