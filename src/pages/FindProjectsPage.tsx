import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Download, Star, X, ChevronDown, Grid, List,
  Package, Sparkles, SlidersHorizontal, RefreshCw, AlertCircle,
  Image as ImageIcon, ArrowLeft, Check, Wifi,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useInstanceStore } from '@/stores/instanceStore';
import { invoke } from '@/lib/invoke-shim';

type ProjectType = 'mods' | 'resourcepacks' | 'shaders';
type SortOrder = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
type Platform = 'modrinth' | 'curseforge';

interface ModrinthHit {
  project_id: string; slug: string; title: string; description: string;
  author: string; downloads: number; follows: number; icon_url?: string;
  categories: string[]; game_versions: string[]; loaders: string[];
  date_modified: string; color?: number;
}
interface ModrinthResult { hits: ModrinthHit[]; total_hits: number; }
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

const TYPE_DEFS: Record<ProjectType, { modrinthFacet: string; cfClass: number; label: string; icon: any }> = {
  mods:          { modrinthFacet: 'mod',         cfClass: 6,    label: 'Mods',           icon: Package },
  resourcepacks: { modrinthFacet: 'resourcepack', cfClass: 12,   label: 'Resource Packs', icon: ImageIcon },
  shaders:       { modrinthFacet: 'shader',       cfClass: 6552, label: 'Shaders',        icon: Sparkles },
};
const SORT_OPTIONS = [
  { value:'relevance', label:'Relevance' },
  { value:'downloads', label:'Downloads' },
  { value:'follows',   label:'Follows' },
  { value:'newest',    label:'Newest' },
  { value:'updated',   label:'Updated' },
];
const CF_LOADER_MAP: Record<string, number> = { forge:1, fabric:4, quilt:5, neoforge:6, vanilla:0 };

