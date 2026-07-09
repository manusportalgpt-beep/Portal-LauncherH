import { useEffect } from 'react';

export type ThemeId = 'system' | 'light' | 'dark' | 'red-dark' | 'green-dark' | 'purple-dark' | 'pink-dark' | 'pixel' | 'monochrome' | 'glass-white';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  isDark: boolean;
  colors: {
    background: string; surface: string; surfaceHover: string; surfaceActive: string;
    border: string; borderStrong: string;
    text: string; textSecondary: string; textTertiary: string;
    primary: string; primaryHover: string; primaryText: string;
    success: string; warning: string; error: string; info: string;
    curseforge: string; modrinth: string;
  };
  radii: { xs:string; sm:string; md:string; lg:string; xl:string; full:string; button:string; card:string; modal:string; };
  shadows: { sm:string; md:string; lg:string; glow:string; };
  font: string;
}

const accents = {
  success:'#2ECC71', warning:'#F39C12', error:'#E74C3C', info:'#3498DB',
  curseforge:'#F16436', modrinth:'#1BD96A', primaryText:'#FFFFFF',
};
const radii = { xs:'4px', sm:'6px', md:'8px', lg:'12px', xl:'16px', full:'9999px', button:'10px', card:'14px', modal:'20px' };

export const themes: Record<Exclude<ThemeId,'system'>, ThemeDefinition> = {
  light: {
    id:'light', name:'Light', isDark:false,
    colors:{
      background:'#FFFFFF', surface:'#F8F9FA', surfaceHover:'#F1F3F5', surfaceActive:'#E9ECEF',
      border:'#DEE2E6', borderStrong:'#CED4DA', text:'#1A1F26', textSecondary:'#5C6873', textTertiary:'#9AA5B1',
      primary:'#4299E1', primaryHover:'#3182CE', ...accents,
    },
    radii,
    shadows:{ sm:'0 1px 2px rgba(15,23,42,0.06)', md:'0 8px 24px rgba(15,23,42,0.08)', lg:'0 24px 48px rgba(15,23,42,0.12)', glow:'0 0 24px rgba(66,153,225,0.35)' },
    font:"'Inter',system-ui,sans-serif",
  },
  dark: {
    id:'dark', name:'Dark', isDark:true,
    colors:{
      background:'#0D1117', surface:'#161B22', surfaceHover:'#1C2333', surfaceActive:'#21283B',
      border:'#30363D', borderStrong:'#484F58',
      text:'#E6EDF3', textSecondary:'#8B949E', textTertiary:'#6E7681',
      primary:'#4299E1', primaryHover:'#63B3ED', ...accents,
    },
    radii,
    shadows:{ sm:'0 1px 2px rgba(0,0,0,0.3)', md:'0 4px 16px rgba(0,0,0,0.4)', lg:'0 16px 40px rgba(0,0,0,0.6)', glow:'0 0 24px rgba(66,153,225,0.35)' },
    font:"'Inter',system-ui,sans-serif",
  },
  'red-dark': {
    id:'red-dark', name:'Dark Red', isDark:true,
    colors:{
      background:'#0A0606', surface:'#130A0A', surfaceHover:'#1E0F0F', surfaceActive:'#2A1414',
      border:'#3D1818', borderStrong:'#5C2222',
      text:'#FFE8E8', textSecondary:'#D49B9B', textTertiary:'#8A5A5A',
      primary:'#E74C3C', primaryHover:'#EC7063', ...accents,
    },
    radii,
    shadows:{ sm:'0 1px 3px rgba(0,0,0,0.5)', md:'0 4px 16px rgba(231,76,60,0.18)', lg:'0 16px 40px rgba(231,76,60,0.25)', glow:'0 0 28px rgba(231,76,60,0.5)' },
    font:"'Inter',system-ui,sans-serif",
  },
  'green-dark': {
    id:'green-dark', name:'Dark Green', isDark:true,
    colors:{
      background:'#06140C', surface:'#0B1F12', surfaceHover:'#102B19', surfaceActive:'#163920',
      border:'#1E4A2B', borderStrong:'#2E6B3F',
      text:'#E8FFEC', textSecondary:'#8FCC9A', textTertiary:'#4F8059',
      primary:'#1BD96A', primaryHover:'#2EE57C', ...accents,
    },
    radii,
    shadows:{ sm:'0 1px 3px rgba(0,0,0,0.5)', md:'0 4px 16px rgba(27,217,106,0.18)', lg:'0 16px 40px rgba(27,217,106,0.22)', glow:'0 0 28px rgba(27,217,106,0.55)' },
    font:"'Inter',system-ui,sans-serif",
  },
  'purple-dark': {
    id:'purple-dark', name:'Dark Purple', isDark:true,
    colors:{
      background:'#080612', surface:'#0F0B1E', surfaceHover:'#17122E', surfaceActive:'#1F183D',
      border:'#251C4A', borderStrong:'#362866',
      text:'#EDE8FF', textSecondary:'#9880CC', textTertiary:'#65508A',
      primary:'#8B5CF6', primaryHover:'#A78BFA', ...accents,
    },
    radii,
    shadows:{ sm:'0 1px 3px rgba(0,0,0,0.5)', md:'0 4px 16px rgba(139,92,246,0.2)', lg:'0 16px 40px rgba(139,92,246,0.25)', glow:'0 0 32px rgba(139,92,246,0.55)' },
    font:"'Inter',system-ui,sans-serif",
  },
  'pink-dark': {
    id:'pink-dark', name:'Pink Dark', isDark:true,
    colors:{
      background:'#15080F', surface:'#1F0B17', surfaceHover:'#2A1020', surfaceActive:'#36162A',
      border:'#4A1E36', borderStrong:'#6B2A50',
      text:'#FFE8F4', textSecondary:'#D49BB8', textTertiary:'#8A5A75',
      primary:'#E91E63', primaryHover:'#F06292', ...accents,
    },
    radii,
    shadows:{ sm:'0 1px 3px rgba(0,0,0,0.5)', md:'0 4px 16px rgba(233,30,99,0.18)', lg:'0 16px 40px rgba(233,30,99,0.25)', glow:'0 0 28px rgba(233,30,99,0.5)' },
    font:"'Inter',system-ui,sans-serif",
  },
  monochrome: {
    id:'monochrome', name:'Monochrome', isDark:true,
    colors:{
      background:'#0A0A0A', surface:'#141414', surfaceHover:'#1E1E1E', surfaceActive:'#282828',
      border:'#2A2A2A', borderStrong:'#3A3A3A',
      text:'#F0F0F0', textSecondary:'#909090', textTertiary:'#606060',
      primary:'#CCCCCC', primaryHover:'#FFFFFF', ...accents, primaryText:'#000000',
      success:'#2ECC71', warning:'#F39C12', error:'#E74C3C', info:'#3498DB',
    },
    radii,
    shadows:{ sm:'0 1px 2px rgba(0,0,0,0.6)', md:'0 4px 12px rgba(0,0,0,0.7)', lg:'0 16px 40px rgba(0,0,0,0.8)', glow:'0 0 24px rgba(200,200,200,0.2)' },
    font:"'Inter',system-ui,sans-serif",
  },
  pixel: {
    id:'pixel', name:'Pixel', isDark:true,
    colors:{
      background:'#0D1117', surface:'#161B22', surfaceHover:'#1C2333', surfaceActive:'#21283B',
      border:'#30363D', borderStrong:'#484F58',
      text:'#E6EDF3', textSecondary:'#8B949E', textTertiary:'#6E7681',
      primary:'#55FF55', primaryHover:'#77FF77', ...accents, primaryText:'#000000',
    },
    radii:{ xs:'0px', sm:'0px', md:'0px', lg:'0px', xl:'0px', full:'0px', button:'0px', card:'0px', modal:'0px' },
    shadows:{ sm:'3px 3px 0px rgba(0,0,0,0.8)', md:'4px 4px 0px rgba(0,0,0,0.8)', lg:'6px 6px 0px rgba(0,0,0,0.8)', glow:'0 0 0 3px #55FF55' },
    font:"'Press Start 2P','Courier New',monospace",
  },
  'glass-white': {
    id:'glass-white', name:'Glass White', isDark:false,
    colors:{
      background:'#EEF2FA', // fallback if backdrop unsupported
      surface:'rgba(255,255,255,0.55)',
      surfaceHover:'rgba(255,255,255,0.70)',
      surfaceActive:'rgba(255,255,255,0.85)',
      border:'rgba(255,255,255,0.55)', borderStrong:'rgba(255,255,255,0.75)',
      text:'#101828', textSecondary:'#475467', textTertiary:'#98A2B3',
      primary:'#4299E1', primaryHover:'#3182CE', ...accents,
    },
    radii,
    shadows:{
      sm:'0 1px 2px rgba(16,24,40,0.06)',
      md:'0 10px 30px rgba(16,24,40,0.10)',
      lg:'0 24px 60px rgba(16,24,40,0.18)',
      glow:'0 0 32px rgba(255,255,255,0.6)',
    },
    font:"'Inter',system-ui,sans-serif",
  },
};

