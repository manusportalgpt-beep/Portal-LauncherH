import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Settings {
  defaultPlatform: 'modrinth' | 'curseforge';
  notificationSound: boolean;
  uiSounds: boolean;
  masterVolume: number;
  javaPath: string;
  customJvmArgs: string;
  minRam: number;
  maxRam: number;
  curseforgeApiKey: string;
  closeLauncherOnStart: boolean;
  showSnapshots: boolean;
  keepLogs: boolean;
  autoInstallDeps: boolean;
}

interface SettingsState extends Settings {
  update: (partial: Partial<Settings>) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
  get: () => Settings;
}

const defaults: Settings = {
  defaultPlatform: 'modrinth',
  notificationSound: true,
  uiSounds: true,
  masterVolume: 80,
  javaPath: '',
  customJvmArgs: '',
  minRam: 1024,
  maxRam: 4096,
  curseforgeApiKey: '',
  closeLauncherOnStart: false,
  showSnapshots: false,
  keepLogs: true,
  autoInstallDeps: true,
};

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
}

async function syncToRust(key: string, value: unknown): Promise<void> {
  try {
    const { invoke } = await import('@/lib/invoke-shim');
    await invoke('set_setting', { key: camelToSnake(key), value });
  } catch { /* not in Tauri context — dev browser */ }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaults,

      update: (partial) => {
        set((s) => ({ ...s, ...partial }));
        for (const [k, v] of Object.entries(partial)) {
          syncToRust(k, v);
        }
      },

      setSetting: (key, value) => {
        set((s) => ({ ...s, [key]: value }));
        syncToRust(key as string, value);
      },

      reset: () => {
        set(defaults);
        for (const [k, v] of Object.entries(defaults)) {
          syncToRust(k, v);
        }
      },

      get: () => get(),
    }),
    { name: 'portal-settings' }
  )
);