const MODRINTH_CATS: Record<ProjectType, string[]> = {
  mods:          ['Adventure','Cursed','Decoration','Economy','Equipment','Food','Game Mechanics','Library','Magic','Mobs','Optimization','Storage','Technology','Transportation','Utility','World Generation'],
  resourcepacks: ['8x – 16x','32x','64x','128x and above','Alternate','Animated','Realistic','Themed','Vanilla-like'],
  shaders:       ['Atmosphere','Cartoon','Realistic','Semi-Realistic','Vanilla-like'],
};
const LOADERS = ['fabric','forge','quilt','neoforge','vanilla'];

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

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// ── Install Button ──────────────────────────────────────────────────────────
function InstallBtn({ project, instanceId, mcVersion, loader, isInstalled }: {
  project: Project; instanceId: string; mcVersion: string; loader: string; isInstalled?: boolean;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<'idle'|'busy'|'done'|'err'>('idle');

  if (isInstalled) return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
      style={{ background:'rgba(108,92,231,0.15)', color:'var(--color-primary)', border:'1px solid rgba(108,92,231,0.3)' }}>
      <Check className="w-3.5 h-3.5" />Downloaded
    </div>
  );

  async function doInstall(e: React.MouseEvent) {
    e.stopPropagation();
    if (state !== 'idle') return;
    setState('busy');
    try {
      if (project.platform === 'modrinth') {
        // Ресурс-паки/шейдеры/датапаки не зависят от загрузчика — фильтруем
        // только по версии Minecraft.
        const ptype = project.projectType || 'mod';
        const loaderless = ptype === 'resourcepack' || ptype === 'shader' || ptype === 'datapack';
        // Правильные ИМЕНА параметров (singular) — иначе backend игнорирует
        // фильтр и отдаёт случайную версию ("ставит не ту версию").
        const vers = await invoke<any[]>('get_modrinth_versions', {
          projectId: project.id,
          loader: loaderless || !loader || loader === 'vanilla' ? undefined : loader,
          gameVersion: mcVersion || undefined,
        });
        const byNewest = (a: any, b: any) =>
          new Date(b.date_published).getTime() - new Date(a.date_published).getTime();
        // Строгое совпадение по версии MC (и загрузчику, если он нужен).
        const strict = (vers ?? [])
          .filter((v: any) =>
            (!mcVersion || (v.game_versions ?? []).includes(mcVersion)) &&
            (loaderless || !loader || loader === 'vanilla' || (v.loaders ?? []).includes(loader)))
          .sort(byNewest);
        let ver = strict[0];
        // Предупреждение вместо блокировки: если точного нет — новейшая под MC.
        if (!ver) {
          const all = await invoke<any[]>('get_modrinth_versions', {
            projectId: project.id,
            gameVersion: mcVersion || undefined,
          });
          const relaxed = (all ?? []).sort(byNewest)[0];
          if (relaxed) {
            const ok = window.confirm(
              `⚠️ Warning: no ${loader || 'matching'} build of "${project.title}" for Minecraft ${mcVersion || '(any)'}.\n\n` +
              `Install closest match (${relaxed.version_number}) anyway?`,
            );
            if (!ok) { setState('idle'); return; }
            ver = relaxed;
          }
        }
        if (!ver) { setState('err'); setTimeout(() => setState('idle'), 2500); return; }
        const file = ver.files?.find((f: any) => f.primary) ?? ver.files?.[0];
        if (!file) { setState('err'); setTimeout(() => setState('idle'), 2500); return; }
        const modType =
          ptype === 'shader'       ? 'shaderpack'   :
          ptype === 'resourcepack' ? 'resourcepack' :
          ptype === 'datapack'     ? 'datapack'     : 'mod';
        await invoke('install_mod', {
          instanceId,
          downloadUrl: file.url,
          fileName: file.filename,
          modId: project.id,
          modName: project.title,
          modVersion: ver.version_number || '',
          versionId: ver.id || '',
          source: 'modrinth',
          modType,
          projectId: project.id,
          author: project.author || null,
          iconUrl: project.iconUrl || null,
        });
        setState('done');
      } else {
        // CurseForge — go to detail page with context
        navigate(`/discover/curseforge/${project.slug}`, {
          state: { ...project, contextInstanceId: instanceId, contextMcVersion: mcVersion, contextLoader: loader }
        });
      }
    } catch {
      setState('err');
      setTimeout(() => setState('idle'), 2500);
    }
  }

  if (state === 'done') return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
      style={{ background:'rgba(46,204,113,0.15)', color:'#2ECC71' }}>
      <Check className="w-3.5 h-3.5" />Done
    </div>
  );
  if (state === 'err') return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
      style={{ background:'rgba(231,76,60,0.15)', color:'var(--color-error)' }}>
      <X className="w-3.5 h-3.5" />Failed
    </div>
  );
  return (
    <button onClick={doInstall}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold hover:opacity-90 transition-all"
      style={{ background:'var(--color-primary)', color:'#fff', opacity: state==='busy' ? 0.7 : 1 }}>
      {state === 'busy'
        ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Installing…</>
        : <><Download className="w-3.5 h-3.5" />Install</>}
    </button>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ p, view, instanceId, mcVersion, loader, isInstalled, onClick }: {
  p: Project; view: 'grid'|'list'; instanceId: string; mcVersion: string; loader: string;
  isInstalled?: boolean; onClick: () => void;
}) {
  const accent = p.color || '#6C5CE7';
  if (view === 'list') return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-white/3 transition-all group"
      style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)' }}
      onClick={onClick}>
      <div className="w-12 h-12 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background:`${accent}1A` }}>
        {p.iconUrl
          ? <img src={p.iconUrl} className="w-full h-full object-cover" alt="" />
          : <span className="text-xl font-black" style={{ color: accent }}>{p.title[0]}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm truncate" style={{ color:'var(--color-text)' }}>{p.title}</p>
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 capitalize"
            style={{ background: p.platform==='modrinth'?'#1BD96A22':'#F1643622', color: p.platform==='modrinth'?'#1BD96A':'#F16436' }}>
            {p.platform}
          </span>
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color:'var(--color-text-secondary)' }}>{p.description}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-[10px]" style={{ color:'var(--color-text-tertiary)' }}>
            <Download className="w-3 h-3" />{fmtNum(p.downloads)}
          </span>
          <span className="flex items-center gap-1 text-[10px]" style={{ color:'var(--color-text-tertiary)' }}>
            <Star className="w-3 h-3" />{fmtNum(p.follows)}
          </span>
          <span className="text-[10px]" style={{ color:'var(--color-text-tertiary)' }}>by {p.author}</span>
        </div>
      </div>
      <div onClick={e => e.stopPropagation()}>
        <InstallBtn project={p} instanceId={instanceId} mcVersion={mcVersion} loader={loader} isInstalled={isInstalled} />
      </div>
    </div>
  );
  return (
    <div
      className="flex flex-col p-3 rounded-2xl cursor-pointer hover:bg-white/3 transition-all"
      style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)' }}
      onClick={onClick}>
      <div className="w-full aspect-square rounded-xl mb-3 overflow-hidden flex items-center justify-center"
        style={{ background:`${accent}1A` }}>
        {p.iconUrl
          ? <img src={p.iconUrl} className="w-full h-full object-cover" alt="" />
          : <span className="text-4xl font-black" style={{ color: accent }}>{p.title[0]}</span>}
      </div>
      <p className="font-bold text-sm truncate mb-0.5" style={{ color:'var(--color-text)' }}>{p.title}</p>
      <p className="text-xs mb-2 line-clamp-2 flex-1" style={{ color:'var(--color-text-secondary)' }}>{p.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px]" style={{ color:'var(--color-text-tertiary)' }}>
            <Download className="w-3 h-3" />{fmtNum(p.downloads)}
          </span>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <InstallBtn project={p} instanceId={instanceId} mcVersion={mcVersion} loader={loader} isInstalled={isInstalled} />
        </div>
      </div>
    </div>
  );
}

