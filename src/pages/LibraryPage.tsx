import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play, Plus, Settings, Square, Package, Image, Sparkles, Database,
  Search, RefreshCw, Download, Trash2, ChevronDown, MoreVertical, X,
  Copy, Folder, FileText, Check, Terminal, ClipboardCopy, Trash,
} from 'lucide-react';
import { useInstanceStore, Instance } from '@/stores/instanceStore';
import { useCurrentUser } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { invoke } from '@/lib/invoke-shim';
import { listen } from '@tauri-apps/api/event';

const LOADER_COLOR: Record<string, string> = {
  vanilla: '#1BD96A', fabric: '#DBB171', forge: '#1162A0', quilt: '#C397C5', neoforge: '#E87225',
};

type ContentTab = 'mods' | 'resourcepacks' | 'shaders' | 'datapacks' | 'updates';
type LaunchStatus = 'idle' | 'launching' | 'running';
type CreateStep = 'type' | 'custom' | 'install' | 'import';

const LOADERS = ['vanilla', 'fabric', 'neoforge', 'forge', 'quilt'] as const;
const MC_VERSIONS_FALLBACK = ['1.21.4','1.21.3','1.21.2','1.21.1','1.21','1.20.6','1.20.4','1.20.2','1.20.1','1.20','1.19.4','1.19.3','1.19.2','1.19.1','1.19','1.18.2','1.18.1','1.18','1.17.1','1.17','1.16.5','1.16.4','1.16.3','1.16.2','1.16.1','1.15.2','1.15.1','1.15','1.14.4','1.14.3','1.14.2','1.14.1','1.14','1.13.2','1.13.1','1.13','1.12.2','1.12.1','1.12','1.11.2','1.11','1.10.2','1.10','1.9.4','1.9','1.8.9','1.8.8','1.8','1.7.10'];

function useAvailableVersions(showSnapshots: boolean) {
  const [versions, setVersions] = useState<string[]>(MC_VERSIONS_FALLBACK);
  useEffect(() => {
    invoke<{ id: string; version_type: string; installed: boolean }[]>('get_available_versions', { includeSnapshots: showSnapshots })
      .then(list => {
        const ids = list
          .filter(v => showSnapshots || v.version_type === 'release' || v.version_type === 'old_beta' || v.version_type === 'old_alpha')
          .map(v => v.id);
        if (ids.length > 0) setVersions(ids);
      })
      .catch(() => {});
  }, [showSnapshots]);
  return versions;
}

// ── Game Logs Modal ────────────────────────────────────────────────────────────
interface LogLine { line: string; level: string; ts: number; }

const LOG_COLORS: Record<string, string> = {
  fatal: '#ff4444',
  error: '#ff6b6b',
  warn: '#ffd166',
  debug: '#74b9ff',
  stderr: '#fd79a8',
  info: 'var(--color-text-secondary)',
};

