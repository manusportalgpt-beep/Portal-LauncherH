import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Cpu, Palette,
  LogIn, RefreshCw, Trash2, Check, X,
  Volume2, Code, Shield, Save,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useThemeStore } from '@/stores/themeStore';
import { useCurrentUser, useIsAuthenticated, useAuthStore } from '@/stores/authStore';
import { MicrosoftAuthOAuth } from '@/components/auth/MicrosoftAuthOAuth';
import { type ThemeId } from '@/lib/theme-engine';

type Section = 'account' | 'minecraft' | 'appearance' | 'audio' | 'advanced' | 'about';

interface SectionDef { id: Section; icon: any; label: string; desc: string }
const SECTIONS: SectionDef[] = [
  { id:'account',    icon:User,    label:'Account',    desc:'Microsoft account and profiles' },
  { id:'minecraft',  icon:Cpu,     label:'Minecraft',  desc:'Java, memory, and launch options' },
  { id:'appearance', icon:Palette, label:'Appearance', desc:'Theme and visual settings' },
  { id:'audio',      icon:Volume2, label:'Audio',      desc:'Volume and sound settings' },
  { id:'advanced',   icon:Code,    label:'Advanced',   desc:'API keys and advanced options' },
  { id:'about',      icon:Shield,  label:'About',      desc:'Version and license info' },
];