function resolveSystemTheme(): Exclude<ThemeId,'system'> {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(themeId: ThemeId) {
  const resolved = themeId === 'system' ? resolveSystemTheme() : themeId;
  const t = themes[resolved] ?? themes.dark;
  const r = document.documentElement.style;
  r.setProperty('--color-bg', t.colors.background);
  r.setProperty('--color-surface', t.colors.surface);
  r.setProperty('--color-surface-2', t.colors.surfaceHover);
  r.setProperty('--color-surface-hover', t.colors.surfaceHover);
  r.setProperty('--color-surface-active', t.colors.surfaceActive);
  r.setProperty('--color-border', t.colors.border);
  r.setProperty('--color-border-strong', t.colors.borderStrong);
  r.setProperty('--color-text', t.colors.text);
  r.setProperty('--color-text-secondary', t.colors.textSecondary);
  r.setProperty('--color-text-tertiary', t.colors.textTertiary);
  r.setProperty('--color-primary', t.colors.primary);
  r.setProperty('--color-primary-hover', t.colors.primaryHover);
  r.setProperty('--color-primary-dim', t.colors.primary + '26');
  r.setProperty('--color-primary-text', t.colors.primaryText);
  r.setProperty('--color-success', t.colors.success);
  r.setProperty('--color-warning', t.colors.warning);
  r.setProperty('--color-error', t.colors.error);
  r.setProperty('--color-info', t.colors.info);
  r.setProperty('--color-curseforge', t.colors.curseforge);
  r.setProperty('--color-modrinth', t.colors.modrinth);
  r.setProperty('--radius-xs', t.radii.xs);
  r.setProperty('--radius-sm', t.radii.sm);
  r.setProperty('--radius-md', t.radii.md);
  r.setProperty('--radius-lg', t.radii.lg);
  r.setProperty('--radius-xl', t.radii.xl);
  r.setProperty('--radius-full', t.radii.full);
  r.setProperty('--radius-button', t.radii.button);
  r.setProperty('--radius-card', t.radii.card);
  r.setProperty('--radius-modal', t.radii.modal);
  r.setProperty('--shadow-sm', t.shadows.sm);
  r.setProperty('--shadow-md', t.shadows.md);
  r.setProperty('--shadow-lg', t.shadows.lg);
  r.setProperty('--shadow-glow', t.shadows.glow);
  r.setProperty('--font-ui', t.font);
  document.documentElement.classList.toggle('dark', t.isDark);
  document.documentElement.dataset.theme = resolved;
}

export function useTheme(themeId: ThemeId) {
  useEffect(() => {
    applyTheme(themeId);
    if (themeId !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => applyTheme('system');
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
  }, [themeId]);
}