// ── Filter Sidebar ───────────────────────────────────────────────────────────
function FilterSidebar({ projectType, selectedCats, selectedLoaders, selectedVersions, mcVersions, onCat, onLoader, onVersion, onClear }: {
  projectType: ProjectType;
  selectedCats: string[]; selectedLoaders: string[]; selectedVersions: string[]; mcVersions: string[];
  onCat(c: string): void; onLoader(l: string): void; onVersion(v: string): void; onClear(): void;
}) {
  const cats = MODRINTH_CATS[projectType] ?? [];
  const hasFilters = selectedCats.length>0||selectedLoaders.length>0||selectedVersions.length>0;
  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      {hasFilters && (
        <button onClick={onClear} className="w-full text-xs font-semibold py-1.5 rounded-lg hover:opacity-80"
          style={{ background:'rgba(231,76,60,0.1)', color:'var(--color-error)' }}>
          Clear all filters
        </button>
      )}
      {cats.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color:'var(--color-text-tertiary)' }}>Category</p>
          <div className="space-y-0.5">
            {cats.map(c => (
              <button key={c} onClick={() => onCat(c)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left"
                style={selectedCats.includes(c)
                  ? { background:'var(--color-primary)', color:'#fff' }
                  : { color:'var(--color-text-secondary)' }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {projectType === 'mods' && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color:'var(--color-text-tertiary)' }}>Loader</p>
          <div className="flex flex-wrap gap-1.5">
            {LOADERS.map(l => (
              <button key={l} onClick={() => onLoader(l)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold capitalize"
                style={selectedLoaders.includes(l)
                  ? { background:'var(--color-primary)', color:'#fff' }
                  : { background:'var(--color-surface-2)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color:'var(--color-text-tertiary)' }}>Minecraft Version</p>
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {mcVersions.map(v => (
            <button key={v} onClick={() => onVersion(v)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left"
              style={selectedVersions.includes(v)
                ? { background:'var(--color-primary)', color:'#fff' }
                : { color:'var(--color-text-secondary)' }}>
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function FindProjectsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const instanceId = searchParams.get('instanceId') ?? '';
  const defaultPlatform = useSettingsStore(s => s.defaultPlatform);
  const cfApiKey = useSettingsStore(s => s.curseforgeApiKey);
  const showSnapshots = useSettingsStore(s => s.showSnapshots);
  const { instances } = useInstanceStore();
  const instance = instances.find(i => i.id === instanceId);

  const [platform, setPlatform] = useState<Platform>(defaultPlatform);
  const [projectType, setProjectType] = useState<ProjectType>('mods');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('relevance');
  const [view, setView] = useState<'grid'|'list'>('list');
  const [showFilters, setShowFilters] = useState(true);

  // Auto-set from instance
  const [selectedVersions, setSelectedVersions] = useState<string[]>(instance?.minecraftVersion ? [instance.minecraftVersion] : []);
  const [selectedLoaders, setSelectedLoaders] = useState<string[]>(
    instance?.modLoader && instance.modLoader !== 'vanilla' ? [instance.modLoader] : []
  );
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  const [results, setResults] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [netError, setNetError] = useState(false);
  const [page, setPage] = useState(0);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 20;
  const searchTimeout = useRef<ReturnType<typeof setTimeout>|null>(null);

  // MC versions — always load from Mojang manifest (fallback to base list)
  const [mcVersions, setMcVersions] = useState<string[]>(MC_VERSIONS_BASE);
  useEffect(() => {
    fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
      .then(r => r.json())
      .then(data => {
        const SNAPSHOT_RE = /[a-zA-Z]/;
        const all: string[] = data.versions.map((v: any) => v.id);
        const filtered = showSnapshots ? all : all.filter((v: string) => !SNAPSHOT_RE.test(v.replace(/\./g,'')));
        if (filtered.length > 0) setMcVersions(filtered);
      })
      .catch(() => setMcVersions(MC_VERSIONS_BASE));
  }, [showSnapshots]);

  // Load installed mods for badge display
  useEffect(() => {
    if (!instanceId) return;
    invoke<{id: string}[]>('get_instance_mods', { instance_id: instanceId })
      .then(mods => setInstalledIds(new Set(mods.map(m => m.id))))
      .catch(() => {});
  }, [instanceId]);

  // Re-apply instance filters if instance resolves later
  useEffect(() => {
    if (!instance) return;
    setSelectedVersions([instance.minecraftVersion]);
    if (instance.modLoader && instance.modLoader !== 'vanilla') setSelectedLoaders([instance.modLoader]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id]);

  function fromModrinth(h: ModrinthHit): Project {
    return {
      id: h.project_id, slug: h.slug, title: h.title, description: h.description,
      author: h.author, downloads: h.downloads, follows: h.follows, iconUrl: h.icon_url,
      categories: h.categories, gameVersions: h.game_versions, loaders: h.loaders,
      dateModified: h.date_modified, platform: 'modrinth', projectType,
      color: h.color ? '#' + h.color.toString(16).padStart(6,'0') : undefined,
    };
  }
  function fromCurseForge(m: CfMod): Project {
    const lmap: Record<number,string> = {0:'any',1:'forge',2:'cauldron',3:'liteloader',4:'fabric',5:'quilt',6:'neoforge'};
    return {
      id: String(m.id), slug: m.slug, title: m.name, description: m.summary,
      author: m.authors[0]?.name ?? 'Unknown', downloads: m.download_count, follows: m.thumbs_up_count,
      iconUrl: m.logo?.thumbnail_url,
      categories: m.categories.map(c => c.name),
      gameVersions: [...new Set(m.latest_files_indexes.map(f => f.game_version))],
      loaders: [...new Set(m.latest_files_indexes.map(f => lmap[f.mod_loader_type]||'unknown').filter(l=>l!=='any'))],
      dateModified: m.date_modified, platform: 'curseforge', projectType,
    };
  }

  const doSearch = useCallback(async (q: string, pt: ProjectType, pl: Platform, s: SortOrder, pg: number, cats: string[], ldrs: string[], vers: string[]) => {
    setLoading(true);
    setNetError(false);
    const offset = pg * PAGE_SIZE;
    try {
      if (pl === 'modrinth') {
        const res = await invoke<ModrinthResult>('search_modrinth', {
          query: q, limit: PAGE_SIZE, offset,
          categories: cats.length>0 ? cats : undefined,
          versions: vers.length>0 ? vers : undefined,
          loaders: pt === 'mods' && ldrs.length>0 ? ldrs : undefined,
          sort: s.charAt(0).toUpperCase()+s.slice(1),
          projectType: TYPE_DEFS[pt].modrinthFacet,
        });
        setResults((res.hits||[]).map(h => fromModrinth(h)));
        setTotal(res.total_hits);
      } else {
        if (!cfApiKey) {
          setResults([]); setTotal(0); return;
        }
        const loaderNum = ldrs.length>0 ? (CF_LOADER_MAP[ldrs[0]]??undefined) : undefined;
        const sortField = s==='downloads'?6:s==='newest'?11:s==='updated'?3:2;
        const res = await invoke<CfResult>('search_curseforge', {
          query: q, limit: PAGE_SIZE, offset,
          classId: TYPE_DEFS[pt].cfClass,
          gameVersion: vers.length>0 ? vers[0] : undefined,
          modLoaderType: loaderNum,
          sortField,
          apiKey: cfApiKey,
        });
        setResults((res.data||[]).map(m => fromCurseForge(m)));
        setTotal(res.pagination?.total_count ?? 0);
      }
    } catch {
      // Only show error if definitely offline
      if (!navigator.onLine) setNetError(true);
      setResults([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [cfApiKey]);

  const trigger = useCallback((immediate = false) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(0);
      doSearch(query, projectType, platform, sort, 0, selectedCats, selectedLoaders, selectedVersions);
    }, immediate ? 0 : 350);
  }, [query, projectType, platform, sort, selectedCats, selectedLoaders, selectedVersions, doSearch]);

  useEffect(() => {
    trigger();
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, projectType, platform, sort, selectedCats, selectedLoaders, selectedVersions]);

  useEffect(() => {
    if (page > 0) doSearch(query, projectType, platform, sort, page, selectedCats, selectedLoaders, selectedVersions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const toggleCat    = (c: string) => setSelectedCats(s    => s.includes(c)?s.filter(x=>x!==c):[...s,c]);
  const toggleLoader = (l: string) => setSelectedLoaders(s => s.includes(l)?s.filter(x=>x!==l):[...s,l]);
  const toggleVersion= (v: string) => setSelectedVersions(s=> s.includes(v)?s.filter(x=>x!==v):[...s,v]);
  const clearFilters = () => { setSelectedCats([]); setSelectedLoaders([]); setSelectedVersions([]); };

  const hasFilters = selectedCats.length>0||selectedLoaders.length>0||selectedVersions.length>0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const mcVer  = selectedVersions[0] ?? instance?.minecraftVersion ?? '';
  const loader = selectedLoaders[0]  ?? instance?.modLoader ?? '';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0 flex-wrap"
        style={{ borderBottom:'1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors shrink-0"
          style={{ color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Instance badge */}
        {instance && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl shrink-0"
            style={{ background:`${instance.color||'var(--color-primary)'}15`, border:`1px solid ${instance.color||'var(--color-primary)'}30` }}>
            <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black"
              style={{ background:`${instance.color||'var(--color-primary)'}25`, color:instance.color||'var(--color-primary)' }}>
              {instance.name[0]}
            </div>
            <p className="text-xs font-bold" style={{ color:'var(--color-text)' }}>
              {instance.name}
              <span className="font-normal ml-1.5" style={{ color:'var(--color-text-secondary)' }}>
                {instance.minecraftVersion} · {instance.modLoader}
              </span>
            </p>
          </div>
        )}

        {/* Type tabs */}
        <div className="flex gap-1 flex-wrap">
          {(Object.entries(TYPE_DEFS) as [ProjectType, typeof TYPE_DEFS[ProjectType]][]).map(([t, def]) => {
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
              style={view===v?{background:'var(--color-primary)',color:'#fff'}:{color:'var(--color-text-secondary)'}}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Filters toggle */}
        <button onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0"
          style={showFilters
            ? { background:'var(--color-primary)', color:'#fff' }
            : { background:'var(--color-surface-2)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
          <SlidersHorizontal className="w-3.5 h-3.5" />Filters
          {hasFilters && <span className="w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center bg-white text-[var(--color-primary)]">
            {selectedCats.length+selectedLoaders.length+selectedVersions.length}
          </span>}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filters sidebar */}
        <AnimatePresence>
          {showFilters && (
            <motion.aside key="fs" className="shrink-0 overflow-hidden"
              style={{ borderRight:'1px solid var(--color-border)', background:'var(--color-surface)' }}
              initial={{ width:0, opacity:0 }} animate={{ width:220, opacity:1 }} exit={{ width:0, opacity:0 }}
              transition={{ duration:0.2 }}>
              <FilterSidebar
                projectType={projectType}
                selectedCats={selectedCats} selectedLoaders={selectedLoaders} selectedVersions={selectedVersions}
                mcVersions={mcVersions}
                onCat={toggleCat} onLoader={toggleLoader} onVersion={toggleVersion} onClear={clearFilters} />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="px-4 py-2.5 shrink-0" style={{ borderBottom:'1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl"
                style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}>
                <Search className="w-4 h-4 shrink-0" style={{ color:'var(--color-text-tertiary)' }} />
                <input className="flex-1 bg-transparent text-sm"
                  placeholder={total>0?`Search ${total.toLocaleString()} ${TYPE_DEFS[projectType].label.toLowerCase()}…`:`Search ${TYPE_DEFS[projectType].label.toLowerCase()}…`}
                  value={query} onChange={e => setQuery(e.target.value)}
                  style={{ color:'var(--color-text)' }} />
                {query && <button onClick={() => setQuery('')}><X className="w-3.5 h-3.5" style={{ color:'var(--color-text-tertiary)' }} /></button>}
              </div>
              <button onClick={() => { setPage(0); doSearch(query, projectType, platform, sort, 0, selectedCats, selectedLoaders, selectedVersions); }}
                className="w-10 h-10 flex items-center justify-center rounded-2xl shrink-0"
                style={{ background:'var(--color-surface-2)', border:'1px solid var(--color-border)' }}
                title="Refresh">
                <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} style={{ color:'var(--color-text-secondary)' }} />
              </button>
              {/* Platform toggle — Modrinth ⇄ CurseForge */}
              <button
                onClick={() => setPlatform(p => p === 'modrinth' ? 'curseforge' : 'modrinth')}
                className="flex items-center gap-1.5 h-10 px-3.5 rounded-2xl shrink-0 font-bold text-xs transition-all"
                style={{
                  background: platform === 'modrinth' ? 'rgba(27,217,106,0.12)' : 'rgba(241,100,54,0.12)',
                  border:     `1px solid ${platform === 'modrinth' ? '#1BD96A' : '#F16436'}`,
                  color:      platform === 'modrinth' ? '#1BD96A' : '#F16436',
                }}
                title={`Switch to ${platform === 'modrinth' ? 'CurseForge' : 'Modrinth'}`}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: platform === 'modrinth' ? '#1BD96A' : '#F16436' }} />
                {platform === 'modrinth' ? 'Modrinth' : 'CurseForge'}
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between px-4 py-1.5 shrink-0">
            <div className="flex items-center gap-2">
              {loading
                ? <div className="flex items-center gap-1.5 text-xs" style={{ color:'var(--color-text-secondary)' }}>
                    <RefreshCw className="w-3 h-3 animate-spin" />Searching…
                  </div>
                : <p className="text-xs" style={{ color:'var(--color-text-secondary)' }}>
                    {total>0?`${platform==='curseforge'&&total===10000?'10,000+':total.toLocaleString()} results`:results.length>0?`${results.length} results`:''}
                    {query&&!loading&&<> for "<span style={{ color:'var(--color-text)' }}>{query}</span>"</>}
                  </p>}
            </div>
            {hasFilters && (
              <div className="flex gap-1 flex-wrap justify-end">
                {[...selectedCats,...selectedLoaders,...selectedVersions].slice(0,4).map(tag => (
                  <button key={tag}
                    onClick={() => { setSelectedCats(s=>s.filter(x=>x!==tag)); setSelectedLoaders(s=>s.filter(x=>x!==tag)); setSelectedVersions(s=>s.filter(x=>x!==tag)); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                    style={{ background:'var(--color-surface-2)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
                    {tag} <X className="w-2.5 h-2.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* CurseForge API key missing — visible inline banner */}
            {platform === 'curseforge' && !cfApiKey && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-xs"
                style={{ background:'rgba(241,100,54,0.08)', border:'1px solid rgba(241,100,54,0.3)', color:'#F16436' }}>
                <Wifi className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">CurseForge API key not set. Add it in Settings → Advanced.</span>
                <button onClick={() => navigate('/settings#advanced')}
                  className="underline font-semibold hover:opacity-80">Go to Settings</button>
              </div>
            )}
            {/* Network error */}
            {netError && !loading && (
              <div className="flex items-start gap-3 p-4 rounded-2xl mb-4"
                style={{ background:'rgba(231,76,60,0.08)', border:'1px solid rgba(231,76,60,0.2)' }}>
                <Wifi className="w-4 h-4 mt-0.5 shrink-0" style={{ color:'var(--color-error)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color:'var(--color-error)' }}>Нет подключения</p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--color-text-secondary)' }}>Проверьте подключение к интернету и попробуйте снова.</p>
                </div>
              </div>
            )}

            {/* Loading skeletons */}
            {loading && results.length===0 && (
              <div className="space-y-2">
                {Array.from({length:8}).map((_,i) => (
                  <div key={i} className="h-20 rounded-2xl animate-pulse"
                    style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)' }} />
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && !netError && results.length===0 && (
              <div className="flex flex-col items-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)' }}>
                  <Search className="w-8 h-8" style={{ color:'var(--color-text-tertiary)' }} />
                </div>
                <div className="text-center">
                  <p className="font-bold" style={{ color:'var(--color-text)' }}>No results</p>
                  <p className="text-sm mt-1" style={{ color:'var(--color-text-secondary)' }}>
                    {query?'Try different terms or adjust filters.':'Start searching for '+TYPE_DEFS[projectType].label.toLowerCase()+'.'}
                  </p>
                </div>
                {hasFilters && (
                  <button onClick={clearFilters} className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background:'var(--color-primary)', color:'#fff' }}>Clear filters</button>
                )}
              </div>
            )}

            {/* Results grid/list */}
            {results.length>0 && (
              view==='grid' ? (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 py-2">
                  {results.map(p => (
                    <ProjectCard key={`${p.platform}-${p.id}`} p={p} view="grid"
                      instanceId={instanceId} mcVersion={mcVer} loader={loader}
                      isInstalled={installedIds.has(p.id)}
                      onClick={() => navigate(`/discover/${p.platform}/${p.slug}`, {
                        state: { ...p, contextInstanceId: instanceId, contextMcVersion: mcVer, contextLoader: loader, fromFindProjects: true }
                      })} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  {results.map(p => (
                    <ProjectCard key={`${p.platform}-${p.id}`} p={p} view="list"
                      instanceId={instanceId} mcVersion={mcVer} loader={loader}
                      isInstalled={installedIds.has(p.id)}
                      onClick={() => navigate(`/discover/${p.platform}/${p.slug}`, {
                        state: { ...p, contextInstanceId: instanceId, contextMcVersion: mcVer, contextLoader: loader, fromFindProjects: true }
                      })} />
                  ))}
                </div>
              )
            )}

            {/* Pagination */}
            {totalPages>1 && !loading && (
              <div className="flex items-center justify-center gap-2 py-4">
                <button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
                  style={{ background:'var(--color-surface-2)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
                  ← Prev
                </button>
                <span className="text-xs" style={{ color:'var(--color-text-secondary)' }}>Page {page+1} of {totalPages}</span>
                <button onClick={() => setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
                  style={{ background:'var(--color-surface-2)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border)' }}>
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
