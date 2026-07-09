import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import { Download, CheckCircle, X } from 'lucide-react';

interface DownloadEvent {
  stage: string;
  current: number;
  total: number;
  message: string;
  percent: number;
}

interface LaunchEvent {
  instance_id: string;
  status: string;
  message: string;
  exit_code?: number;
}

interface JavaDownloadEvent {
  percent: number;
  message: string;
  version: number;
}

export function DownloadProgressOverlay() {
  const [dlEvent, setDlEvent] = useState<DownloadEvent | null>(null);
  const [launchEvents, setLaunchEvents] = useState<Record<string, LaunchEvent>>({});
  const [javaEvt, setJavaEvt] = useState<JavaDownloadEvent | null>(null);
  const [dismissed, setDismissed] = useState(new Set<string>());

  useEffect(() => {
    let uns: Array<() => void> = [];

    listen<DownloadEvent>('download-progress', e => {
      setDlEvent(e.payload);
      if (e.payload.percent >= 100) setTimeout(() => setDlEvent(null), 3000);
    }).then(f => uns.push(f));

    listen<LaunchEvent>('launch-status', e => {
      const p = e.payload;
      setLaunchEvents(prev => ({ ...prev, [p.instance_id]: p }));
      if (p.status === 'stopped' || p.status === 'crashed') {
        setTimeout(() => setLaunchEvents(prev => { const n = {...prev}; delete n[p.instance_id]; return n; }), 5000);
      }
    }).then(f => uns.push(f));

    listen<JavaDownloadEvent>('java-download', e => {
      setJavaEvt(e.payload);
      if (e.payload.percent >= 100) setTimeout(() => setJavaEvt(null), 3000);
    }).then(f => uns.push(f));

    return () => uns.forEach(fn => fn());
  }, []);

  const runningLaunches = Object.values(launchEvents).filter(e => !dismissed.has(e.instance_id));

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 items-end pointer-events-none">
      {/* Download progress */}
      <AnimatePresence>
        {dlEvent && (
          <motion.div key="dl" className="w-72 rounded-xl p-3 pointer-events-auto"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
            initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--color-text)' }}>Downloading Minecraft</span>
              <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>{dlEvent.percent}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
              <motion.div className="h-full rounded-full" style={{ background: 'var(--color-primary)' }}
                animate={{ width: `${dlEvent.percent}%` }} transition={{ type: 'spring', stiffness: 60 }} />
            </div>
            <p className="text-[10px] mt-1.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>{dlEvent.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Java download */}
      <AnimatePresence>
        {javaEvt && (
          <motion.div key="java" className="w-72 rounded-xl p-3 pointer-events-auto"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
            initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs" role="img">☕</span>
              <span className="text-xs font-semibold flex-1" style={{ color: 'var(--color-text)' }}>Downloading Java {javaEvt.version}</span>
              <span className="text-xs font-bold" style={{ color: '#F39C12' }}>{javaEvt.percent}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
              <motion.div className="h-full rounded-full" style={{ background: '#F39C12' }}
                animate={{ width: `${javaEvt.percent}%` }} transition={{ type: 'spring', stiffness: 60 }} />
            </div>
            <p className="text-[10px] mt-1.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>{javaEvt.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launch status toasts */}
      <AnimatePresence>
        {runningLaunches.map(evt => (
          <motion.div key={evt.instance_id} className="w-72 rounded-xl p-3 pointer-events-auto"
            style={{ background: 'var(--color-surface)', border: `1px solid ${evt.status === 'crashed' ? 'var(--color-error)' : 'var(--color-border)'}`, boxShadow: 'var(--shadow-lg)' }}
            initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }}>
            <div className="flex items-center gap-2">
              {evt.status === 'launching' || evt.status === 'preparing' || evt.status === 'downloading' ? (
                <div className="w-3.5 h-3.5 border-2 rounded-full shrink-0" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
              ) : evt.status === 'stopped' ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-error)' }} />
              )}
              <span className="text-xs font-medium flex-1 truncate" style={{ color: evt.status === 'crashed' ? 'var(--color-error)' : 'var(--color-text)' }}>{evt.message}</span>
              <button className="shrink-0 opacity-60 hover:opacity-100" onClick={() => setDismissed(s => new Set([...s, evt.instance_id]))}>
                <X className="w-3 h-3" style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
