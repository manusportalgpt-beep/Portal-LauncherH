import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Download, Star, X, ChevronDown, Grid, List,
  Package, Sparkles, Layers, SlidersHorizontal, RefreshCw, Wifi,
  Cpu, Image as ImageIcon, Database,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useInstanceStore } from '@/stores/instanceStore';
import { invoke } from '@/lib/invoke-shim';

type ProjectType = 'mods' | 'modpacks' | 'resourcepacks' | 'shaders' | 'datapacks';
type SortOrder = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
type Platform = 'modrinth' | 'curseforge';

interface ModrinthHit {
  project_id: string; slug: string; title: string; description: string;
  author: string; downloads: number; follows: number; icon_url?: string;
  categories: string[]; game_versions: string[]; loaders: string[];
  date_modified: string; color?: number;
}
interface ModrinthResult { hits: ModrinthHit[]; total_hits: number; offset: number; limit: number; }

interface CfMod {
  id: number; name: string; summary: string;
  authors: { name: string }[];
  download_count: number; thumbs_up_count: number;
  logo?: { thumbnail_url: string };
  categories: { name: string }[];
  latest_files_indexes: { game_version: string; mod_loader_type: number }[];
  date_modified: string; slug: string;
}
interface CfResult { data: CfMod[]; pagination: { total_count: number } }

interface Project {
  id: string; slug: string; title: string; description: string;
  author: string; downloads: number; follows: number; iconUrl?: string;
  categories: string[]; gameVersions: string[]; loaders: string[];
  dateModified: string; platform: Platform; projectType: ProjectType;
  color?: string;
}

const PLATFORM_TYPES: Record<ProjectType, { modrinthFacet: string; cfClass: number; label: string; icon: any }> = {
  mods:         { modrinthFacet: 'mod',        cfClass: 6,    label: 'Mods',           icon: Package },
  modpacks:     { modrinthFacet: 'modpack',     cfClass: 4471, label: 'Modpacks',       icon: Layers },
  resourcepacks:{ modrinthFacet: 'resourcepack', cfClass: 12,  label: 'Resource Packs', icon: ImageIcon },
  shaders:      { modrinthFacet: 'shader',      cfClass: 6552, label: 'Shaders',        icon: Sparkles },
  datapacks:    { modrinthFacet: 'datapack',    cfClass: 5820, label: 'Data Packs',     icon: Database },
};

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value:'relevance', label:'Relevance' },
  { value:'downloads', label:'Downloads' },
  { value:'follows',   label:'Follows' },
  { value:'newest',    label:'Newest' },
  { value:'updated',   label:'Updated' },
];

const CF_LOADER_MAP: Record<string, number> = { forge:1, fabric:4, quilt:5, neoforge:6, vanilla:0 };

const MODRINTH_CATEGORIES: Record<ProjectType, string[]> = {
  mods:         ['Adventure','Cursed','Decoration','Economy','Equipment','Food','Game Mechanics','Library','Magic','Mobs','Optimization','Storage','Technology','Transportation','Utility','World Generation'],
  modpacks:     ['Adventure','Multiplayer','Optimization','Vanilla+','Technology','Magic','RPG','Hardcore','Lightweight'],
  resourcepacks:['8x – 16x','32x','64x','128x and above','Alternate','Animated','Realistic','Themed','Vanilla-like'],
  shaders:      ['Atmosphere','Cartoon','Realistic','Semi-Realistic','Vanilla-like'],
  datapacks:    ['Advancement','Decoration','Economy','Experimental','Food','Game Mechanics','Magic','Mobs','Optimization','Storage','Technology','Transportation','Utility','World Generation'],
};