const THEMES: { id: ThemeId; name: string; preview: string; accent: string }[] = [
  { id:'system',       name:'System',      preview:'linear-gradient(135deg,#0D1117 50%,#FFFFFF 50%)', accent:'#64748B' },
  { id:'dark',         name:'Dark',        preview:'linear-gradient(135deg,#0D1117,#1C2333)',          accent:'#4299E1' },
  { id:'light',        name:'Light',       preview:'linear-gradient(135deg,#FFFFFF,#F1F3F5)',          accent:'#4299E1' },
  { id:'red-dark',     name:'Dark Red',    preview:'linear-gradient(135deg,#0A0606,#1E0F0F)',          accent:'#E74C3C' },
  { id:'green-dark',   name:'Dark Green',  preview:'linear-gradient(135deg,#06140C,#102B19)',          accent:'#1BD96A' },
  { id:'purple-dark',  name:'Dark Purple', preview:'linear-gradient(135deg,#080612,#1F183D)',          accent:'#8B5CF6' },
  { id:'pink-dark',    name:'Pink Dark',   preview:'linear-gradient(135deg,#15080F,#2A1020)',          accent:'#E91E63' },
  { id:'monochrome',   name:'Mono',        preview:'linear-gradient(135deg,#0A0A0A,#282828)',          accent:'#CCCCCC' },
  { id:'pixel',        name:'Pixel',       preview:'linear-gradient(135deg,#0D1117,#1C2333)',          accent:'#55FF55' },
  { id:'glass-white',  name:'Glass White', preview:'linear-gradient(135deg,#e8f0ff,#f5eaff 50%,#e0f7ff)', accent:'#8B5CF6' },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative rounded-full transition-all shrink-0"
      style={{ width:40, height:22, background:value?'var(--color-primary)':'var(--color-surface-2)', border:`1px solid ${value?'var(--color-primary)':'var(--color-border)'}` }}>
      <div className="absolute top-0.5 rounded-full transition-all"
        style={{ width:18, height:18, background:'#fff', left:value?'calc(100% - 20px)':'2px', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5" style={{ borderBottom:'1px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-semibold" style={{ color:'var(--color-text)' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color:'var(--color-text-secondary)' }}>{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function RangeRow({ label, desc, value, min, max, unit, onChange }: { label:string; desc?:string; value:number; min:number; max:number; unit?:string; onChange:(v:number)=>void }) {
  return (
    <div className="py-3.5" style={{ borderBottom:'1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold" style={{ color:'var(--color-text)' }}>{label}</p>
          {desc && <p className="text-xs mt-0.5" style={{ color:'var(--color-text-secondary)' }}>{desc}</p>}
        </div>
        <span className="text-sm font-bold" style={{ color:'var(--color-primary)' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)}
        className="w-full" style={{ accentColor:'var(--color-primary)' }} />
    </div>
  );
}

function InputRow({ label, desc, value, onChange, placeholder, type='text', readOnly }: { label:string; desc?:string; value:string; onChange?:(v:string)=>void; placeholder?:string; type?:string; readOnly?: boolean }) {
  return (
    <div className="py-3.5" style={{ borderBottom:'1px solid var(--color-border)' }}>
      <p className="text-sm font-semibold mb-1.5" style={{ color:'var(--color-text)' }}>{label}</p>
      {desc && <p className="text-xs mb-2" style={{ color:'var(--color-text-secondary)' }}>{desc}</p>}
      <input type={type} value={value} onChange={e => !readOnly && onChange?.(e.target.value)} placeholder={placeholder}
        readOnly={readOnly}
        className="w-full px-3 py-2.5 rounded-xl text-sm font-medium"
        style={{
          background: readOnly ? 'var(--color-surface)' : 'var(--color-surface-2)',
          border:'1px solid var(--color-border)',
          color: readOnly ? 'var(--color-text-secondary)' : 'var(--color-text)',
          cursor: readOnly ? 'not-allowed' : undefined,
        }} />
    </div>
  );
}

function AccountSection() {
  const user = useCurrentUser();
  const isAuth = useIsAuthenticated();
  const { logout } = useAuthStore();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div>
      <h2 className="text-base font-bold mb-1" style={{ color:'var(--color-text)' }}>Microsoft Account</h2>
      <p className="text-sm mb-5" style={{ color:'var(--color-text-secondary)' }}>Manage your Minecraft accounts</p>
      {isAuth && user ? (
        <div className="p-4 rounded-2xl mb-4" style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0"
              style={{ background:'linear-gradient(135deg,var(--color-primary),#E74C3C)' }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} className="w-full h-full" style={{ imageRendering:'pixelated' }} alt="" />
                : <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">{user.username[0]}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold" style={{ color:'var(--color-text)' }}>{user.username}</p>
              <p className="text-xs" style={{ color:'var(--color-text-secondary)' }}>{user.isDemo ? 'Offline / без лицензии' : 'Microsoft Account · Minecraft: Java Edition'}</p>
              <p className="text-xs font-mono mt-0.5" style={{ color:'var(--color-text-tertiary)' }}>{user.uuid}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3 pt-3" style={{ borderTop:'1px solid var(--color-border)' }}>
            <button onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', color:'var(--color-text-secondary)' }}>
              <RefreshCw className="w-3.5 h-3.5" />Add account
            </button>
            <button onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background:'rgba(231,76,60,0.1)', color:'var(--color-error)' }}>
              <X className="w-3.5 h-3.5" />Sign out
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl mb-4 flex flex-col items-center gap-4"
          style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background:'linear-gradient(135deg,#0078D4,#00BCF2)' }}>
            <LogIn className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <p className="font-bold" style={{ color:'var(--color-text)' }}>Not signed in</p>
            <p className="text-sm mt-1" style={{ color:'var(--color-text-secondary)' }}>Sign in with a Microsoft account to play Minecraft</p>
          </div>
          <button onClick={() => setShowAuth(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background:'#0078D4', color:'#fff' }}>
            Войти в аккаунт
          </button>
        </div>
      )}
      <AnimatePresence>
        {showAuth && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background:'rgba(0,0,0,0.72)', backdropFilter:'blur(4px)' }}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => { if (e.target===e.currentTarget) setShowAuth(false); }}>
            <motion.div className="w-full max-w-sm rounded-2xl p-6"
              style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', boxShadow:'var(--shadow-lg)' }}
              initial={{ scale:0.93,opacity:0,y:12 }} animate={{ scale:1,opacity:1,y:0 }} exit={{ scale:0.93,opacity:0,y:12 }}
              transition={{ type:'spring', stiffness:480, damping:34 }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold" style={{ color:'var(--color-text)' }}>Вход в аккаунт</h3>
                <button onClick={() => setShowAuth(false)}><X className="w-4 h-4" style={{ color:'var(--color-text-secondary)' }} /></button>
              </div>
              <MicrosoftAuthOAuth onSuccess={() => setShowAuth(false)} onCancel={() => setShowAuth(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MinecraftSection() {
  const s = useSettingsStore();
  return (
    <div>
      <h2 className="text-base font-bold mb-1" style={{ color:'var(--color-text)' }}>Java & Memory</h2>
      <p className="text-sm mb-5" style={{ color:'var(--color-text-secondary)' }}>Configure Java and memory allocation</p>
      <InputRow label="Java Path" desc="Leave empty to auto-detect" value={s.javaPath} onChange={v => s.setSetting('javaPath',v)} placeholder="Auto-detect" />
      <InputRow label="JVM Arguments" desc="Extra JVM arguments added before -jar" value={s.customJvmArgs} onChange={v => s.setSetting('customJvmArgs',v)} placeholder="-XX:+UseG1GC -XX:G1NewSizePercent=20" />
      <RangeRow label="Minimum Memory" value={s.minRam} min={512} max={s.maxRam} unit=" MB" onChange={v => s.setSetting('minRam',v)} />
      <RangeRow label="Maximum Memory" value={s.maxRam} min={s.minRam} max={32768} unit=" MB" onChange={v => s.setSetting('maxRam',v)} />
      <Row label="Close launcher on game start" desc="Minimize Portal Launcher when Minecraft starts">
        <Toggle value={s.closeLauncherOnStart} onChange={v => s.setSetting('closeLauncherOnStart',v)} />
      </Row>
      <Row label="Show snapshot versions" desc="Include pre-release and snapshot versions in version picker">
        <Toggle value={s.showSnapshots} onChange={v => s.setSetting('showSnapshots',v)} />
      </Row>
      <Row label="Auto-install dependencies" desc="Automatically install Fabric API, Forge dependencies, etc.">
        <Toggle value={s.autoInstallDeps} onChange={v => s.setSetting('autoInstallDeps',v)} />
      </Row>
      <Row label="Keep game logs" desc="Store Minecraft logs in the game directory">
        <Toggle value={s.keepLogs} onChange={v => s.setSetting('keepLogs',v)} />
      </Row>
    </div>
  );
}

function AppearanceSection() {
  const { themeId, setTheme } = useThemeStore();
  return (
    <div>
      <h2 className="text-base font-bold mb-1" style={{ color:'var(--color-text)' }}>Appearance</h2>
      <p className="text-sm mb-5" style={{ color:'var(--color-text-secondary)' }}>Choose your theme and visual preferences</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {THEMES.map(t => (
          <button key={t.id} onClick={() => setTheme(t.id)}
            data-testid={`theme-${t.id}`}
            className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.03] hover:-translate-y-0.5"
            style={{
              border:`2px solid ${themeId===t.id?t.accent:'var(--color-border)'}`,
              boxShadow: themeId===t.id ? `0 8px 24px ${t.accent}33` : 'none',
            }}>
            <div className="h-16 relative" style={{ background:t.preview }}>
              <div className="absolute bottom-1.5 left-1.5 w-3 h-3 rounded-full"
                style={{ background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
            </div>
            <div className="px-2 py-2" style={{ background:'var(--color-surface-2)' }}>
              <p className="text-[11px] font-bold text-center truncate" style={{ color:'var(--color-text)' }}>{t.name}</p>
            </div>
            {themeId===t.id && (
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background:t.accent, boxShadow: `0 2px 8px ${t.accent}` }}>
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function AudioSection() {
  const s = useSettingsStore();
  return (
    <div>
      <h2 className="text-base font-bold mb-1" style={{ color:'var(--color-text)' }}>Audio</h2>
      <p className="text-sm mb-5" style={{ color:'var(--color-text-secondary)' }}>Sound and volume settings</p>
      <RangeRow label="Master Volume" value={s.masterVolume} min={0} max={100} unit="%" onChange={v => s.setSetting('masterVolume',v)} />
      <Row label="UI Sounds" desc="Play sounds for interactions like button clicks">
        <Toggle value={s.uiSounds} onChange={v => s.setSetting('uiSounds',v)} />
      </Row>
      <Row label="Notification Sound" desc="Play a sound when you receive a notification">
        <Toggle value={s.notificationSound} onChange={v => s.setSetting('notificationSound',v)} />
      </Row>
    </div>
  );
}

function AdvancedSection() {
  const s = useSettingsStore();
  const [cfKey, setCfKey] = useState(s.curseforgeApiKey);
  const [saved, setSaved] = useState(false);

  function saveCfKey() {
    s.setSetting('curseforgeApiKey', cfKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h2 className="text-base font-bold mb-1" style={{ color:'var(--color-text)' }}>Advanced</h2>
      <p className="text-sm mb-5" style={{ color:'var(--color-text-secondary)' }}>API keys and advanced options</p>

      {/* CurseForge API Key — editable */}
      <div className="py-3.5" style={{ borderBottom:'1px solid var(--color-border)' }}>
        <p className="text-sm font-semibold mb-1" style={{ color:'var(--color-text)' }}>CurseForge API Key</p>
        <p className="text-xs mb-2" style={{ color:'var(--color-text-secondary)' }}>
          Required for CurseForge mod search. Get your key at{' '}
          <span style={{ color:'var(--color-primary)' }}>console.curseforge.com</span>
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={cfKey}
            onChange={e => { setCfKey(e.target.value); setSaved(false); }}
            placeholder="$2a$10$..."
            className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium"
            style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)', color:'var(--color-text)' }}
          />
          <button
            onClick={saveCfKey}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold shrink-0 transition-all"
            style={{
              background: saved ? 'rgba(46,204,113,0.15)' : 'var(--color-primary)',
              color: saved ? '#2ECC71' : 'var(--color-primary-text)',
              border: saved ? '1px solid #2ECC7144' : 'none',
            }}>
            {saved ? <><Check className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save</>}
          </button>
        </div>
        {cfKey && (
          <p className="text-[11px] mt-1.5" style={{ color:'var(--color-text-tertiary)' }}>
            ● Key configured ({cfKey.length} chars)
          </p>
        )}
      </div>

      <Row label="Default Platform" desc="Which platform to use by default in Discover">
        <div className="flex rounded-xl overflow-hidden" style={{ border:'1px solid var(--color-border)' }}>
          {(['modrinth','curseforge'] as const).map(p => (
            <button key={p} onClick={() => s.setSetting('defaultPlatform', p)}
              className="px-3 py-1.5 text-xs font-bold capitalize transition-all"
              style={s.defaultPlatform===p
                ? { background: p==='modrinth'?'#1BD96A':'#F16436', color:'#000' }
                : { color:'var(--color-text-secondary)' }}>
              {p==='modrinth'?'Modrinth':'CurseForge'}
            </button>
          ))}
        </div>
      </Row>
      <div className="pt-4">
        <button onClick={() => s.reset()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background:'rgba(231,76,60,0.1)', color:'var(--color-error)', border:'1px solid rgba(231,76,60,0.2)' }}>
          <Trash2 className="w-4 h-4" />Reset all settings to default
        </button>
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <div>
      <h2 className="text-base font-bold mb-1" style={{ color:'var(--color-text)' }}>About Portal Launcher</h2>
      <p className="text-sm mb-5" style={{ color:'var(--color-text-secondary)' }}>Version and license information</p>
      <div className="p-5 rounded-2xl mb-4 flex flex-col items-center gap-3"
        style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
        <div className="w-20 h-20 rounded-3xl overflow-hidden"
          style={{ boxShadow:'0 8px 24px rgba(231,76,60,0.4)' }}>
          <img src="/launcher-icon.png" alt="Portal Launcher" className="w-full h-full object-cover" draggable={false} />
        </div>
        <div className="text-center">
          <p className="font-black text-xl" style={{ color:'var(--color-text)' }}>Portal Launcher</p>
          <p className="text-sm mt-0.5" style={{ color:'var(--color-text-secondary)' }}>Version 1.0.0</p>
          <p className="text-xs mt-1" style={{ color:'var(--color-text-tertiary)' }}>Built with Tauri v2 · React · TypeScript</p>
        </div>
      </div>
      {[
        { label:'Made By', value:'Portalrolls' },
        { label:'Tauri Version', value:'2.x' },
        { label:'React Version', value:'18.x' },
        { label:'License', value:'MIT' },
      ].map(r => (
        <div key={r.label} className="flex items-center justify-between py-3" style={{ borderBottom:'1px solid var(--color-border)' }}>
          <p className="text-sm" style={{ color:'var(--color-text-secondary)' }}>{r.label}</p>
          <p className="text-sm font-semibold" style={{ color: r.label === 'Made By' ? 'var(--color-primary)' : 'var(--color-text)' }}>{r.value}</p>
        </div>
      ))}
    </div>
  );
}

const SECTION_CONTENT: Record<Section, React.FC> = {
  account: AccountSection,
  minecraft: MinecraftSection,
  appearance: AppearanceSection,
  audio: AudioSection,
  advanced: AdvancedSection,
  about: AboutSection,
};

export function SettingsPage() {
  const { section: sectionParam } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>((sectionParam as Section) || 'account');

  const Content = SECTION_CONTENT[activeSection] || AccountSection;

  return (
    <div className="h-full flex overflow-hidden">
      <aside className="shrink-0 flex flex-col h-full overflow-y-auto"
        style={{ width:220, background:'var(--color-surface)', borderRight:'1px solid var(--color-border)' }}>
        <div className="px-4 py-4 shrink-0">
          <p className="text-base font-black" style={{ color:'var(--color-text)' }}>Settings</p>
        </div>
        <nav className="px-2 pb-4 space-y-0.5">
          {SECTIONS.map(sec => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button key={sec.id}
                onClick={() => { setActiveSection(sec.id); navigate(`/settings/${sec.id}`); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={active
                  ? { background:'var(--color-surface-2)', color:'var(--color-text)', border:'1px solid var(--color-border)' }
                  : { color:'var(--color-text-secondary)' }}>
                <Icon className="w-4 h-4 shrink-0" style={{ color:active?'var(--color-primary)':'inherit' }} />
                <span className="text-sm font-semibold">{sec.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeSection}
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
              transition={{ duration:0.15 }}>
              <Content />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
