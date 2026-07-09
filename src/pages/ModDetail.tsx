import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Download, Star, Calendar, Code,
  ExternalLink, Zap, X, Check, AlertCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { invoke } from '@/lib/invoke-shim';
import { listen } from '@tauri-apps/api/event';
import { useInstanceStore } from '@/stores/instanceStore';
import type { Instance } from '@/stores/instanceStore';
import { useSettingsStore } from '@/stores/settingsStore';

interface ModVersion {
  id: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  date_published: string;
  downloads: number;
  files: Array<{ url: string; filename: string; primary: boolean }>;
  dependencies: Array<{ dependency_type: string; project_id?: string; version_id?: string }>;
}

interface ModProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  downloads: number;
  follows: number;
  icon_url?: string;
  categories: string[];
  game_versions: string[];
  loaders: string[];
  date_modified: string;
  source_url?: string;
  project_type: string;
  color?: number;
}

function InstancePickerModal({
  onClose, onSelect, modName,
}: {
  onClose: () => void;
  onSelect: (instanceId: string, mcVersion: string, loader: string) => void;
  modName: string;
}) {
  const { instances } = useInstanceStore();

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
        initial={{ scale: 0.93, opacity: 0, y: 14 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 480, damping: 34 }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>Install to Instance</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Pick where to install <span className="font-semibold">{modName}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
        <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
          {instances.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              No instances found. Create one first.
            </p>
          ) : instances.map(inst => (
            <button key={inst.id}
              onClick={() => onSelect(inst.id, inst.minecraftVersion, inst.modLoader)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.01]"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                style={{ background: `${inst.color}1A`, color: inst.color }}>
                {inst.iconPath
                  ? <img src={inst.iconPath} className="w-full h-full rounded-xl object-cover" alt="" />
                  : inst.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{inst.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {inst.minecraftVersion} · <span className="capitalize">{inst.modLoader}</span>
                </p>
              </div>
              <ChevronLeft className="w-4 h-4 rotate-180 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ModDetail() {
  const { source, modId } = useParams<{ source: string; modId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState<ModProject | null>(null);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'desc' | 'versions' | 'deps'>('desc');

  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installMessage, setInstallMessage] = useState('');
  const [installed, setInstalled] = useState(false);
  const [installError, setInstallError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [depInfo, setDepInfo] = useState<Record<string, { name: string; icon_url?: string }>>({});
  const [versionFilter, setVersionFilter] = useState<string>('');
  const [loaderFilter, setLoaderFilter] = useState<string>('');
  const [pendingVersion, setPendingVersion] = useState<ModVersion | null>(null);
  const [installedMods, setInstalledMods] = useState<Set<string>>(new Set());

  const { instances, add: addInstance } = useInstanceStore();
  const cfApiKey = useSettingsStore(s => s.curseforgeApiKey);

  const passedProject = location.state as any;
  const contextInstanceId: string | null = passedProject?.contextInstanceId ?? null;
  const contextMcVersion: string = passedProject?.contextMcVersion ?? '';
  const contextLoader: string = passedProject?.contextLoader ?? '';
  const contextInstance = contextInstanceId ? instances.find((i: { id: string }) => i.id === contextInstanceId) : null;

  useEffect(() => {
    setInstalled(false);
    setInstallError('');
    setInstalledMods(new Set());
    loadProject();
    const unsub = listen('mod-progress', (e: any) => {
      const p = e.payload;
      setInstallProgress(p.percent ?? 0);
      setInstallMessage(p.message ?? '');
    });
    
    // Load installed mods to check if this mod is already installed
    if (contextInstanceId) {
      (async () => {
        try {
          const res = await invoke<any[]>('get_instance_mods', { instanceId: contextInstanceId });
          const modNames = new Set(res.map((m: any) => m.name?.toLowerCase() || m.file_name?.toLowerCase()));
          setInstalledMods(modNames);
          if (modNames.has((project?.title || '').toLowerCase()) || modNames.has((modId || '').toLowerCase())) {
            setInstalled(true);
          }
        } catch {}
      })();
    }
    
    return () => { unsub.then(fn => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, modId, contextInstanceId, cfApiKey]);

  async function loadProject() {
    setLoading(true);
    setError(null);
    try {
      if (source === 'modrinth') {
        const [proj, vers] = await Promise.all([
          invoke<any>('get_modrinth_project', { projectId: modId }),
          invoke<any>('get_modrinth_versions', { projectId: modId }),
        ]);
        setProject({
          id: proj.id,
          slug: proj.slug,
          title: proj.title,
          description: proj.description ?? '',
          body: proj.body ?? proj.description ?? '',
          downloads: proj.downloads ?? 0,
          follows: proj.followers ?? proj.follows ?? 0,
          icon_url: proj.icon_url,
          categories: proj.categories ?? [],
          game_versions: proj.game_versions ?? [],
          loaders: proj.loaders ?? [],
          date_modified: proj.updated ?? proj.date_modified ?? '',
          source_url: proj.source_url,
          project_type: proj.project_type ?? 'mod',
          color: proj.color,
        });
        setVersions(Array.isArray(vers) ? vers : []);
      } else if (source === 'curseforge') {
        const numericId = Number(modId);
        const [proj, filesResp] = await Promise.all([
          invoke<any>('get_curseforge_mod', { modId: numericId, apiKey: cfApiKey }),
          invoke<any>('get_curseforge_mod_files', { modId: numericId, apiKey: cfApiKey }),
        ]);
        const rawFiles: any[] = Array.isArray(filesResp?.data) ? filesResp.data : [];
        const isMcVersion = (str: string) => /^\d+\.\d+/.test(str);
        const mapped: ModVersion[] = rawFiles.map((f: any) => {
          const gv: string[] = Array.isArray(f.gameVersions) ? f.gameVersions : [];
          const mcVers = gv.filter(isMcVersion);
          const loaders = gv.filter(v => !isMcVersion(v)).map(v => v.toLowerCase());
          let url: string | null = (f.downloadUrl as string) ?? null;
          if (!url && f.id && f.fileName) {
            const idStr = String(f.id);
            url = `https://edge.forgecdn.net/files/${idStr.slice(0, 4)}/${idStr.slice(4).replace(/^0+/, '')}/${f.fileName}`;
          }
          return {
            id: String(f.id),
            version_number: f.displayName ?? f.fileName ?? '',
            game_versions: mcVers,
            loaders,
            date_published: f.fileDate ?? '',
            downloads: f.downloadCount ?? 0,
            files: url ? [{ url, filename: f.fileName ?? 'mod.jar', primary: true }] : [],
            dependencies: (f.dependencies ?? []).map((d: any) => ({
              dependency_type: d.relationType === 3 ? 'required' : 'optional',
              project_id: d.modId != null ? String(d.modId) : undefined,
            })),
          };
        });
        setProject({
          id: String(proj.id ?? modId),
          slug: proj.slug ?? '',
          title: proj.name ?? passedProject?.title ?? 'Mod',
          description: proj.summary ?? '',
          body: proj.summary ?? '',
          downloads: proj.downloadCount ?? 0,
          follows: proj.thumbsUpCount ?? 0,
          icon_url: proj.logo?.thumbnailUrl ?? proj.logo?.url ?? passedProject?.iconUrl,
          categories: (proj.categories ?? []).map((c: any) => c.name).filter(Boolean),
          game_versions: Array.from(new Set(mapped.flatMap(v => v.game_versions))),
          loaders: Array.from(new Set(mapped.flatMap(v => v.loaders))),
          date_modified: proj.dateModified ?? '',
          source_url: proj.links?.websiteUrl,
          project_type: 'mod',
        });
        setVersions(mapped);
      } else {
        if (passedProject) {
          setProject({
            id: passedProject.id,
            slug: passedProject.slug,
            title: passedProject.title,
            description: passedProject.description ?? '',
            body: passedProject.description ?? '',
            downloads: passedProject.downloads ?? 0,
            follows: passedProject.follows ?? 0,
            icon_url: passedProject.iconUrl,
            categories: passedProject.categories ?? [],
            game_versions: passedProject.gameVersions ?? [],
            loaders: passedProject.loaders ?? [],
            date_modified: passedProject.dateModified ?? '',
            project_type: passedProject.projectType ?? 'mod',
          });
        } else {
          setError('CurseForge project details require an API key configured in Settings → Advanced.');
        }
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const doInstallModpack = async () => {
    setInstalling(true);
    setInstallError('');
    setInstallProgress(10);
    setInstallMessage('Creating new instance…');
    try {
      const bestVer = versions[0];
      const mcVer = bestVer?.game_versions?.[0] ?? '1.20.1';
      const loaderName = (bestVer?.loaders?.[0] ?? 'fabric') as any;
      const newInst = await invoke<any>('create_instance', {
        name: project?.title ?? 'New Modpack',
        description: project?.description ?? '',
        mcVersion: mcVer,
        loader: loaderName,
        loaderVersion: '',
        minRam: 2048,
        maxRam: 4096,
      });
      const storeInst: Instance = {
        id: newInst.id,
        name: newInst.name,
        description: newInst.description ?? '',
        minecraftVersion: newInst.mc_version,
        modLoader: newInst.loader,
        modLoaderVersion: newInst.loader_version ?? '',
        minRam: newInst.min_ram,
        maxRam: newInst.max_ram,
        gameDir: newInst.id,
        createdAt: newInst.created_at ?? new Date().toISOString(),
        totalPlayTime: 0,
        color: '#6C5CE7',
      };
      addInstance(storeInst);
      await doInstall(newInst.id, mcVer, loaderName);
    } catch (e: any) {
      setInstallError(String(e));
      setInstalling(false);
    }
  };

  // Ресурс-паки, шейдеры и датапаки НЕ зависят от загрузчика (fabric/forge/...),
  // им важна только версия Minecraft. Определяем это по типу проекта.
  const isLoaderless = (() => {
    const t = project?.project_type ?? 'mod';
    return t === 'resourcepack' || t === 'shader' || t === 'datapack';
  })();

  const byNewest = (a: ModVersion, b: ModVersion) =>
    new Date(b.date_published).getTime() - new Date(a.date_published).getTime();

  // Выбирает НОВЕЙШУЮ версию мода. skipLoader=true — игнорировать загрузчик
  // (для ресурс-паков/шейдеров, а также для fallback-предупреждения).
  const pickNewest = (
    list: ModVersion[],
    mcVersion: string,
    loader: string,
    skipLoader = false,
  ): ModVersion | null => {
    const loaderOk = (v: ModVersion) =>
      skipLoader || isLoaderless || !loader || loader === 'vanilla' ||
      (v.loaders ?? []).includes(loader);
    const mcOk = (v: ModVersion) =>
      !mcVersion || (v.game_versions ?? []).includes(mcVersion);
    const matches = list.filter(v => loaderOk(v) && mcOk(v)).sort(byNewest);
    return matches[0] ?? null;
  };

  // Скачивает и устанавливает КОНКРЕТНУЮ версию мода (используется кнопками на
  // вкладке "Versions" и как финальный шаг подбора новейшей версии).
  const runInstall = async (instanceId: string, bestVersion: ModVersion) => {
    if (!bestVersion?.files?.length) {
      throw new Error('No downloadable file for this version.');
    }
    const primaryFile = bestVersion.files.find(f => f.primary) ?? bestVersion.files[0];
    const rawType = project?.project_type ?? 'mod';
    const modType =
      rawType === 'shader'       ? 'shaderpack'  :
      rawType === 'resourcepack' ? 'resourcepack' :
      rawType === 'datapack'     ? 'datapack'     : 'mod';

    await invoke('install_mod', {
      instanceId,
      downloadUrl: primaryFile.url,
      fileName: primaryFile.filename,
      modId: project?.id ?? modId ?? '',
      modName: project?.title ?? '',
      modVersion: bestVersion.version_number,
      versionId: bestVersion.id,
      source: source ?? 'modrinth',
      modType,
      projectId: project?.id,
    });

    setInstalled(true);
    setInstallProgress(100);
    setInstallMessage('Installed!');
    if (project?.title) {
      setInstalledMods(prev => new Set(prev).add(project.title.toLowerCase()));
    }
  };

  const doInstall = async (instanceId: string, mcVersion: string, loader: string) => {
    setShowPicker(false);
    setInstalling(true);
    setInstallError('');
    setInstallProgress(5);
    setInstallMessage('Finding newest compatible version…');
    try {
      // Если пользователь выбрал конкретную версию со страницы мода — ставим именно её.
      if (pendingVersion) {
        await runInstall(instanceId, pendingVersion);
        setPendingVersion(null);
        return;
      }

      // Собираем полный список версий. Для Modrinth просим сузить по MC-версии,
      // но НЕ по загрузчику для ресурс-паков/шейдеров (у них его нет).
      let pool: ModVersion[] = versions;
      if (source === 'modrinth') {
        try {
          const filtered = await invoke<any>('get_modrinth_versions', {
            projectId: modId,
            gameVersion: mcVersion || undefined,
            loader: isLoaderless || loader === 'vanilla' ? undefined : loader,
          });
          if (Array.isArray(filtered) && filtered.length) pool = filtered;
        } catch { /* используем уже загруженный список versions */ }
      }

      // 1) Точное совпадение: загрузчик (если нужен) + версия MC.
      let bestVersion = pickNewest(pool, mcVersion, loader) ?? pickNewest(versions, mcVersion, loader);

      // 2) Предупреждение вместо блокировки: если точного совпадения нет —
      //    предлагаем новейшую под эту версию MC (игнорируя загрузчик).
      if (!bestVersion && !isLoaderless) {
        const relaxed = pickNewest(pool, mcVersion, loader, true) ?? pickNewest(versions, mcVersion, loader, true);
        if (relaxed) {
          const ok = window.confirm(
            `⚠️ Warning: no ${loader || 'matching'} build of "${project?.title ?? 'this mod'}" for Minecraft ${mcVersion || '(any)'}.\n\n` +
            `Closest match: ${relaxed.version_number} (${(relaxed.loaders ?? []).join(', ') || 'unknown loader'}, MC ${(relaxed.game_versions ?? []).join(', ')}).\n\n` +
            `Install it anyway?`,
          );
          if (!ok) { setInstalling(false); setInstallMessage(''); return; }
          bestVersion = relaxed;
        }
      }

      // 3) Последний fallback: новейшая вообще + предупреждение.
      if (!bestVersion) {
        const anyNewest = [...versions].sort(byNewest)[0] ?? null;
        if (anyNewest) {
          const ok = window.confirm(
            `⚠️ Warning: no version of "${project?.title ?? 'this mod'}" matches Minecraft ${mcVersion || '(any)'}.\n\n` +
            `Install newest available (${anyNewest.version_number}) anyway?`,
          );
          if (!ok) { setInstalling(false); setInstallMessage(''); return; }
          bestVersion = anyNewest;
        }
      }

      if (!bestVersion) {
        throw new Error(`No downloadable version found for "${project?.title ?? 'this mod'}".`);
      }

      await runInstall(instanceId, bestVersion);
    } catch (e: any) {
      setInstallError(String(e?.message ?? e));
      setTimeout(() => setInstallError(''), 8000);
    } finally {
      setInstalling(false);
    }
  };

  // Запускается кнопкой "Install" рядом с конкретной версией. Если известен
  // контекстный инстанс — ставим сразу, иначе открываем выбор инстанса,
  // запомнив выбранную версию.
  const installSpecificVersion = (v: ModVersion) => {
    if (installing) return;
    if (contextInstanceId) {
      setPendingVersion(v);
      // doInstall прочитает pendingVersion и поставит именно эту версию.
      setTimeout(() => doInstall(contextInstanceId, contextMcVersion, contextLoader), 0);
    } else {
      setPendingVersion(v);
      setShowPicker(true);
    }
  };


  const color = project?.color ? '#' + project.color.toString(16).padStart(6, '0') : '#6C5CE7';
  const letter = project?.title?.[0]?.toUpperCase() ?? '?';
  const allDeps = (versions[0]?.dependencies ?? []).filter(d => d.dependency_type === 'required');

  const uniqueMcVersions = Array.from(new Set(versions.flatMap(v => v.game_versions ?? [])))
    .filter(v => /^\d+\.\d+/.test(v))
    .sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });

  const uniqueLoaders = Array.from(new Set(versions.flatMap(v => v.loaders ?? [])))
    .filter(Boolean)
    .sort();

  const filteredVersions = versions.filter(v =>
    (!versionFilter || v.game_versions?.includes(versionFilter)) &&
    (!loaderFilter || v.loaders?.includes(loaderFilter)),
  );

  function renderBody(body: string): string {
    return body
      .replace(/<h[1-6][^>]*>/gi, `<p style="font-size:1rem;font-weight:700;margin:1rem 0 0.5rem;color:var(--color-text)">`)
      .replace(/<\/h[1-6]>/gi, '</p>')
      .replace(/<p>/gi, `<p style="margin-bottom:0.75rem;color:var(--color-text-secondary)">`)
      .replace(/<ul>/gi, `<ul style="list-style:disc;padding-left:1.25rem;margin-bottom:0.75rem">`)
      .replace(/<ol>/gi, `<ol style="list-style:decimal;padding-left:1.25rem;margin-bottom:0.75rem">`)
      .replace(/<li>/gi, `<li style="margin-bottom:0.25rem;color:var(--color-text-secondary)">`)
      .replace(/<a /gi, `<a style="color:var(--color-primary);text-decoration:underline" `)
      .replace(/<strong>/gi, `<strong style="color:var(--color-text);font-weight:600">`)
      .replace(/<code>/gi, `<code style="background:var(--color-surface-2);padding:0.1em 0.4em;border-radius:4px;font-size:0.85em">`)
      .replace(/<img([^>]*)>/gi, `<img$1 style="max-width:100%;border-radius:10px;margin:0.75rem 0;display:block">`)
      .replace(
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/gi,
        'https://invidious.io/embed/$1'
      )
      .replace(
        /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/gi,
        'https://invidious.io/embed/$1'
      )
      .replace(/<iframe([^>]*)>/gi, `<iframe$1 style="width:100%;aspect-ratio:16/9;border-radius:10px;border:none;margin:0.75rem 0">`);
  }

  // Fetch real dependency titles + icons from Modrinth
  useEffect(() => {
    if (allDeps.length === 0 || source !== 'modrinth') return;
    allDeps.forEach(async d => {
      if (!d.project_id || depInfo[d.project_id]) return;
      try {
        const p = await invoke<any>('get_modrinth_project', { projectId: d.project_id });
        setDepInfo(prev => ({ ...prev, [d.project_id!]: { name: p.title || d.project_id!, icon_url: p.icon_url } }));
      } catch {
        setDepInfo(prev => ({ ...prev, [d.project_id!]: { name: d.project_id! } }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDeps.length, source]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading project…</p>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center px-6">
          <AlertCircle className="w-8 h-8" style={{ color: 'var(--color-error)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Failed to load project</p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold mt-2"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
            <ChevronLeft className="w-4 h-4" />Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="max-w-4xl mx-auto pb-8 px-4 pt-4">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm mb-6 transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text-secondary)' }}>
          <ChevronLeft className="w-4 h-4" />
          {location.state?.fromFindProjects ? 'Back to Projects' : 'Back to Discover'}
        </button>

        <motion.div className="rounded-2xl p-6 mb-4 flex items-start gap-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden"
            style={{ background: project?.icon_url ? 'transparent' : `${color}25`, color }}>
            {project?.icon_url
              ? <img src={project.icon_url} alt="" className="w-full h-full object-cover rounded-2xl"
                  style={{ imageRendering: 'pixelated' }}
                  onError={e => { (e.target as any).style.display = 'none'; }} />
              : letter}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>{project?.title}</h1>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{project?.description}</p>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {contextInstance && !installing && !installed && (
                  <p className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background:'rgba(108,92,231,0.1)', color:'var(--color-primary)' }}>
                    → {contextInstance.name}
                  </p>
                )}
                <button
                  onClick={() => {
                    if (installing || installed) return;
                    if (project?.project_type === 'modpack' && !contextInstanceId) {
                      doInstallModpack();
                    } else if (contextInstanceId) {
                      doInstall(contextInstanceId, contextMcVersion, contextLoader);
                    } else {
                      setShowPicker(true);
                    }
                  }}
                  disabled={installing || installed}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={installed
                    ? { background: 'rgba(46,204,113,0.15)', color: '#2ECC71', border: '1px solid rgba(46,204,113,0.4)' }
                    : { background: 'var(--color-primary)', color: '#fff', opacity: installing ? 0.75 : 1 }}>
                  {installing
                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{installMessage || 'Installing…'}</>
                    : installed
                    ? <><Check className="w-4 h-4" />Installed</>
                    : <><Zap className="w-4 h-4" />Install</>}
                </button>
                {installing && (
                  <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                    <motion.div className="h-full rounded-full" style={{ background: 'var(--color-primary)' }}
                      animate={{ width: `${installProgress}%` }} transition={{ duration: 0.3 }} />
                  </div>
                )}
                {installError && (
                  <p className="text-xs max-w-[200px] text-right" style={{ color: 'var(--color-error)' }}>{installError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <Download className="w-4 h-4" />{(project?.downloads ?? 0).toLocaleString()} downloads
              </span>
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <Star className="w-4 h-4 fill-current" style={{ color: '#f59e0b' }} />
                {(project?.follows ?? 0).toLocaleString()} followers
              </span>
              {project?.date_modified && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <Calendar className="w-4 h-4" />Updated {new Date(project.date_modified).toLocaleDateString()}
                </span>
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={source === 'modrinth'
                  ? { background: 'rgba(27,217,106,0.12)', color: '#1BD96A' }
                  : { background: 'rgba(241,100,54,0.12)', color: '#F16436' }}>
                {source === 'modrinth' ? 'Modrinth' : 'CurseForge'}
              </span>
              {project?.source_url && (
                <a href={project.source_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-primary)' }}>
                  <ExternalLink className="w-3 h-3" />Source
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {project?.loaders?.map(l => (
                <span key={l} className="text-xs px-2.5 py-1 rounded-lg font-medium capitalize"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                  {l}
                </span>
              ))}
              {project?.game_versions?.slice(0, 6).map(v => (
                <span key={v} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                  {v}
                </span>
              ))}
              {(project?.game_versions?.length ?? 0) > 6 && (
                <span className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}>
                  +{(project?.game_versions?.length ?? 0) - 6} more
                </span>
              )}
            </div>
          </div>
        </motion.div>

        <div className="flex gap-1 mb-4 p-1 rounded-xl"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {([
            ['desc', 'Description'],
            ['versions', `Versions (${versions.length})`],
            ['deps', `Dependencies (${allDeps.length})`],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === id
                ? { background: 'var(--color-primary)', color: '#fff' }
                : { color: 'var(--color-text-secondary)' }}>
              {label}
            </button>
          ))}
        </div>

        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>

          {tab === 'desc' && (
            <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {project?.body ? (
                <div dangerouslySetInnerHTML={{ __html: renderBody(project.body) }} />
              ) : (
                <p>{project?.description ?? 'No description available.'}</p>
              )}
            </div>
          )}

          {tab === 'versions' && (
            <div className="space-y-3">
              {uniqueMcVersions.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap pb-1">
                  <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--color-text-secondary)' }}>Filter:</span>
                  <button
                    onClick={() => setVersionFilter('')}
                    className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                    style={!versionFilter
                      ? { background: 'var(--color-primary)', color: '#fff' }
                      : { background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                    All ({versions.length})
                  </button>
                  {uniqueMcVersions.slice(0, 12).map(mcv => (
                    <button key={mcv}
                      onClick={() => setVersionFilter(mcv === versionFilter ? '' : mcv)}
                      className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                      style={versionFilter === mcv
                        ? { background: 'var(--color-primary)', color: '#fff' }
                        : { background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                      {mcv}
                    </button>
                  ))}
                </div>
              )}
              {uniqueLoaders.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap pb-1">
                  <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--color-text-secondary)' }}>Loader:</span>
                  <button
                    onClick={() => setLoaderFilter('')}
                    className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all capitalize"
                    style={!loaderFilter
                      ? { background: 'var(--color-primary)', color: '#fff' }
                      : { background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                    All
                  </button>
                  {uniqueLoaders.map(ld => (
                    <button key={ld}
                      onClick={() => setLoaderFilter(ld === loaderFilter ? '' : ld)}
                      className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all capitalize"
                      style={loaderFilter === ld
                        ? { background: 'var(--color-primary)', color: '#fff' }
                        : { background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                      {ld}
                    </button>
                  ))}
                </div>
              )}
              {filteredVersions.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-secondary)' }}>
                  No versions match the selected filters
                </p>
              ) : filteredVersions.map(v => (
                <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{v.version_number}</p>
                      {v.loaders?.slice(0, 3).map(l => (
                        <span key={l} className="text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize"
                          style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                          {l}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      {v.game_versions?.slice(0, 4).join(', ')}
                      {(v.game_versions?.length ?? 0) > 4 && ` +${v.game_versions.length - 4}`}
                      {' · '}{new Date(v.date_published).toLocaleDateString()}
                      {v.downloads > 0 && <> · {v.downloads.toLocaleString()} dl</>}
                    </p>
                  </div>
                  <button onClick={() => installSpecificVersion(v)}
                    disabled={installing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                    style={{ background: 'var(--color-primary)', color: '#fff', opacity: installing ? 0.6 : 1 }}>
                    <Download className="w-3 h-3" />Install
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'deps' && (
            <div className="space-y-2">
              {allDeps.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Check className="w-8 h-8" style={{ color: '#2ECC71' }} />
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No required dependencies</p>
                </div>
              ) : allDeps.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-3">
                    {d.project_id && depInfo[d.project_id]?.icon_url
                      ? <img src={depInfo[d.project_id].icon_url} alt=""
                          className="w-8 h-8 rounded-lg shrink-0 object-cover"
                          style={{ imageRendering: 'pixelated' }}
                          onError={e => { (e.target as any).style.display='none'; }} />
                      : <Code className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />}
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {d.project_id
                          ? (depInfo[d.project_id]
                              ? depInfo[d.project_id].name
                              : <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" style={{ borderColor:'var(--color-text-tertiary)', borderTopColor:'transparent' }} />
                                  <span style={{ color:'var(--color-text-secondary)' }}>{d.project_id}</span>
                                </span>)
                          : 'Unknown dependency'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-error)' }}>Required</p>
                    </div>
                  </div>
                  {d.project_id && (
                    <button onClick={() => navigate(`/discover/modrinth/${d.project_id}`, {
                      state: contextInstanceId ? { contextInstanceId, contextMcVersion, contextLoader } : undefined
                    })}
                      className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                      <ExternalLink className="w-3 h-3" />View
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showPicker && (
          <InstancePickerModal modName={project?.title ?? ''} onClose={() => { setShowPicker(false); setPendingVersion(null); }} onSelect={doInstall} />
        )}
      </AnimatePresence>
    </div>
  );
}
