import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Save, Cpu, Folder, Play } from 'lucide-react';
import { useInstanceStore } from '@/stores/instanceStore';
import { useTranslation } from 'react-i18next';

const LOADERS = ['vanilla','fabric','forge','quilt','neoforge'] as const;
const VERSIONS = ['1.21.1','1.21','1.20.6','1.20.4','1.20.1','1.19.4','1.18.2','1.16.5','1.12.2'];

const tabs = [
  { id:'general', label:'General', icon:Cpu },
  { id:'mods', label:'Mods', icon:Folder },
];

export function InstanceSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { instances, update } = useInstanceStore();
  const inst = instances.find(i => i.id === id);
  const [tab, setTab] = useState('general');
  const [saved, setSaved] = useState(false);

  if (!inst) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p style={{color:'var(--color-text-secondary)'}}>Instance not found</p>
      <button onClick={()=>navigate('/instances')} style={{color:'var(--color-primary)'}}>← Back to Instances</button>
    </div>
  );

  const [form, setForm] = useState({
    name: inst.name,
    description: inst.description,
    minecraftVersion: inst.minecraftVersion,
    modLoader: inst.modLoader,
    modLoaderVersion: inst.modLoaderVersion || '',
    javaPath: inst.javaPath || '',
    jvmArgs: inst.jvmArgs || '',
    minRam: inst.minRam,
    maxRam: inst.maxRam,
  });

  const handleSave = () => {
    update(inst.id, form as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Field = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" style={{color:'var(--color-text)'}}>{label}</label>
      {desc && <p className="text-xs" style={{color:'var(--color-text-secondary)'}}>{desc}</p>}
      {children}
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={()=>navigate('/instances')}
            className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
            style={{color:'var(--color-text-secondary)'}}>
            <ChevronLeft className="w-4 h-4" />Instances
          </button>
          <span style={{color:'var(--color-text-tertiary)'}}>/</span>
          <span className="text-sm font-medium" style={{color:'var(--color-text)'}}>{inst.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',color:'var(--color-text-secondary)'}}>
            <Play className="w-3.5 h-3.5 fill-current" />Play
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{background:saved?'rgba(46,204,113,0.15)':' var(--color-primary)',color:saved?'var(--color-success)':'var(--color-primary-text)',border:saved?'1px solid var(--color-success)':'none'}}>
            <Save className="w-3.5 h-3.5" />{saved?'Saved!':'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar tabs */}
        <div className="flex flex-col gap-1 w-44 flex-shrink-0">
          {tabs.map(({id:tabId,label,icon:Icon})=>(
            <button key={tabId} onClick={()=>setTab(tabId)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
              style={tab===tabId
                ?{background:'var(--color-primary-dim)',color:'var(--color-primary)'}
                :{color:'var(--color-text-secondary)'}}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <motion.div key={tab} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
          className="flex-1 overflow-y-auto scroll-area">
          <div className="rounded-xl p-6 space-y-6"
            style={{background:'var(--color-surface)',border:'1px solid var(--color-border)'}}>

            {tab==='general' && <>
              <Field label={t('instances.name')}>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm"
                  style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)',color:'var(--color-text)'}} />
              </Field>
              <Field label={t('instances.description')}>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                  rows={3} className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                  style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)',color:'var(--color-text)'}} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('instances.version')}>
                  <select value={form.minecraftVersion} onChange={e=>setForm(f=>({...f,minecraftVersion:e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)',color:'var(--color-text)'}}>
                    {VERSIONS.map(v=><option key={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label={t('instances.loader')}>
                  <select value={form.modLoader} onChange={e=>setForm(f=>({...f,modLoader:e.target.value as any}))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm capitalize"
                    style={{background:'var(--color-surface-2)',border:'1px solid var(--color-border)',color:'var(--color-text)'}}>
                    {LOADERS.map(l=><option key={l}>{l}</option>)}
                  </select>
                </Field>
              </div>
            </>}

            {tab==='java' && <>
              <div className="px-3 py-3 rounded-xl text-sm" style={{background:'var(--color-surface-2)', border:'1px solid var(--color-border)', color:'var(--color-text-secondary)'}}>
                Java &amp; Memory settings are now managed globally in{' '}
                <button onClick={()=>navigate('/settings/java')} className="font-semibold underline" style={{color:'var(--color-primary)'}}>
                  Settings → Java &amp; Memory
                </button>.
              </div>
            </>}

            {tab==='mods' && (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Folder className="w-8 h-8" style={{color:'var(--color-text-tertiary)'}} />
                <p style={{color:'var(--color-text-secondary)'}}>No mods installed</p>
                <button
                  onClick={() => navigate(`/discover?instanceId=${inst.id}`)}
                  className="text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{color:'var(--color-primary)'}}>
                  Browse Discover →
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