const MC_VERSIONS_BASE = [
  '1.21.4','1.21.3','1.21.2','1.21.1','1.21',
  '1.20.6','1.20.5','1.20.4','1.20.3','1.20.2','1.20.1','1.20',
  '1.19.4','1.19.3','1.19.2','1.19.1','1.19',
  '1.18.2','1.18.1','1.18',
  '1.17.1','1.17',
  '1.16.5','1.16.4','1.16.3','1.16.2','1.16.1','1.16',
  '1.15.2','1.15.1','1.15',
  '1.14.4','1.14.3','1.14.2','1.14.1','1.14',
  '1.13.2','1.13.1','1.13',
  '1.12.2','1.12.1','1.12',
  '1.11.2','1.11.1','1.11',
  '1.10.2','1.10.1','1.10',
  '1.9.4','1.9.2','1.9',
  '1.8.9','1.8.8','1.8.7','1.8.6','1.8.5','1.8.4','1.8.3','1.8.2','1.8.1','1.8',
  '1.7.10','1.7.9','1.7.8','1.7.7','1.7.6','1.7.5','1.7.4','1.7.3','1.7.2',
];

const LOADERS = ['fabric','forge','quilt','neoforge','vanilla'];

function colorFromStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xFFFFFF;
  return '#' + ('000000' + h.toString(16)).slice(-6);
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// Modrinth logo SVG (green circle with M)
function ModrinthLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#1BD96A" />
      <path d="M12 4a8 8 0 0 1 6.32 12.9l-2.13-2.13A5 5 0 0 0 12 7a5 5 0 0 0-4.19 2.77H5.58A8 8 0 0 1 12 4z" fill="white" />
      <path d="M12 20a8 8 0 0 1-6.32-12.9l2.13 2.13A5 5 0 0 0 12 17a5 5 0 0 0 4.19-2.77h2.23A8 8 0 0 1 12 20z" fill="white" />
    </svg>
  );
}

// CurseForge logo SVG (orange flame)
function CurseForgeLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#F16436" />
      <path d="M9 4c0 0 1 3 0 5s-3 3-2 6c.5 1.5 2 3 5 3s5-2 5-4.5c0-1.5-1-2.5-2-3 .5 1-.5 2-1.5 2S12 11.5 13 10s1-3-1-5c0 1.5-1 2.5-1 2.5S9 6.5 9 4z" fill="white" />
    </svg>
  );
}

// Small platform toggle button (icon only, next to search)
function PlatformToggleBtn({ platform, onToggle }: { platform: Platform; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={`Switch to ${platform === 'modrinth' ? 'CurseForge' : 'Modrinth'}`}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all hover:scale-105"
      style={{
        background: platform === 'modrinth' ? 'rgba(27,217,106,0.12)' : 'rgba(241,100,54,0.12)',
        border: `1.5px solid ${platform === 'modrinth' ? '#1BD96A66' : '#F1643666'}`,
        color: platform === 'modrinth' ? '#1BD96A' : '#F16436',
      }}>
      {platform === 'modrinth'
        ? <ModrinthLogo size={16} />
        : <CurseForgeLogo size={16} />}
      <span style={{ fontSize: 11 }}>{platform === 'modrinth' ? 'Modrinth' : 'CurseForge'}</span>
    </button>
  );
}

