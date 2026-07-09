import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, Compass, ArrowRight, Clock, Square, TrendingUp, Zap, Camera, Star } from 'lucide-react';
import { useCurrentUser, useIsAuthenticated } from '@/stores/authStore';
import { useInstanceStore, Instance } from '@/stores/instanceStore';
import { invoke } from '@/lib/invoke-shim';
import { listen } from '@tauri-apps/api/event';

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m played` : 'Never played';
}

const LOADER_COLOR: Record<string, string> = {
  vanilla: '#1BD96A', fabric: '#DBB171', forge: '#1162A0', quilt: '#C397C5', neoforge: '#E87225',
};

function InstanceCard({ inst }: { inst: Instance }) {
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const user = useCurrentUser();
  const { update } = useInstanceStore();

  const log = (...args: any[]) => console.log('[InstanceCard]', ...args);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    listen<any>('launch-status', e => {
      if (e.payload.instance_id !== inst.id) return;
      const s = e.payload.status;
      if (['launching','preparing','downloading'].includes(s)) { setLaunching(true); setRunning(false); }
      if (s === 'running') { setLaunching(false); setRunning(true); }
      if (['stopped','error','crashed'].includes(s)) {
        setLaunching(false); setRunning(false);
        if (s !== 'stopped') { setError(e.payload.message || 'Launch failed'); setTimeout(() => setError(''), 5000); }
      }
    }).then(fn => { unsub = fn; });
    return () => unsub?.();
  }, [inst.id]);

  const launch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (launching || running) return;
    if (!user) { 
      log('❌ No user authenticated, redirecting to settings');
      navigate('/settings/account'); 
      return; 
    }
    
    log(`🚀 Launching instance ${inst.id} with auth: username=${user.username}, token_len=${(user.accessToken || '').length}`);
    
    setLaunching(true); setError('');
    try {
      update(inst.id, { lastPlayed: new Date().toISOString() });
      await invoke('launch_instance', {
        instance_id: inst.id,
        access_token: user.accessToken || '',
        uuid: user.uuid,
        username: user.username,
      });
    } catch (err: any) {
      log('❌ Launch failed:', err);
      setError(String(err));
      setLaunching(false);
    }
  };

  const stop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await invoke('kill_instance', { instance_id: inst.id }); } catch {}
    setRunning(false); setLaunching(false);
  };

  return (
    <motion.div
      className="rounded-2xl overflow-hidden cursor-pointer group"
      style={{ background: 'var(--color-surface)', border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}` }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
      transition={{ duration: 0.15 }}
      onClick={() => navigate(`/library`)}>
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${inst.color}, ${inst.color}44)` }} />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-2.5">
          {inst.iconPath ? (
            <img src={inst.iconPath} className="w-10 h-10 rounded-xl object-cover" alt="" />
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
              style={{ background: `${inst.color}18`, color: inst.color }}>
              {inst.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>{inst.name}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {inst.minecraftVersion} · <span style={{ color: LOADER_COLOR[inst.modLoader] || 'var(--color-text-secondary)' }}
                className="capitalize">{inst.modLoader}</span>
            </p>
          </div>
        </div>
        {error && <p className="text-[10px] mb-2 px-2 py-1 rounded-lg" style={{ color: 'var(--color-error)', background: 'rgba(231,76,60,0.08)' }}>{error}</p>}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {inst.lastPlayed ? `Played ${fmtTime(inst.totalPlayTime)}` : 'Never played'}
          </span>
          {running ? (
            <button onClick={stop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(231,76,60,0.15)', color: 'var(--color-error)' }}>
              <Square className="w-3 h-3 fill-current" />Stop
            </button>
          ) : (
            <button onClick={launch} disabled={launching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
              style={{ background: 'var(--color-primary)', color: '#fff', opacity: launching ? 0.7 : 1 }}>
              {launching
                ? <><div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />Launching</>
                : <><Play className="w-3 h-3 fill-current" />Play</>}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const FEATURED = [
  { id:'fabulously-optimized', name:'Fabulously Optimized', desc:'Beautiful graphics, speedy performance and familiar features in a simple package.', color:'#f97316', icon:'FO', tags:['Performance','Lightweight'], downloads:'12.9M', mc:'1.21.1', loader:'fabric' },
  { id:'cobblemon-fabric', name:'Cobblemon [Fabric]', desc:'The official Cobblemon mod for Fabric. Catch, battle, and train your Pokémon!', color:'#3b82f6', icon:'C', tags:['Adventure','Gameplay'], downloads:'7.7M', mc:'1.21.1', loader:'fabric' },
  { id:'vanilla-perfected', name:'Vanilla Perfected', desc:'A compilation of Vanilla Plus mods & packs to perfect the Minecraft experience.', color:'#8b5cf6', icon:'VP', tags:['Vanilla+','Optimization'], downloads:'1.8M', mc:'1.21.1', loader:'fabric' },
  { id:'aged', name:'Aged', desc:'Realistic/medieval progression modpack for Fabric 1.20.1 with unique challenges.', color:'#a16207', icon:'A', tags:['RPG','Medieval'], downloads:'1.1M', mc:'1.20.1', loader:'fabric' },
];

const TRENDING_MODS = [
  { id:'sodium', name:'Sodium', desc:'Rendering optimization mod', color:'#f59e0b', icon:'S', downloads:'12.4M', source:'modrinth' },
  { id:'fabric-api', name:'Fabric API', desc:'Core API library', color:'#8b5cf6', icon:'F', downloads:'45.2M', source:'modrinth' },
  { id:'iris', name:'Iris Shaders', desc:'Beautiful shader support', color:'#06b6d4', icon:'I', downloads:'7.3M', source:'modrinth' },
  { id:'jei', name:'Just Enough Items', desc:'Recipe viewer', color:'#10b981', icon:'J', downloads:'18.7M', source:'curseforge' },
];

const RESOURCE_PACKS = [
  { id:'faithful-32x', name:'Faithful 32x', desc:'A faithful recreation of the default Minecraft textures in 32x resolution', color:'#f59e0b', icon:'F32', downloads:'8.2M', source:'modrinth' },
  { id:'complementary-reimagined', name:'Complementary Reimagined', desc:'Beautiful shaders balanced for gameplay', color:'#818cf8', icon:'CR', downloads:'5.1M', source:'modrinth' },
  { id:'visual-overhaul', name:'Visual Overhaul', desc:'Enhances Minecraft\'s look with modern textures', color:'#34d399', icon:'VO', downloads:'2.3M', source:'modrinth' },
  { id:'xekr-fresh-animations', name:'Fresh Animations', desc:'Dynamic entity animations for a lively world', color:'#f87171', icon:'FA', downloads:'4.7M', source:'modrinth' },
];

// Recommended by Creator section content
const CREATOR_PICKS = [
  { id:'portal-pack', name:'Portal Pack', desc:'The official modpack curated by Portalrolls — optimized performance + beautiful visuals', color:'#E74C3C', icon:'PP', type:'Modpack', downloads:'Featured', source:'modrinth', featured: true },
  { id:'sodium', name:'Sodium', desc:'The best performance mod for Minecraft — massive FPS boost', color:'#f59e0b', icon:'S', type:'Mod', downloads:'12.4M', source:'modrinth', featured: false },
  { id:'iris', name:'Iris Shaders', desc:'Use any OptiFine shader with Fabric', color:'#06b6d4', icon:'I', type:'Shader', downloads:'7.3M', source:'modrinth', featured: false },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export function HomePage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const isAuth = useIsAuthenticated();
  const instances = useInstanceStore(s => s.instances);
  const recent = instances
    .filter(i => i.lastPlayed)
    .sort((a, b) => new Date(b.lastPlayed!).getTime() - new Date(a.lastPlayed!).getTime())
    .slice(0, 3);

  return (
    <div className="h-full overflow-y-auto" style={{ padding: '24px 28px' }}>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Welcome banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden p-6"
          style={{
            background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-2) 100%)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}>
          <div className="absolute inset-0 pointer-events-none animate-aurora"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, var(--color-primary-dim) 0%, transparent 55%), radial-gradient(circle at 85% 20%, rgba(59,130,246,0.18) 0%, transparent 55%), radial-gradient(circle at 60% 90%, rgba(139,92,246,0.12) 0%, transparent 55%)' }} />
          <div className="relative z-10">
            <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--color-text)' }}>
              {user ? `Welcome back, ${user.username}!` : 'Welcome to Portal Launcher'}
            </h1>
            <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
              {user ? 'Your Minecraft worlds are ready.' : 'Sign in with Microsoft to start playing.'}
            </p>
            <div className="flex gap-2.5 flex-wrap">
              {isAuth ? (
                <button onClick={() => navigate('/library')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 hover:-translate-y-0.5"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-primary-text)', boxShadow: '0 6px 20px var(--color-primary-dim)' }}>
                  <Play className="w-4 h-4 fill-current" />Play
                </button>
              ) : (
                <button onClick={() => navigate('/settings/account')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 hover:-translate-y-0.5"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-primary-text)', boxShadow: '0 6px 20px var(--color-primary-dim)' }}>
                  Sign in with Microsoft
                </button>
              )}
              <button onClick={() => navigate('/library')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--color-surface-active)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                <Plus className="w-4 h-4" />Create Instance
              </button>
              <button onClick={() => navigate('/discover')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--color-surface-active)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                <Compass className="w-4 h-4" />Discover
              </button>
              <button onClick={() => navigate('/gallery')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--color-surface-active)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                <Camera className="w-4 h-4" />Gallery
              </button>
            </div>
          </div>
        </motion.div>

        {/* Jump back in */}
        {recent.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Clock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />Jump back in
              </h2>
              <button onClick={() => navigate('/library')}
                className="flex items-center gap-1 text-xs font-semibold hover:opacity-80"
                style={{ color: 'var(--color-primary)' }}>
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <motion.div className="grid grid-cols-3 gap-3" variants={stagger} initial="hidden" animate="show">
              {recent.map(inst => (
                <motion.div key={inst.id} variants={fadeUp}>
                  <InstanceCard inst={inst} />
                </motion.div>
              ))}
            </motion.div>
          </section>
        )}

        {/* Recommended by Creator */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Star className="w-4 h-4 fill-current" style={{ color: '#f59e0b' }} />
              Recommended by Creator
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
              style={{ background: 'rgba(231,76,60,0.1)', color: 'var(--color-error)', border: '1px solid rgba(231,76,60,0.2)' }}>
              by Portalrolls
            </span>
          </div>
          <motion.div className="grid grid-cols-3 gap-3" variants={stagger} initial="hidden" animate="show">
            {CREATOR_PICKS.map(pick => (
              <motion.div key={pick.id} variants={fadeUp}
                className="p-4 rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5 relative overflow-hidden"
                style={{ background: 'var(--color-surface)', border: `1px solid ${pick.featured ? 'rgba(231,76,60,0.4)' : 'var(--color-border)'}` }}
                onClick={() => navigate(`/discover/modrinth/${pick.id}`)}>
                {pick.featured && (
                  <div className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ background: 'linear-gradient(90deg, #E74C3C, #E74C3C44)' }} />
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black shrink-0"
                    style={{ background: `${pick.color}18`, color: pick.color }}>
                    {pick.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>{pick.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{pick.type}</p>
                  </div>
                </div>
                <p className="text-[11px] line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{pick.desc}</p>
                <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>↓ {pick.downloads}</span>
                  {pick.featured && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: 'rgba(231,76,60,0.1)', color: 'var(--color-error)' }}>
                      FEATURED
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Discover modpacks */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Zap className="w-4 h-4" style={{ color: '#f59e0b' }} />Discover modpacks
            </h2>
            <button onClick={() => navigate('/discover')}
              className="flex items-center gap-1 text-xs font-semibold hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}>
              View more <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <motion.div className="grid grid-cols-4 gap-3" variants={stagger} initial="hidden" animate="show">
            {FEATURED.map(mp => (
              <motion.div key={mp.id} variants={fadeUp}
                className="rounded-2xl overflow-hidden cursor-pointer group transition-all hover:-translate-y-1"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                onClick={() => navigate('/discover')}>
                <div className="h-20 flex items-center justify-center text-3xl font-black"
                  style={{ background: `linear-gradient(135deg, ${mp.color}33, ${mp.color}11)`, color: mp.color }}>
                  {mp.icon}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-xs truncate" style={{ color: 'var(--color-text)' }}>{mp.name}</h3>
                  <p className="text-[10px] mt-0.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{mp.desc}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {mp.tags.slice(0, 2).map(t => (
                      <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>↓ {mp.downloads}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Trending mods */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-error)' }} />Popular mods
            </h2>
            <button onClick={() => navigate('/discover')}
              className="flex items-center gap-1 text-xs font-semibold hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}>
              View more <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {TRENDING_MODS.map(mod => (
              <div key={mod.id}
                className="p-4 rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                onClick={() => navigate(`/discover/${mod.source}/${mod.id}`)}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black mb-3"
                  style={{ background: `${mod.color}18`, color: mod.color }}>
                  {mod.icon}
                </div>
                <h3 className="font-bold text-xs" style={{ color: 'var(--color-text)' }}>{mod.name}</h3>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{mod.desc}</p>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>↓ {mod.downloads}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Resource packs */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <span className="w-4 h-4 text-base" style={{ color: '#a78bfa' }}>🎨</span>
              Popular resource packs & shaders
            </h2>
            <button onClick={() => navigate('/discover')}
              className="flex items-center gap-1 text-xs font-semibold hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}>
              View more <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {RESOURCE_PACKS.map(rp => (
              <div key={rp.id}
                className="p-4 rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                onClick={() => navigate(`/discover/${rp.source}/${rp.id}`)}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black mb-3"
                  style={{ background: `${rp.color}18`, color: rp.color }}>
                  {rp.icon}
                </div>
                <h3 className="font-bold text-xs" style={{ color: 'var(--color-text)' }}>{rp.name}</h3>
                <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{rp.desc}</p>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>↓ {rp.downloads}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
