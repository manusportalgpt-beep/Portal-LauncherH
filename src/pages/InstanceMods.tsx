import { useEffect, useState } from 'react';
import { invoke } from '@/lib/invoke-shim';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Package, Image, Sparkles, Database } from 'lucide-react';

type ModEntry = {
  id: string;
  name: string;
  fileName?: string;
  icon?: string;
  path?: string;
  installedVersion?: string;
  latestVersion?: string;
  type?: string;
  updateAvailable?: boolean;
  mod_type?: string;
};

type TabType = 'mods' | 'resourcepacks' | 'shaders' | 'datapacks';

const TABS: { id: TabType; label: string; icon: any }[] = [
  { id: 'mods', label: 'Mods', icon: Package },
  { id: 'resourcepacks', label: 'Resource Packs', icon: Image },
  { id: 'shaders', label: 'Shaders', icon: Sparkles },
  { id: 'datapacks', label: 'Data Packs', icon: Database },
];

function getModTypeFilter(tab: TabType): string {
  switch (tab) {
    case 'mods': return 'mod';
    case 'resourcepacks': return 'resourcepack';
    case 'shaders': return 'shaderpack';
    case 'datapacks': return 'datapack';
    default: return 'mod';
  }
}

export function InstanceMods({ instanceId }: { instanceId: string }) {
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, { percent: number; message?: string }>>({});
  const [activeTab, setActiveTab] = useState<TabType>('mods');

  useEffect(() => {
    loadMods();
    const unsubs: UnlistenFn[] = [];
    (async () => {
      const u1 = await listen('download-progress', (e: any) => {
        try {
          const p = e.payload as any;
          if (!p) return;
          const id = p.id || p.modId || 'global';
          setProgressMap(prev => ({ ...prev, [id]: { percent: Math.floor((p.downloaded / Math.max(1, p.total || 1)) * 100), message: p.message || p.status || '' } }));
        } catch {}
      });
      unsubs.push(u1);

      const u2 = await listen('install-progress', (e: any) => {
        try {
          const p = e.payload as any;
          const id = p.id || p.modId || 'global';
          setProgressMap(prev => ({ ...prev, [id]: { percent: p.percent || 0, message: p.message || '' } }));
        } catch {}
      });
      unsubs.push(u2);

      const u3 = await listen('download-complete', (e: any) => {
        try {
          const p = e.payload as any;
          const id = p.id || p.modId || 'global';
          setProgressMap(prev => ({ ...prev, [id]: { percent: 100, message: 'Completed' } }));
          loadMods();
        } catch {}
      });
      unsubs.push(u3);
    })();
    return () => { unsubs.forEach(u => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  async function loadMods() {
    setLoading(true);
    setError(null);
    try {
      const res = (await invoke('get_instance_mods', { instanceId })) as ModEntry[] | string;
      if (typeof res === 'string') {
        setError(res);
        setMods([]);
      } else {
        const allMods = (res || []).map(m => ({
          id: m.id,
          name: m.name || m.fileName || 'Unknown',
          fileName: m.fileName,
          icon: m.icon,
          path: m.path,
          installedVersion: m.installedVersion,
          latestVersion: m.latestVersion,
          type: m.type,
          mod_type: m.mod_type || 'mod',
          updateAvailable: !!(m.latestVersion && m.installedVersion && m.latestVersion !== m.installedVersion),
        }));
        setMods(allMods);
      }
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to load mods');
      setMods([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredMods = mods.filter(m => {
    const filter = getModTypeFilter(activeTab);
    return m.mod_type === filter;
  });

  async function handleCheckUpdates() {
    setError(null);
    try {
      await invoke('check_mod_updates', { instanceId });
      setTimeout(loadMods, 800);
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to check updates');
    }
  }

  async function handleUpdateAll() {
    setError(null);
    try {
      await invoke('update_all_mods', { instanceId });
      setTimeout(loadMods, 1000);
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to update mods');
    }
  }

  async function handleReveal(mod: ModEntry) {
    if (!mod.path) return;
    try {
      await invoke('open_folder', { path: mod.path });
    } catch {
      setError('Failed to open folder');
    }
  }

  async function handleRemove(mod: ModEntry) {
    try {
      await invoke('remove_mod', { instanceId, modId: mod.id, modType: mod.mod_type });
      loadMods();
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to remove mod');
    }
  }

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
            style={activeTab === id
              ? { background: 'var(--color-primary)', color: '#fff' }
              : { color: 'var(--color-text-secondary)' }}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">{TABS.find(t => t.id === activeTab)?.label} ({filteredMods.length})</h3>
        <div className="flex gap-2">
          <button onClick={loadMods} className="px-3 py-1 rounded text-xs" style={{ background: 'var(--color-surface-2)' }}>Refresh</button>
          {activeTab === 'mods' && (
            <>
              <button onClick={handleCheckUpdates} className="px-3 py-1 rounded text-xs" style={{ background: 'var(--color-surface-2)' }}>Check updates</button>
              <button onClick={handleUpdateAll} className="px-3 py-1 rounded text-xs" style={{ background: 'var(--color-primary)', color: '#fff' }}>Update all</button>
            </>
          )}
        </div>
      </div>

      {loading && <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading mods…</div>}
      {error && <div className="text-sm text-red-400 mb-2">{error}</div>}

      <div className="flex-1 overflow-auto space-y-2">
        {filteredMods.map(m => (
          <div key={m.id} className="p-3 rounded-2xl flex items-center justify-between"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                {m.icon
                  ? <img src={m.icon} alt={m.name}
                      className="w-full h-full object-cover"
                      onError={(e)=>{ (e.target as HTMLImageElement).style.display='none'; }} />
                  : <div className="w-full h-full flex items-center justify-center text-base font-black"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
                      {(m.name || 'M').charAt(0).toUpperCase()}
                    </div>}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>{m.name}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>{m.fileName || m.type || ''}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  Installed: {m.installedVersion ?? '—'}{m.latestVersion ? ` · Latest: ${m.latestVersion}` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {progressMap[m.id] ? (
                <div className="text-right">
                  <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{progressMap[m.id].message}</div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{progressMap[m.id].percent}%</div>
                </div>
              ) : (
                <div className="flex gap-1.5 items-center">
                  <button onClick={() => handleReveal(m)} className="px-2 py-1 rounded text-xs"
                    style={{ background: 'var(--color-surface-2)' }}>Reveal</button>
                  {m.updateAvailable
                    ? <button onClick={() => invoke('update_all_mods', { instanceId, modId: m.id }).then(() => setTimeout(loadMods, 800))}
                        className="px-3 py-1 rounded text-xs" style={{ background: 'var(--color-primary)', color: '#fff' }}>Update</button>
                    : <button onClick={() => invoke('install_mod', { instanceId, modId: m.id }).then(() => setTimeout(loadMods, 800))}
                        className="px-3 py-1 rounded text-xs" style={{ background: 'var(--color-surface-2)' }}>Reinstall</button>}
                  <button onClick={() => handleRemove(m)} className="px-2 py-1 rounded text-xs"
                    style={{ background: 'rgba(231,76,60,0.08)', color: 'var(--color-error)' }}>Remove</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {!loading && filteredMods.length === 0 && !error && (
          <div className="flex flex-col items-center py-12 gap-2">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No {TABS.find(t => t.id === activeTab)?.label?.toLowerCase()} installed</p>
          </div>
        )}
      </div>
    </div>
  );
}