function ProjectCard({ p, view, onClick }: { p: Project; view: 'grid'|'list'; onClick: ()=>void }) {
  const color = p.color || colorFromStr(p.title);
  const letter = p.title[0]?.toUpperCase() ?? '?';

  const Icon = (
    <div className="rounded-2xl flex items-center justify-center font-black overflow-hidden shrink-0"
      style={{ width: view==='list'?48:40, height: view==='list'?48:40,
               background: p.iconUrl ? 'transparent' : `${color}1A`, color }}>
      {p.iconUrl
        ? <img src={p.iconUrl} alt="" className="w-full h-full object-cover rounded-2xl"
            onError={e => { (e.target as any).style.display='none'; }}
            style={{ imageRendering: p.iconUrl.endsWith('.png') ? 'pixelated' : undefined }} />
        : <span className={view==='list'?'text-lg':'text-sm'}>{letter}</span>}
    </div>
  );

  const PlatformDot = (
    <div className="relative group/plat shrink-0">
      <button
        onClick={(e)=>{ e.stopPropagation(); }}
        data-testid={`mod-platform-dots-${p.id}`}
        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
        style={{ background:'var(--color-surface-2)', color:'var(--color-text-secondary)' }}
        title={`Source: ${p.platform === 'modrinth' ? 'Modrinth' : 'CurseForge'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
      </button>
      <div className="absolute right-0 top-full mt-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap opacity-0 pointer-events-none group-hover/plat:opacity-100 transition-opacity z-20 capitalize"
        style={{
          background: p.platform==='modrinth' ? 'rgba(27,217,106,0.95)' : 'rgba(241,100,54,0.95)',
          color:'#fff',
          boxShadow:'0 4px 12px rgba(0,0,0,0.35)',
        }}>
        from {p.platform}
      </div>
    </div>
  );

  if (view === 'list') {
    return (
      <button onClick={onClick}
        data-testid={`mod-card-${p.id}`}
        className="group/card w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:-translate-y-px"
        style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)' }}>
        {Icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm" style={{ color:'var(--color-text)' }}>{p.title}</p>
          </div>
          <p className="text-[10px] mt-0.5 font-medium" style={{ color:'var(--color-text-secondary)' }}>by {p.author}</p>
          <p className="text-xs mt-1 truncate" style={{ color:'var(--color-text-secondary)' }}>{p.description}</p>
          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
            {p.categories.slice(0,3).map(c => (
              <span key={c} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{ background:'var(--color-surface-2)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>{c}</span>
            ))}
            {p.loaders.slice(0,2).map(l => (
              <span key={l} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md capitalize"
                style={{ background:'var(--color-surface-2)', color:'var(--color-text-tertiary)', border:'1px solid var(--color-border)' }}>{l}</span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="flex items-center justify-end gap-1 text-xs" style={{ color:'var(--color-text-secondary)' }}>
            <Download className="w-3 h-3" />{fmtNum(p.downloads)}
          </div>
          <div className="flex items-center justify-end gap-1 text-xs" style={{ color:'var(--color-text-secondary)' }}>
            <Star className="w-3 h-3" />{fmtNum(p.follows)}
          </div>
          {p.gameVersions.slice(0,1).map(v => (
            <div key={v} className="text-[10px]" style={{ color:'var(--color-text-tertiary)' }}>{v}</div>
          ))}
        </div>
        <div className="opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
          {PlatformDot}
        </div>
      </button>
    );
  }

  return (
    <button onClick={onClick}
      data-testid={`mod-card-${p.id}`}
      className="group/card p-4 rounded-2xl text-left transition-all hover:-translate-y-1 relative"
      style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)' }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        {Icon}
        <div className="opacity-0 group-hover/card:opacity-100 transition-opacity">
          {PlatformDot}
        </div>
      </div>
      <p className="font-bold text-sm leading-tight" style={{ color:'var(--color-text)' }}>{p.title}</p>
      <p className="text-[10px] mt-0.5 font-medium" style={{ color:'var(--color-text-secondary)' }}>by {p.author}</p>
      <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color:'var(--color-text-tertiary)' }}>{p.description}</p>
      <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop:'1px solid var(--color-border)' }}>
        <div className="flex items-center gap-1 text-[10px]" style={{ color:'var(--color-text-tertiary)' }}>
          <Download className="w-3 h-3" />{fmtNum(p.downloads)}
        </div>
        <div className="flex items-center gap-1 text-[10px]" style={{ color:'var(--color-text-tertiary)' }}>
          <Star className="w-3 h-3" />{fmtNum(p.follows)}
        </div>
        <div className="flex-1" />
        {p.loaders.slice(0,2).map(l => (
          <span key={l} className="text-[9px] font-semibold px-1.5 py-0.5 rounded capitalize"
            style={{ background:'var(--color-surface-2)', color:'var(--color-text-secondary)' }}>{l}</span>
        ))}
      </div>
    </button>
  );
}

function FilterSidebar({
  projectType, platform, selectedCats, selectedLoaders, selectedVersions,
  onCat, onLoader, onVersion, onClear, showSnapshots, mcVersions,
}: {
  projectType: ProjectType; platform: Platform;
  selectedCats: string[]; selectedLoaders: string[]; selectedVersions: string[];
  onCat: (c:string)=>void; onLoader: (l:string)=>void; onVersion: (v:string)=>void; onClear: ()=>void;
  showSnapshots: boolean; mcVersions: string[];
}) {
  const cats = MODRINTH_CATEGORIES[projectType];
  const hasFilters = selectedCats.length>0 || selectedLoaders.length>0 || selectedVersions.length>0;

  // Filter out snapshots if not enabled (snapshots have letters like 24w...)
  const SNAPSHOT_RE = /[a-zA-Z]/;
  const versionsToShow = showSnapshots
    ? mcVersions
    : mcVersions.filter(v => !SNAPSHOT_RE.test(v.replace(/\./g,'')));

  const Section = ({ title, children }: { title:string; children:React.ReactNode }) => (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color:'var(--color-text-tertiary)' }}>{title}</p>
      {children}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4">
      {platform === 'modrinth' && (
        <Section title="Categories">
          <div className="space-y-0.5">
            {cats.map(c => (
              <button key={c} onClick={() => onCat(c)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left"
                style={selectedCats.includes(c)
                  ? { background:'rgba(108,92,231,0.15)', color:'var(--color-primary)' }
                  : { color:'var(--color-text-secondary)' }}>
                <div className="w-3 h-3 rounded flex items-center justify-center shrink-0"
                  style={{ background:selectedCats.includes(c)?'var(--color-primary)':'var(--color-surface-2)',
                           border:`1px solid ${selectedCats.includes(c)?'var(--color-primary)':'var(--color-border)'}` }}>
                  {selectedCats.includes(c) && <span className="text-white text-[7px]">✓</span>}
                </div>
                {c}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Loaders">
        <div className="flex flex-wrap gap-1.5">
          {LOADERS.map(l => (
            <button key={l} onClick={() => onLoader(l)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize"
              style={selectedLoaders.includes(l)
                ? { background:'var(--color-primary)', color:'#fff' }
                : { background:'var(--color-surface-2)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
              {l}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Game Version">
        <div className="space-y-0.5">
          {versionsToShow.map(v => (
            <button key={v} onClick={() => onVersion(v)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left"
              style={selectedVersions.includes(v)
                ? { background:'rgba(108,92,231,0.15)', color:'var(--color-primary)' }
                : { color:'var(--color-text-secondary)' }}>
              <div className="w-3 h-3 rounded flex items-center justify-center shrink-0"
                style={{ background:selectedVersions.includes(v)?'var(--color-primary)':'var(--color-surface-2)',
                         border:`1px solid ${selectedVersions.includes(v)?'var(--color-primary)':'var(--color-border)'}` }}>
                {selectedVersions.includes(v) && <span className="text-white text-[7px]">✓</span>}
              </div>
              {v}
            </button>
          ))}
        </div>
      </Section>

      {hasFilters && (
        <button onClick={onClear} className="mt-auto w-full py-2 rounded-xl text-xs font-bold"
          style={{ background:'rgba(231,76,60,0.1)', color:'var(--color-error)' }}>
          Clear all filters
        </button>
      )}
    </div>
  );
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contextInstanceId = searchParams.get('instanceId');
  const defaultPlatform = useSettingsStore(s => s.defaultPlatform);
  const cfApiKey = useSettingsStore(s => s.curseforgeApiKey);
  const showSnapshots = useSettingsStore(s => s.showSnapshots);
  const { instances } = useInstanceStore();
  const contextInstance = contextInstanceId ? instances.find(i => i.id === contextInstanceId) : null;

  const [platform, setPlatform] = useState<Platform>(defaultPlatform);
  const [projectType, setProjectType] = useState<ProjectType>('mods');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('relevance');
  const [view, setView] = useState<'grid'|'list'>('list');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedLoaders, setSelectedLoaders] = useState<string[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  const [results, setResults] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dynamic MC version list from Mojang manifest
  const [mcVersions, setMcVersions] = useState<string[]>(MC_VERSIONS_BASE);
  useEffect(() => {
    fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
      .then(r => r.json())
      .then(data => {
        const SNAP_RE = /[a-zA-Z]/;
        const all: string[] = data.versions.map((v: any) => v.id);
        const filtered = showSnapshots ? all : all.filter((v: string) => !SNAP_RE.test(v.replace(/\./g, '')));
        if (filtered.length > 0) setMcVersions(filtered);
      })
      .catch(() => {});
  }, [showSnapshots]);

  useEffect(() => {
    if (contextInstance) {
      setSelectedVersions([contextInstance.minecraftVersion]);
      if (contextInstance.modLoader && contextInstance.modLoader !== 'vanilla') {
        setSelectedLoaders([contextInstance.modLoader]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextInstance?.id]);

  function fromModrinth(h: ModrinthHit, pt: ProjectType): Project {
    return {
      id: h.project_id, slug: h.slug, title: h.title, description: h.description,
      author: h.author, downloads: h.downloads, follows: h.follows, iconUrl: h.icon_url,
      categories: h.categories, gameVersions: h.game_versions, loaders: h.loaders,
      dateModified: h.date_modified, platform: 'modrinth', projectType: pt,
      color: h.color ? '#' + h.color.toString(16).padStart(6,'0') : undefined,
    };
  }

  function fromCurseForge(m: CfMod, pt: ProjectType): Project {
    const loaderMap: Record<number, string> = { 0:'any', 1:'forge', 2:'cauldron', 3:'liteloader', 4:'fabric', 5:'quilt', 6:'neoforge' };
    return {
      id: String(m.id), slug: m.slug, title: m.name, description: m.summary,
      author: m.authors[0]?.name ?? 'Unknown', downloads: m.download_count, follows: m.thumbs_up_count,
      iconUrl: m.logo?.thumbnail_url,
      categories: m.categories.map(c => c.name),
      gameVersions: [...new Set(m.latest_files_indexes.map(f => f.game_version))],
      loaders: [...new Set(m.latest_files_indexes.map(f => loaderMap[f.mod_loader_type] || 'unknown').filter(l => l !== 'any'))],
      dateModified: m.date_modified, platform: 'curseforge', projectType: pt,
    };
  }

  const doSearch = useCallback(async (q: string, pt: ProjectType, pl: Platform, s: SortOrder, pg: number, cats: string[], ldrs: string[], vers: string[]) => {
    setLoading(true);
    setError(null);
    const offset = pg * PAGE_SIZE;
    try {
      if (pl === 'modrinth') {
        const facetType = PLATFORM_TYPES[pt].modrinthFacet;
        const res = await invoke<ModrinthResult>('search_modrinth', {
          query: q, limit: PAGE_SIZE, offset,
          categories: cats.length > 0 ? cats : undefined,
          versions: vers.length > 0 ? vers : undefined,
          loaders: (pt === 'mods' || pt === 'modpacks') && ldrs.length > 0 ? ldrs : undefined,
          sort: s.charAt(0).toUpperCase() + s.slice(1),
          projectType: facetType,
        });
        setResults((res.hits || []).map(h => fromModrinth(h, pt)));
        setTotal(res.total_hits);
      } else {
        if (!cfApiKey) {
          setError('CurseForge API key not set. Add it in Settings → Advanced.');
          setResults([]); setTotal(0); return;
        }
        const loaderNum = (pt === 'mods' || pt === 'modpacks') && ldrs.length > 0 ? (CF_LOADER_MAP[ldrs[0]] ?? undefined) : undefined;
        const sortField = s === 'downloads' ? 6 : s === 'newest' ? 11 : s === 'updated' ? 3 : 2;
        const res = await invoke<CfResult>('search_curseforge', {
          query: q, limit: PAGE_SIZE, offset,
          classId: PLATFORM_TYPES[pt].cfClass,
          gameVersion: vers.length > 0 ? vers[0] : undefined,
          modLoaderType: loaderNum,
          sortField,
          apiKey: cfApiKey,
        });
        const cfData = (res.data || []) as CfMod[];
        setResults(cfData.map(m => fromCurseForge(m, pt)));
        setTotal(res.pagination?.total_count ?? cfData.length);
      }
    } catch (e: any) {
      const msg = String(e);
      if (!navigator.onLine || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('connection')) {
        setError('Проверьте подключение к интернету.');
      } else {
        setError(null);
      }
      setResults([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [cfApiKey]);

  const triggerSearch = useCallback((immediate = false) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const delay = immediate ? 0 : 350;
    searchTimeout.current = setTimeout(() => {
      setPage(0);
      doSearch(query, projectType, platform, sort, 0, selectedCats, selectedLoaders, selectedVersions);
    }, delay);
  }, [query, projectType, platform, sort, selectedCats, selectedLoaders, selectedVersions, doSearch]);

  useEffect(() => {
    triggerSearch();
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, projectType, platform, sort, selectedCats, selectedLoaders, selectedVersions]);

  useEffect(() => {
    if (page > 0) doSearch(query, projectType, platform, sort, page, selectedCats, selectedLoaders, selectedVersions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const toggleCat     = (c: string) => setSelectedCats(s    => s.includes(c) ? s.filter(x=>x!==c) : [...s,c]);
  const toggleLoader  = (l: string) => setSelectedLoaders(s => s.includes(l) ? s.filter(x=>x!==l) : [...s,l]);
  const toggleVersion = (v: string) => setSelectedVersions(s=> s.includes(v) ? s.filter(x=>x!==v) : [...s,v]);
  const clearFilters  = () => { setSelectedCats([]); setSelectedLoaders([]); setSelectedVersions([]); };

  const hasFilters = selectedCats.length>0 || selectedLoaders.length>0 || selectedVersions.length>0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function togglePlatform() {
    setPlatform(p => p === 'modrinth' ? 'curseforge' : 'modrinth');
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 shrink-0 flex-wrap"
        style={{ borderBottom:'1px solid var(--color-border)' }}>

        {/* Type tabs */}
        <div className="flex gap-1 flex-wrap">
          {(Object.entries(PLATFORM_TYPES) as [ProjectType, typeof PLATFORM_TYPES[ProjectType]][]).map(([t, def]) => {
            const Icon = def.icon;
            return (
              <button key={t} onClick={() => setProjectType(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={projectType===t
                  ? { background:'var(--color-surface-2)', color:'var(--color-text)', border:'1px solid var(--color-border)' }
                  : { color:'var(--color-text-secondary)' }}>
                <Icon className="w-3.5 h-3.5" />{def.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Sort */}
        <div className="relative shrink-0">
          <select value={sort} onChange={e => setSort(e.target.value as SortOrder)}
            className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)', color:'var(--color-text)' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color:'var(--color-text-secondary)' }} />
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border:'1px solid var(--color-border)' }}>
          {([['list',List],['grid',Grid]] as const).map(([v, Icon]) => (
            <button key={v} onClick={() => setView(v as 'grid'|'list')}
              className="w-8 h-8 flex items-center justify-center transition-all"
              style={view===v ? { background:'var(--color-primary)', color:'#fff' } : { color:'var(--color-text-secondary)' }}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button onClick={() => setShowFilters(f => !f)}
          className="w-8 h-8 flex items-center justify-center rounded-xl transition-all shrink-0"
          style={{ background:showFilters?'var(--color-primary)':'var(--color-surface-2)', color:showFilters?'#fff':'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* ── Search bar row with Platform toggle ── */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ borderBottom:'1px solid var(--color-border)', background:'var(--color-surface)' }}>
        {/* Search input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color:'var(--color-text-tertiary)' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${platform === 'modrinth' ? 'Modrinth' : 'CurseForge'}…`}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm"
            style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)', color:'var(--color-text)' }}
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5" style={{ color:'var(--color-text-tertiary)' }} />
            </button>
          )}
        </div>

        {/* Platform toggle button — small, icon+label, next to search */}
        <PlatformToggleBtn platform={platform} onToggle={togglePlatform} />

        {loading && <RefreshCw className="w-4 h-4 animate-spin shrink-0" style={{ color:'var(--color-text-tertiary)' }} />}
      </div>

      {/* ── Error banner ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
            className="px-4 py-2 flex items-center gap-2 text-xs font-semibold shrink-0"
            style={{ background:'rgba(231,76,60,0.1)', color:'var(--color-error)', borderBottom:'1px solid rgba(231,76,60,0.2)' }}>
            <Wifi className="w-3.5 h-3.5 shrink-0" />{error}
            {!cfApiKey && platform === 'curseforge' && (
              <button onClick={() => window.location.href = '/settings/advanced'}
                className="ml-2 underline">Go to Settings</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Filter sidebar */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.aside
              initial={{ width:0, opacity:0 }} animate={{ width:200, opacity:1 }} exit={{ width:0, opacity:0 }}
              transition={{ type:'spring', stiffness:400, damping:36 }}
              className="shrink-0 h-full overflow-hidden"
              style={{ borderRight:'1px solid var(--color-border)', background:'var(--color-surface)' }}>
              <FilterSidebar
                projectType={projectType} platform={platform}
                selectedCats={selectedCats} selectedLoaders={selectedLoaders} selectedVersions={selectedVersions}
                onCat={toggleCat} onLoader={toggleLoader} onVersion={toggleVersion} onClear={clearFilters}
                showSnapshots={showSnapshots} mcVersions={mcVersions}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4">
          {/* Stats bar */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs" style={{ color:'var(--color-text-tertiary)' }}>
              {loading ? 'Searching…' : `${total.toLocaleString()} results`}
              {hasFilters && <span> (filtered)</span>}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs font-semibold hover:opacity-80"
                style={{ color:'var(--color-error)' }}>Clear filters</button>
            )}
          </div>

          {/* Grid/List */}
          {loading && results.length === 0 ? (
            <div className={view==='grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
              {Array.from({length:12}).map((_,i) => (
                <div key={i} className="rounded-2xl skeleton" style={{ height: view==='grid'?160:72 }} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm font-semibold" style={{ color:'var(--color-text-secondary)' }}>
                {platform === 'curseforge' && !cfApiKey ? 'Add your CurseForge API key in Settings → Advanced' : 'No results found'}
              </p>
              <p className="text-xs" style={{ color:'var(--color-text-tertiary)' }}>
                {query ? `Nothing matched "${query}"` : 'Try a different search or adjust filters'}
              </p>
            </div>
          ) : (
            <div className={view==='grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
              {results.map(p => (
                <ProjectCard key={`${p.platform}-${p.id}`} p={p} view={view}
                  onClick={() => navigate(`/discover/${p.platform}/${p.slug || p.id}`)} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6 pb-2">
              <button onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}
                className="px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                style={{ background:'var(--color-surface-2)', color:'var(--color-text)', border:'1px solid var(--color-border)' }}>
                Previous
              </button>
              <span className="text-xs px-3" style={{ color:'var(--color-text-secondary)' }}>
                Page {page+1} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}
                className="px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                style={{ background:'var(--color-surface-2)', color:'var(--color-text)', border:'1px solid var(--color-border)' }}>
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