function GameLogsModal({ instanceId, onClose }: { instanceId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load existing log file, then listen to live events
  useEffect(() => {
    invoke<string>('get_game_logs', { instanceId })
      .then(content => {
        if (!content) return;
        const lines: LogLine[] = content.split('\n').filter(Boolean).map((line, i) => ({
          line,
          level: detectLevel(line),
          ts: i,
        }));
        setLogs(lines);
      })
      .catch(() => {});

    let counter = Date.now();
    const unsub = listen('game-log', (e: any) => {
      const p = e.payload;
      if (p.instance_id !== instanceId) return;
      setLogs(prev => [...prev, { line: p.line, level: p.level ?? 'info', ts: counter++ }]);
    });

    return () => { unsub.then(fn => fn()); };
  }, [instanceId]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  function detectLevel(line: string): string {
    const u = line.toUpperCase();
    if (u.includes('FATAL')) return 'fatal';
    if (u.includes('ERROR')) return 'error';
    if (u.includes('WARN')) return 'warn';
    if (u.includes('DEBUG')) return 'debug';
    if (u.includes('[STDERR]')) return 'stderr';
    return 'info';
  }

  const copyAll = () => {
    const text = logs.map(l => l.line).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const filtered = filter
    ? logs.filter(l => l.line.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="flex flex-col h-full max-w-5xl w-full mx-auto my-6 rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <Terminal className="w-4 h-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <h2 className="font-bold text-sm flex-1" style={{ color: 'var(--color-text)' }}>
            Game Logs
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
              {logs.length} lines
            </span>
          </h2>

          {/* Filter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <Search className="w-3 h-3 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              placeholder="Filter logs…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-transparent text-xs w-36"
              style={{ color: 'var(--color-text)' }} />
            {filter && (
              <button onClick={() => setFilter('')} className="hover:opacity-70">
                <X className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)' }} />
              </button>
            )}
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(v => !v)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={autoScroll
              ? { background: 'rgba(108,92,231,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(108,92,231,0.3)' }
              : { background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
            Auto-scroll
          </button>

          {/* Copy */}
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'var(--color-surface-2)', color: copied ? '#2ECC71' : 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy all'}
          </button>

          {/* Clear */}
          <button
            onClick={() => setLogs([])}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(231,76,60,0.08)', color: 'var(--color-error)', border: '1px solid rgba(231,76,60,0.2)' }}>
            <Trash className="w-3.5 h-3.5" />Clear
          </button>

          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 ml-1">
            <X className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>

        {/* Log content */}
        <div
          ref={containerRef}
          onScroll={() => {
            const el = containerRef.current;
            if (!el) return;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            setAutoScroll(atBottom);
          }}
          className="flex-1 overflow-y-auto font-mono text-xs p-4 space-y-0.5"
          style={{ background: 'var(--color-bg, #0f0f0f)' }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <FileText className="w-8 h-8" style={{ color: 'var(--color-text-tertiary)' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {logs.length === 0 ? 'No logs yet. Launch the game to see output.' : 'No matching log lines.'}
              </p>
            </div>
          ) : filtered.map((l, i) => (
            <div key={`${l.ts}-${i}`}
              className="leading-5 whitespace-pre-wrap break-all hover:bg-white/[0.03] px-1 rounded"
              style={{ color: LOG_COLORS[l.level] ?? 'var(--color-text-secondary)' }}>
              {l.line}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Footer status bar */}
        <div className="flex items-center gap-4 px-5 py-2 shrink-0"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {(['error', 'warn', 'info'] as const).map(level => {
              const count = logs.filter(l => l.level === level || (level === 'error' && l.level === 'fatal')).length;
              return count > 0 ? (
                <span key={level} style={{ color: LOG_COLORS[level] }}>
                  {level === 'error' ? '✕' : level === 'warn' ? '▲' : '●'} {count} {level}
                </span>
              ) : null;
            })}
          </div>
          <div className="flex-1" />
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {filter ? `${filtered.length} / ${logs.length} lines` : `${logs.length} lines total`}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Create Instance Modal ─────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (i: any) => void }) {
  const [step, setStep] = useState<CreateStep>('type');
  const [creating, setCreating] = useState(false);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const mcVersions = useAvailableVersions(showSnapshots);
  const [form, setForm] = useState({
    name: '', loader: 'fabric' as typeof LOADERS[number], mcVersion: '1.21.4',
    loaderVersionType: 'stable' as 'stable'|'latest'|'custom', customLoaderVersion: '',
  });
  // Keep form version in sync when versions list loads
  useEffect(() => {
    if (mcVersions.length > 0 && !mcVersions.includes(form.mcVersion)) {
      setForm(f => ({ ...f, mcVersion: mcVersions[0] }));
    }
  }, [mcVersions]);

  const pickIcon = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = (e: any) => {
      const f = e.target.files?.[0]; if (!f) return;
      const r = new FileReader(); r.onload = ev => setIconPreview(ev.target?.result as string); r.readAsDataURL(f);
    };
    inp.click();
  };

  const doCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const raw = await invoke<any>('create_instance', {
        name: form.name.trim(),
        description: '',
        mcVersion: form.mcVersion,
        loader: form.loader,
        loaderVersion: form.loaderVersionType === 'custom' ? form.customLoaderVersion : '',
        minRam: 1024,
        maxRam: 4096,
        javaPath: '',
        customJvmArgs: '',
        icon: iconPreview || null,
      });
      onCreated(raw);
    } catch (e) {
      console.error('create_instance failed:', e);
      alert('Failed to create instance: ' + String(e));
    } finally { setCreating(false); onClose(); }
  };

  const pickFile = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.zip,.mrpack';
    inp.onchange = async (e: any) => {
      const f = e.target.files?.[0]; if (!f) return;
      setCreating(true);
      try {
        const raw = await invoke<any>(f.name.endsWith('.mrpack') ? 'import_modrinth_pack' : 'import_instance_zip', { path: f.name });
        onCreated(raw);
      } catch (e) {
        console.error('import failed:', e);
        alert('Failed to import pack: ' + String(e));
      } finally { setCreating(false); onClose(); }
    };
    inp.click();
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background:'rgba(0,0,0,0.72)', backdropFilter:'blur(4px)' }}
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', boxShadow:'var(--shadow-lg)' }}
        initial={{ scale:0.93,opacity:0,y:14 }} animate={{ scale:1,opacity:1,y:0 }} exit={{ scale:0.93,opacity:0,y:14 }}
        transition={{ type:'spring', stiffness:480, damping:34 }}>

        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid var(--color-border)' }}>
          <h2 className="font-bold text-base" style={{ color:'var(--color-text)' }}>
            {step==='type'?'Create Instance':step==='custom'?'Custom Setup':step==='install'?'Install Modpack':'Import Instance'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" style={{ color:'var(--color-text-secondary)' }} />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step==='type' && (
              <motion.div key="type" initial={{ opacity:0,x:12 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-12 }} className="space-y-3">
                <p className="text-sm font-medium mb-4" style={{ color:'var(--color-text)' }}>Choose how to create your instance</p>
                {[
                  { id:'custom',  emoji:'⚙️', title:'Custom Setup',       desc:'Choose loader, version, and mods manually.' },
                  { id:'install', emoji:'📦', title:'Install Modpack',     desc:'Search Modrinth or import .mrpack/.zip file.' },
                  { id:'import',  emoji:'📥', title:'Import from Launcher', desc:'Import from Prism, CurseForge, or MultiMC.' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setStep(opt.id as CreateStep)}
                    className="w-full flex items-start gap-4 p-4 rounded-2xl text-left transition-all hover:scale-[1.01] group"
                    style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
                    <span className="text-2xl">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color:'var(--color-text)' }}>{opt.title}</p>
                      <p className="text-xs mt-0.5" style={{ color:'var(--color-text-secondary)' }}>{opt.desc}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 -rotate-90 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color:'var(--color-text-tertiary)' }} />
                  </button>
                ))}
              </motion.div>
            )}

            {step==='custom' && (
              <motion.div key="custom" initial={{ opacity:0,x:12 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-12 }} className="space-y-5">
                <div className="flex items-start gap-4">
                  <button onClick={pickIcon}
                    className="w-16 h-16 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-1 shrink-0 transition-all hover:scale-105"
                    style={{ background:'var(--color-surface-2)', border:'2px dashed var(--color-border)' }}>
                    {iconPreview
                      ? <img src={iconPreview} className="w-full h-full object-cover" alt="" />
                      : <><Package className="w-6 h-6" style={{ color:'var(--color-text-tertiary)' }} /><span className="text-[9px] font-bold" style={{ color:'var(--color-text-tertiary)' }}>ICON</span></>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-bold mb-1.5" style={{ color:'var(--color-text)' }}>Instance Name *</label>
                    <input autoFocus value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))}
                      placeholder={`${form.loader==='neoforge'?'NeoForge':form.loader.charAt(0).toUpperCase()+form.loader.slice(1)} ${form.mcVersion}`}
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-medium"
                      style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)', color:'var(--color-text)' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color:'var(--color-text)' }}>Loader</label>
                  <div className="flex gap-2 flex-wrap">
                    {LOADERS.map(l => (
                      <button key={l} onClick={() => setForm(f => ({...f,loader:l}))}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all"
                        style={form.loader===l
                          ? { background:LOADER_COLOR[l]||'var(--color-primary)', color:'#fff' }
                          : { background:'var(--color-surface-2)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
                        {l==='neoforge'?'NeoForge':l.charAt(0).toUpperCase()+l.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold" style={{ color:'var(--color-text)' }}>Game Version</label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={showSnapshots} onChange={e => setShowSnapshots(e.target.checked)} className="w-3 h-3" />
                      <span className="text-[10px] font-semibold" style={{ color:'var(--color-text-tertiary)' }}>Snapshots</span>
                    </label>
                  </div>
                  <select value={form.mcVersion} onChange={e => setForm(f => ({...f,mcVersion:e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)', color:'var(--color-text)' }}>
                    {mcVersions.map(v => <option key={v}>{v}</option>)}
                  </select>
                  <p className="text-[10px] mt-1" style={{ color:'var(--color-text-tertiary)' }}>{mcVersions.length} версий из официального манифеста Mojang</p>
                </div>
                {form.loader!=='vanilla' && (
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color:'var(--color-text)' }}>Loader Version</label>
                    <div className="flex gap-2">
                      {(['stable','latest','custom'] as const).map(t => (
                        <button key={t} onClick={() => setForm(f => ({...f,loaderVersionType:t}))}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all"
                          style={form.loaderVersionType===t ? { background:'var(--color-primary)', color:'#fff' } : { background:'var(--color-surface-2)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
                          {t}
                        </button>
                      ))}
                    </div>
                    {form.loaderVersionType==='custom' && (
                      <input value={form.customLoaderVersion} onChange={e => setForm(f => ({...f,customLoaderVersion:e.target.value}))}
                        placeholder="e.g. 0.15.11" className="w-full mt-2 px-3 py-2.5 rounded-xl text-sm"
                        style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)', color:'var(--color-text)' }} />
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {step==='install' && (
              <motion.div key="install" initial={{ opacity:0,x:12 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-12 }} className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
                  <Search className="w-4 h-4 shrink-0" style={{ color:'var(--color-text-tertiary)' }} />
                  <input autoFocus placeholder="Search modpacks on Modrinth..." className="flex-1 bg-transparent text-sm" style={{ color:'var(--color-text)' }} />
                </div>
                <div className="text-center text-xs py-1" style={{ color:'var(--color-text-tertiary)' }}>— or —</div>
                <button onClick={pickFile}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border hover:bg-white/5 transition-all"
                  style={{ border:'1px solid var(--color-border)', color:'var(--color-text-secondary)' }}>
                  <FileText className="w-4 h-4" />Import .mrpack or .zip file
                </button>
              </motion.div>
            )}

            {step==='import' && (
              <motion.div key="import" initial={{ opacity:0,x:12 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-12 }} className="space-y-3">
                {['PrismLauncher','MultiMC','CurseForge','GDLauncher'].map(l => (
                  <div key={l} className="p-3 rounded-xl" style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
                    <p className="text-xs font-bold" style={{ color:'var(--color-text)' }}>{l}</p>
                    <p className="text-[10px] mt-0.5" style={{ color:'var(--color-text-tertiary)' }}>Not installed or no instances found</p>
                  </div>
                ))}
                <button onClick={pickFile}
                  className="w-full py-3 rounded-xl text-sm font-semibold border hover:bg-white/5 transition-all"
                  style={{ border:'1px solid var(--color-border)', color:'var(--color-text-secondary)' }}>
                  Import from .zip / .mrpack file
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 pb-6 flex gap-2.5">
          <button onClick={() => step==='type' ? onClose() : setStep('type')}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 transition-all"
            style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)', color:'var(--color-text-secondary)' }}>
            ← {step==='type'?'Cancel':'Back'}
          </button>
          {step==='custom' && (
            <button onClick={doCreate} disabled={creating||!form.name.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
              style={{ background:'var(--color-primary)', color:'#fff', opacity:creating||!form.name.trim()?0.55:1 }}>
              {creating ? <><div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />Creating...</> : '+ Create Instance'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Instance sidebar ──────────────────────────────────────────────────────────
function InstanceItem({
  inst, selected, onSelect, onDelete, onOpenSettings,
}: {
  inst: Instance; selected: boolean;
  onSelect: () => void; onDelete: () => void; onOpenSettings: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menu]);

  return (
    <div
      className="group relative flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all cursor-pointer"
      style={{ background:selected?'var(--color-surface-2)':'transparent', border:`1px solid ${selected?'var(--color-border)':'transparent'}` }}
      onClick={onSelect}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
        style={{ background:`${inst.color}1A`, color:inst.color }}>
        {inst.iconPath ? <img src={inst.iconPath} className="w-full h-full rounded-xl object-cover" alt="" /> : inst.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate" style={{ color:'var(--color-text)' }}>{inst.name}</p>
        <p className="text-[10px] truncate" style={{ color:'var(--color-text-secondary)' }}>
          {inst.minecraftVersion} · <span className="capitalize" style={{ color:LOADER_COLOR[inst.modLoader]||'inherit' }}>{inst.modLoader}</span>
        </p>
      </div>

      {/* 3-dots button */}
      <div ref={menuRef} className="relative shrink-0" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setMenu(v => !v)}
          className="w-5 h-5 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
          style={{ color:'var(--color-text-secondary)' }}>
          <MoreVertical className="w-3 h-3" />
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div
              className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[148px]"
              style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)', boxShadow:'var(--shadow-lg)' }}
              initial={{ opacity:0, scale:0.9, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
              exit={{ opacity:0, scale:0.9, y:-4 }} transition={{ duration:0.1 }}>
              <button
                onClick={() => { onOpenSettings(); setMenu(false); }}
                className="flex items-center gap-2 px-3 py-2 w-full text-xs text-left hover:bg-white/5"
                style={{ color:'var(--color-text-secondary)' }}>
                <Settings className="w-3.5 h-3.5 shrink-0" />Settings
              </button>
              <div style={{ borderTop:'1px solid var(--color-border)' }} />
              <button
                onClick={() => { onDelete(); setMenu(false); }}
                className="flex items-center gap-2 px-3 py-2 w-full text-xs text-left hover:bg-red-500/10"
                style={{ color:'var(--color-error)' }}>
                <Trash2 className="w-3.5 h-3.5 shrink-0" />Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Sidebar({ instances, selectedId, onSelect, onNew, onDelete, onOpenSettings }: {
  instances: Instance[]; selectedId: string|null;
  onSelect:(id:string)=>void; onNew:()=>void;
  onDelete:(id:string)=>void; onOpenSettings:(id:string)=>void;
}) {
  const [filter, setFilter] = useState('');
  const visible = filter ? instances.filter(i => i.name.toLowerCase().includes(filter.toLowerCase())) : instances;
  return (
    <div className="flex flex-col h-full shrink-0" style={{ width:220, background:'var(--color-surface)', borderRight:'1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 px-3 py-3 shrink-0" style={{ borderBottom:'1px solid var(--color-border)' }}>
        <div className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
          <Search className="w-3 h-3 shrink-0" style={{ color:'var(--color-text-tertiary)' }} />
          <input className="flex-1 min-w-0 bg-transparent text-xs" placeholder="Search instances..." value={filter} onChange={e => setFilter(e.target.value)} style={{ color:'var(--color-text)' }} />
        </div>
        <button onClick={onNew}
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 hover:opacity-80 transition-all"
          style={{ background:'var(--color-primary)', color:'#fff' }} title="New instance">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {visible.length===0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <Package className="w-8 h-8" style={{ color:'var(--color-text-tertiary)' }} />
            <p className="text-xs text-center" style={{ color:'var(--color-text-secondary)' }}>{filter?'No matches':'No instances'}</p>
          </div>
        ) : visible.map(inst => (
          <InstanceItem
            key={inst.id}
            inst={inst}
            selected={selectedId===inst.id}
            onSelect={() => onSelect(inst.id)}
            onDelete={() => onDelete(inst.id)}
            onOpenSettings={() => onOpenSettings(inst.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Content row ───────────────────────────────────────────────────────────────
function ContentRow({ item, onToggle, onDelete }: { item:any; onToggle:()=>void; onDelete:()=>void }) {
  const [menu, setMenu] = useState(false);
  return (
    <tr className="group border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor:'var(--color-border)' }}>
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 overflow-hidden" style={{ background:`${item.color}1A`,color:item.color }}>
            {item.icon_url
              ? <img src={item.icon_url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
              : item.name[0]}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color:'var(--color-text)' }}>{item.name}</p>
            <p className="text-[10px]" style={{ color:'var(--color-text-tertiary)' }}>
              {item.author ? `by ${item.author}` : item.source && item.source !== 'manual' ? item.source : 'local file'}
            </p>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-4">
        <p className="text-xs font-medium" style={{ color:'var(--color-text)' }}>{item.version}</p>
        <p className="text-[10px] truncate max-w-[180px]" style={{ color:'var(--color-text-tertiary)' }}>{item.filename}</p>
      </td>
      <td className="py-2.5 px-4">
        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.updateAvailable && (
            <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background:'rgba(46,204,113,0.15)',color:'#2ECC71' }}>
              <Download className="w-3 h-3" />Update
            </button>
          )}
          <button onClick={onToggle} className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={item.enabled ? { background:'rgba(46,204,113,0.12)',color:'#2ECC71' } : { background:'var(--color-surface-2)',color:'var(--color-text-tertiary)',border:'1px solid var(--color-border)' }}>
            {item.enabled?'Enabled':'Disabled'}
          </button>
          <div className="relative">
            <button onClick={() => setMenu(v => !v)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/5">
              <MoreVertical className="w-3 h-3" style={{ color:'var(--color-text-secondary)' }} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div className="absolute right-0 bottom-full mb-1 z-20 rounded-xl overflow-hidden min-w-[130px]"
                  style={{ background:'var(--color-surface-2)',border:'1px solid var(--color-border)',boxShadow:'var(--shadow-lg)' }}
                  initial={{ opacity:0,scale:0.9,y:4 }} animate={{ opacity:1,scale:1,y:0 }} exit={{ opacity:0,scale:0.9,y:4 }}
                  transition={{ duration:0.1 }}>
                  {[
                    { Icon:Folder, label:'Show in folder', fn:()=>{} },
                    { Icon:Copy,   label:'Copy filename', fn:()=>navigator.clipboard.writeText(item.filename) },
                  ].map(r => (
                    <button key={r.label} onClick={() => { r.fn(); setMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 w-full text-xs text-left hover:bg-white/5"
                      style={{ color:'var(--color-text-secondary)' }}>
                      <r.Icon className="w-3.5 h-3.5 shrink-0" />{r.label}
                    </button>
                  ))}
                  <div style={{ borderTop:'1px solid var(--color-border)' }} />
                  <button onClick={() => { onDelete(); setMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 w-full text-xs text-left hover:bg-red-500/10"
                    style={{ color:'var(--color-error)' }}>
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Content tabs ──────────────────────────────────────────────────────────────
const TABS: { id: ContentTab; Icon: any; label: string }[] = [
  { id:'mods',          Icon:Package,  label:'Mods' },
  { id:'resourcepacks', Icon:Image,    label:'Resource Packs' },
  { id:'shaders',       Icon:Sparkles, label:'Shaders' },
  { id:'datapacks',     Icon:Database, label:'Data Packs' },
  { id:'updates',       Icon:Download, label:'Updates' },
];

function InstanceDetail({ inst, onDelete }: { inst: Instance; onDelete: () => void }) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { update } = useInstanceStore();
  // Fallback values for RAM/Java when the instance itself doesn't override
  const globalSettings = useSettingsStore(s => ({
    minRam: s.minRam, maxRam: s.maxRam, javaPath: s.javaPath, customJvmArgs: s.customJvmArgs,
  }));
  const [tab, setTab] = useState<ContentTab>('mods');
  const [search, setSearch] = useState('');
  /** 'all' | 'modrinth' | 'curseforge' | 'local' — source filter for mod list */
  const [sourceFilter, setSourceFilter] = useState<'all'|'modrinth'|'curseforge'|'local'>('all');
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>('idle');
  const [launchError, setLaunchError] = useState('');
  const [mods, setMods] = useState<any[]>([]);
  const [shaders, setShaders] = useState<any[]>([]);
  const [resourcepacks, setResourcepacks] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [hasLogs, setHasLogs] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerMenu) return;
    const handler = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) setHeaderMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [headerMenu]);

  useEffect(() => {
    setLaunchStatus('idle'); setLaunchError('');
    let unsub: (()=>void)|undefined;
    listen<any>('launch-status', e => {
      if (e.payload.instance_id !== inst.id) return;
      const s = e.payload.status;
      if (['launching','preparing','downloading','classpath'].includes(s)) setLaunchStatus('launching');
      if (s==='running') setLaunchStatus('running');
      if (s==='stopped') { setLaunchStatus('idle'); setHasLogs(true); }
      if (['error','crashed'].includes(s)) {
        setLaunchStatus('idle');
        setHasLogs(true);
        setLaunchError(e.payload.message||'Launch failed');
        setTimeout(()=>setLaunchError(''),5000);
      }
    }).then(fn => { unsub = fn; });

    // Check if there are existing logs for this instance
    invoke<string>('get_game_logs', { instanceId: inst.id })
      .then(content => { if (content && content.trim()) setHasLogs(true); })
      .catch(() => {});

    // Listen for first log line to show logs button
    let logUnsub: (()=>void)|undefined;
    listen<any>('game-log', e => {
      if (e.payload.instance_id === inst.id) setHasLogs(true);
    }).then(fn => { logUnsub = fn; });

    return () => { unsub?.(); logUnsub?.(); };
  }, [inst.id]);

  const [loadingContent, setLoadingContent] = useState(false);
  const loadContent = useCallback(async () => {
    setLoadingContent(true);
    try {
      const all = await invoke<any[]>('get_instance_mods', { instanceId: inst.id });
      const list = Array.isArray(all) ? all : [];
      const mapped = list.map((m: any) => ({
        id: m.id || m.file_name,
        name: m.name,
        author: m.author || '',
        version: m.version || '',
        filename: m.file_name,
        file_name: m.file_name,
        mod_type: m.mod_type || 'mod',
        color: m.mod_type === 'shaderpack' ? '#3498db' : m.mod_type === 'resourcepack' ? '#06b6d4' : '#8b5cf6',
        enabled: m.enabled !== false,
        updateAvailable: !!m.update_available,
        source: m.source,
        icon_url: m.icon_url || null,
      }));
      setMods(mapped.filter((m: any) => !m.mod_type || m.mod_type === 'mod'));
      setShaders(mapped.filter((m: any) => m.mod_type === 'shaderpack'));
      setResourcepacks(mapped.filter((m: any) => m.mod_type === 'resourcepack'));
    } catch (e) { console.warn('Failed to load mods:', e); }
    finally { setLoadingContent(false); }
  }, [inst.id]);

  useEffect(() => { loadContent(); }, [loadContent]);

  const launch = useCallback(async () => {
    if (launchStatus!=='idle') return;
    if (!user) { navigate('/settings/account'); return; }
    setLaunchStatus('launching'); setLaunchError('');
    try {
      // Make sure the on-disk instance.json exists before launching — the
      // local store may have an entry that was never persisted by the Rust
      // side (offline create, failed create_instance, etc.).
      try {
        await invoke('ensure_instance', {
          id: inst.id,
          name: inst.name,
          mcVersion: inst.minecraftVersion,
          loader: inst.modLoader,
          loaderVersion: inst.modLoaderVersion || '',
          minRam: inst.minRam || globalSettings.minRam,
          maxRam: inst.maxRam || globalSettings.maxRam,
          javaPath: inst.javaPath || globalSettings.javaPath || '',
          customJvmArgs: inst.jvmArgs || globalSettings.customJvmArgs || '',
          color: inst.color,
          icon: inst.iconPath || null,
        });
      } catch (e) {
        console.warn('ensure_instance failed:', e);
      }
      update(inst.id, { lastPlayed: new Date().toISOString() });
      
      // Validate auth data before launch
      if (!user || !user.uuid || !user.username) {
        throw new Error('Authentication data missing. Please sign in again in Settings → Account.');
      }
      
      console.log(`🚀 Launching with auth: username=${user.username}, uuid=${user.uuid}, token_len=${(user.accessToken || '').length}`);
      
      await invoke('launch_instance', {
          instance_id: inst.id,
          access_token: user.accessToken || '',
          uuid: user.uuid,
          username: user.username,
      });
    } catch (err: any) { setLaunchStatus('idle'); setLaunchError(String(err)); setTimeout(()=>setLaunchError(''),6000); }
  }, [launchStatus, user, inst, navigate, update]);

  const stop = useCallback(async () => {
    try { await invoke('kill_instance', { instance_id:inst.id }); } catch {}
    setLaunchStatus('idle');
  }, [inst.id]);

  const allItems = tab==='mods' ? mods : tab==='shaders' ? shaders : tab==='resourcepacks' ? resourcepacks : [];
  const items = allItems.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (sourceFilter === 'all') return true;
    const src = (m.source || 'local').toLowerCase();
    if (sourceFilter === 'local') return !src || src === 'manual' || src === 'local';
    return src === sourceFilter;
  });
  const updateItems = [...mods,...shaders,...resourcepacks].filter(m => m.updateAvailable);

  const toggle = async (id: string) => {
    const item = [...mods,...shaders,...resourcepacks].find((m:any) => m.id===id);
    if (!item) return;
    const nowEnabled = !item.enabled;
    const setter = item.mod_type==='shaderpack' ? setShaders : item.mod_type==='resourcepack' ? setResourcepacks : setMods;
    (setter as any)((p: any[]) => p.map((m:any) => m.id===id ? {...m, enabled:nowEnabled} : m));
    try {
      await invoke('toggle_mod', { instanceId: inst.id, fileName: item.file_name, modType: item.mod_type||'mod', enabled: nowEnabled });
    } catch (e) { console.warn('toggle_mod failed:', e); loadContent(); }
  };
  const del = async (id: string) => {
    const item = [...mods,...shaders,...resourcepacks].find((m:any) => m.id===id);
    if (!item) return;
    const setter = item.mod_type==='shaderpack' ? setShaders : item.mod_type==='resourcepack' ? setResourcepacks : setMods;
    (setter as any)((p: any[]) => p.filter((m:any) => m.id!==id));
    try {
      await invoke('remove_mod', { instanceId: inst.id, fileName: item.file_name, modType: item.mod_type||'mod' });
    } catch (e) { console.warn('remove_mod failed:', e); loadContent(); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 shrink-0" style={{ borderBottom:'1px solid var(--color-border)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shrink-0"
          style={{ background:`${inst.color}1A`,color:inst.color }}>
          {inst.iconPath ? <img src={inst.iconPath} className="w-full h-full rounded-2xl object-cover" alt="" /> : inst.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-lg truncate" style={{ color:'var(--color-text)' }}>{inst.name}</h1>
          <p className="text-xs" style={{ color:'var(--color-text-secondary)' }}>
            <span className="font-semibold capitalize" style={{ color:LOADER_COLOR[inst.modLoader]||'inherit' }}>{inst.modLoader}</span>
            {' '}{inst.minecraftVersion}
            {inst.lastPlayed&&<> · Last played {new Date(inst.lastPlayed).toLocaleDateString()}</>}
          </p>
          {launchError&&<p className="text-[10px] mt-0.5" style={{ color:'var(--color-error)' }}>{launchError}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {launchStatus==='running' ? (
            <button onClick={stop} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background:'rgba(231,76,60,0.15)',color:'var(--color-error)' }}>
              <Square className="w-3.5 h-3.5 fill-current" />Stop
            </button>
          ) : (
            <button onClick={launch} disabled={launchStatus==='launching'}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
              style={{ background:'var(--color-primary)',color:'#fff',opacity:launchStatus==='launching'?0.7:1 }}>
              {launchStatus==='launching'
                ? <><div className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />Launching...</>
                : <><Play className="w-3.5 h-3.5 fill-current" />Play</>}
            </button>
          )}
          {/* Logs button — always visible, shows badge when logs exist */}
          <button
            onClick={() => setShowLogs(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold relative transition-all hover:opacity-90"
            style={hasLogs
              ? { background:'rgba(108,92,231,0.12)', color:'var(--color-primary)', border:'1px solid rgba(108,92,231,0.3)' }
              : { color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
            <Terminal className="w-3.5 h-3.5" />
            Logs
            {launchStatus === 'running' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse" style={{ background:'#2ECC71' }} />
            )}
          </button>
          <button onClick={() => navigate(`/instances/${inst.id}/settings`)}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors"
            style={{ color:'var(--color-text-secondary)',border:'1px solid var(--color-border)' }}>
            <Settings className="w-4 h-4" />
          </button>
          <div ref={headerMenuRef} className="relative">
            <button onClick={() => setHeaderMenu(v => !v)}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors"
              style={{ color:'var(--color-text-secondary)',border:'1px solid var(--color-border)' }}>
              <MoreVertical className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {headerMenu && (
                <motion.div
                  className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[180px]"
                  style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)', boxShadow:'var(--shadow-lg)' }}
                  initial={{ opacity:0, scale:0.95, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
                  exit={{ opacity:0, scale:0.95, y:-4 }} transition={{ duration:0.1 }}>
                  <button
                    onClick={async () => {
                      setHeaderMenu(false);
                      try { await invoke('open_instance_folder', { id: inst.id }); } catch {}
                    }}
                    className="flex items-center gap-2 px-3 py-2 w-full text-xs text-left hover:bg-white/5"
                    style={{ color:'var(--color-text-secondary)' }}>
                    <Folder className="w-3.5 h-3.5 shrink-0" />Open folder
                  </button>
                  <button
                    onClick={async () => {
                      setHeaderMenu(false);
                      try {
                        const exported = await invoke<string>('export_instance_zip', { id: inst.id, destPath: '' });
                        alert(`Exported to:\n${exported}`);
                      } catch (e) { alert(`Export failed: ${e}`); }
                    }}
                    className="flex items-center gap-2 px-3 py-2 w-full text-xs text-left hover:bg-white/5"
                    style={{ color:'var(--color-text-secondary)' }}>
                    <Download className="w-3.5 h-3.5 shrink-0" />Export instance (.zip)
                  </button>
                  <div style={{ borderTop:'1px solid var(--color-border)' }} />
                  <button
                    onClick={() => {
                      setHeaderMenu(false);
                      if (confirm(`Delete instance "${inst.name}"?\n\nThis will permanently remove all of its mods, saves and config.`)) {
                        onDelete();
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 w-full text-xs text-left hover:bg-red-500/10"
                    style={{ color:'var(--color-error)' }}>
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />Delete instance
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 shrink-0" style={{ borderBottom:'1px solid var(--color-border)' }}>
        {TABS.map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative"
            style={tab===id ? { background:'var(--color-surface-2)',color:'var(--color-text)',border:'1px solid var(--color-border)' } : { color:'var(--color-text-secondary)' }}>
            <Icon className="w-3.5 h-3.5" />{label}
            {id==='updates' && updateItems.length>0 && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background:'var(--color-error)' }} />}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom:'1px solid var(--color-border)' }}>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background:'var(--color-surface-2)',border:'1px solid var(--color-border)' }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color:'var(--color-text-tertiary)' }} />
          <input className="flex-1 bg-transparent text-xs"
            placeholder={items.length > 0 ? `Search ${items.length} ${tab}...` : `Search ${tab}...`}
            value={search} onChange={e => setSearch(e.target.value)} style={{ color:'var(--color-text)' }} />
        </div>
        {/* Source filter — All / Modrinth / CurseForge / Local */}
        <button
          onClick={() => {
            const order: Array<typeof sourceFilter> = ['all','modrinth','curseforge','local'];
            setSourceFilter(order[(order.indexOf(sourceFilter)+1) % order.length]);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
          title="Filter by source"
          style={{
            background: sourceFilter==='modrinth' ? 'rgba(27,217,106,0.12)'
                      : sourceFilter==='curseforge' ? 'rgba(241,100,54,0.12)'
                      : sourceFilter==='local' ? 'var(--color-surface-2)'
                      : 'var(--color-surface-2)',
            border:    `1px solid ${sourceFilter==='modrinth' ? '#1BD96A' : sourceFilter==='curseforge' ? '#F16436' : 'var(--color-border)'}`,
            color:     sourceFilter==='modrinth' ? '#1BD96A' : sourceFilter==='curseforge' ? '#F16436' : 'var(--color-text-secondary)',
          }}>
          <span className="inline-block w-2 h-2 rounded-full" style={{
            background: sourceFilter==='modrinth' ? '#1BD96A' : sourceFilter==='curseforge' ? '#F16436' : 'var(--color-text-tertiary)'
          }} />
          {sourceFilter==='all' ? 'All' : sourceFilter==='modrinth' ? 'Modrinth' : sourceFilter==='curseforge' ? 'CurseForge' : 'Local'}
        </button>
        <button onClick={() => navigate(`/find-projects?instanceId=${inst.id}`)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-all"
          style={{ background:'var(--color-primary)',color:'#fff' }}>
          <Plus className="w-3.5 h-3.5" />Find projects
        </button>
        {updateItems.length>0 && (
          <button onClick={async () => {
            try { await invoke('update_all_mods', { instanceId: inst.id }); loadContent(); }
            catch (e) { console.warn('update_all_mods:', e); }
          }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background:'rgba(46,204,113,0.12)',color:'#2ECC71' }}>
            <Download className="w-3.5 h-3.5" />Update all
          </button>
        )}
        <button onClick={() => loadContent()} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors"
          style={{ border:'1px solid var(--color-border)',color:'var(--color-text-secondary)' }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loadingContent ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab==='updates' ? (
          <div className="p-4 space-y-2">
            {updateItems.length===0 ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <Check className="w-10 h-10" style={{ color:'#2ECC71' }} />
                <p className="text-sm font-semibold" style={{ color:'var(--color-text)' }}>All up to date!</p>
              </div>
            ) : updateItems.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background:'var(--color-surface-2)',border:'1px solid var(--color-border)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black" style={{ background:`${m.color}1A`,color:m.color }}>{m.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color:'var(--color-text)' }}>{m.name}</p>
                  <p className="text-xs" style={{ color:'var(--color-text-secondary)' }}>Update available</p>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={{ background:'rgba(46,204,113,0.15)',color:'#2ECC71' }}>
                  <Download className="w-3 h-3" />Update
                </button>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead style={{ borderBottom:'1px solid var(--color-border)' }}>
              <tr>
                {['Project','Version',''].map((h,i) => (
                  <th key={i} className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 ${h===''?'text-right':'text-left'}`}
                    style={{ color:'var(--color-text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length===0 ? (
                <tr><td colSpan={3} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Package className="w-10 h-10" style={{ color:'var(--color-text-tertiary)' }} />
                    <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>{search?'No matches':`No ${tab} installed`}</p>
                  </div>
                </td></tr>
              ) : items.map(item => (
                <ContentRow key={item.id} item={item} onToggle={() => toggle(item.id)} onDelete={() => del(item.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Logs modal */}
      <AnimatePresence>
        {showLogs && (
          <GameLogsModal instanceId={inst.id} onClose={() => setShowLogs(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function LibraryPage() {
  const navigate = useNavigate();
  const { instances, add, remove } = useInstanceStore();
  const [selectedId, setSelectedId] = useState<string|null>(instances[0]?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!selectedId && instances.length>0) setSelectedId(instances[0].id);
  }, [instances, selectedId]);

  const handleCreated = (raw: any) => {
    const inst: Instance = {
      id: raw.id,
      name: raw.name,
      description: raw.description||'',
      iconPath: raw.icon||undefined,
      minecraftVersion: raw.mc_version||'1.21.1',
      modLoader: raw.loader||'fabric',
      modLoaderVersion: raw.loader_version||'',
      minRam: raw.min_ram||1024,
      maxRam: raw.max_ram||4096,
      gameDir: raw.id||'',
      createdAt: raw.created_at||new Date().toISOString(),
      totalPlayTime: 0,
      color: ['#6C5CE7','#E74C3C','#2ECC71','#3498DB','#F39C12'][Math.floor(Math.random()*5)],
    };
    add(inst); setSelectedId(inst.id);
  };

  const handleDelete = async (id: string) => {
    try { await invoke('delete_instance', { id }); } catch { /* best-effort */ }
    remove(id);
    if (selectedId === id) {
      const remaining = instances.filter(i => i.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      <Sidebar
        instances={instances}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => setShowCreate(true)}
        onDelete={handleDelete}
        onOpenSettings={(id) => navigate(`/instances/${id}/settings`)}
      />
      <div className="flex-1 min-w-0 overflow-hidden">
        {instances.find(i => i.id===selectedId) ? (
          <InstanceDetail inst={instances.find(i => i.id===selectedId)!} onDelete={() => handleDelete(selectedId!)} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-5">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background:'var(--color-surface)',border:'1px solid var(--color-border)' }}>
              <Package className="w-10 h-10" style={{ color:'var(--color-text-tertiary)' }} />
            </div>
            <div className="text-center">
              <p className="font-black text-lg" style={{ color:'var(--color-text)' }}>No instances</p>
              <p className="text-sm mt-1" style={{ color:'var(--color-text-secondary)' }}>Create your first instance to start playing.</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
              style={{ background:'var(--color-primary)',color:'#fff' }}>
              <Plus className="w-4 h-4" />Create Instance
            </button>
          </div>
        )}
      </div>
      <AnimatePresence>
        {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      </AnimatePresence>
    </div>
  );
}
