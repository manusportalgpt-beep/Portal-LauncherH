import { useState, useRef, useEffect, type DragEvent } from 'react';
import { invoke } from '@/lib/invoke-shim';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Check, User, AlertCircle, RotateCcw } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';

/** 2D Skin Views - shows skin from all sides (no 3D) */
function SkinViews2D({ userUuid }: { userUuid: string }) {
  const uuid = userUuid || '8667ba71-b85a-4004-af54-457a9734eed7';
  const frontUrl = `https://crafatar.com/renders/body/${uuid}?scale=10&overlay`;
  const backUrl = `https://crafatar.com/renders/body/${uuid}?scale=10&overlay&rotate=180`;
  const leftUrl = `https://crafatar.com/renders/body/${uuid}?scale=10&overlay&rotate=90`;
  const rightUrl = `https://crafatar.com/renders/body/${uuid}?scale=10&overlay&rotate=-90`;
  const headUrl = `https://crafatar.com/renders/head/${uuid}?scale=10&overlay`;

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Front</span>
          <div className="w-full aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <img src={frontUrl} alt="Front view" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Back</span>
          <div className="w-full aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <img src={backUrl} alt="Back view" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Left Side</span>
          <div className="w-full aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <img src={leftUrl} alt="Left view" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Right Side</span>
          <div className="w-full aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <img src={rightUrl} alt="Right view" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Head</span>
        <div className="w-32 h-32 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
          <img src={headUrl} alt="Head" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
        </div>
      </div>
    </div>
  );
}

function SkinPreview2D({ uuid, skinUrl }: { uuid: string; skinUrl?: string }) {
  const bodyUrl = `https://crafatar.com/renders/body/${uuid}?scale=15&overlay`;
  const headUrl = `https://crafatar.com/renders/head/${uuid}?scale=10&overlay`;
  const rawSkinUrl = skinUrl || `https://crafatar.com/skins/${uuid}`;

  return (
    <div className="w-full rounded-3xl overflow-hidden border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
      <div className="grid gap-4 p-4">
        <div className="rounded-3xl overflow-hidden border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <img src={bodyUrl} alt="Skin preview" className="w-full h-auto object-contain" style={{ imageRendering: 'pixelated' }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl overflow-hidden border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <img src={headUrl} alt="Head preview" className="w-full h-auto object-contain" style={{ imageRendering: 'pixelated' }} />
          </div>
          <div className="rounded-3xl overflow-hidden border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Raw skin sheet</p>
            <img src={rawSkinUrl} alt="Skin sheet" className="w-full h-auto object-contain" style={{ imageRendering: 'pixelated' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const PRESET_SKINS = [
  { name: 'Steve', model: 'classic' as const, color: '#5C8ACF', icon: 'S', uuid: '8667ba71-b85a-4004-af54-457a9734eed7' },
  { name: 'Alex', model: 'slim' as const, color: '#C8825C', icon: 'A', uuid: '3-Alex' },
];

export function SkinSelectorPage() {
  const user = useCurrentUser();
  const [model, setModel] = useState<'classic' | 'slim'>('classic');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render skin views
  const [isLoadingSkin, setIsLoadingSkin] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const skinUrl = user?.skinUrl;
  const userUuid = user?.uuid || '8667ba71-b85a-4004-af54-457a9734eed7';
  const activePreset = selectedPreset ? PRESET_SKINS.find(p => p.name === selectedPreset) : null;
  const previewUuid = activePreset?.uuid || userUuid;
  const previewModel = activePreset?.model || model;
  const previewSkinSource = activePreset?.uuid
    ? `https://crafatar.com/skins/${activePreset.uuid}`
    : skinUrl || `https://crafatar.com/skins/${userUuid}`;

  // Fetch current skin from Microsoft when page loads
  const fetchCurrentSkin = async () => {
    if (!user || !user.accessToken || user.isDemo) return;
    setIsLoadingSkin(true);
    try {
      const skinInfo = await invoke<any>('get_current_skin', {
        access_token: user.accessToken,
      });
      if (skinInfo) {
        setModel(skinInfo.variant === 'slim' ? 'slim' : 'classic');
      }
    } catch (e) {
      console.error('Failed to fetch skin:', e);
    } finally {
      setIsLoadingSkin(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user || !user.accessToken || user.isDemo) {
      setUploadError('Demo accounts cannot upload skins. Please sign in with Microsoft.');
      setTimeout(() => setUploadError(''), 6000);
      return;
    }
    setUploading(true);
    setUploadSuccess(false);
    setUploadError('');
    setSelectedPreset(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      await invoke('upload_skin_bytes', {
        access_token: user.accessToken,
        data: bytes,
        variant: model,
      });
      setUploadSuccess(true);
      setRefreshKey(k => k + 1);
      setTimeout(fetchCurrentSkin, 2000);
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (e: any) {
      setUploadError(e.message || String(e));
      setTimeout(() => setUploadError(''), 6000);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'image/png') handleFileUpload(file);
  };

  const handleApplyPreset = async (presetName: string) => {
    const preset = PRESET_SKINS.find((item) => item.name === presetName);
    if (!preset || !user || !user.accessToken || user.isDemo) return;

    setUploadError('');
    setUploading(true);
    setUploadSuccess(false);
    try {
      const response = await fetch(`https://crafatar.com/skins/${preset.uuid}`);
      if (!response.ok) throw new Error('Failed to download preset skin');
      const buffer = await response.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      await invoke('upload_skin_bytes', {
        access_token: user.accessToken,
        data: bytes,
        variant: preset.model,
      });
      setUploadSuccess(true);
      setSelectedPreset(null);
      setModel(preset.model);
      setRefreshKey(k => k + 1);
      setTimeout(fetchCurrentSkin, 2000);
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (e: any) {
      setUploadError(e.message || String(e));
      setTimeout(() => setUploadError(''), 6000);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    // Reset to default skin (Steve/Alex)
    setModel('classic');
    setRefreshKey(k => k + 1);
  };

  // Auto-fetch skin on mount and when user changes
  useEffect(() => {
    fetchCurrentSkin();
  }, [user?.uuid, user?.accessToken]);

  return (
    <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto">
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Skin Selector</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Customize your Minecraft character's appearance
          </p>
        </div>
        <button onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
          style={{ background: 'var(--color-surface-active)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
          <RotateCcw className="w-4 h-4" />Reset
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="w-96 flex-shrink-0 flex flex-col gap-4">
          <div className="rounded-3xl overflow-hidden border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
            <SkinPreview2D key={`${previewSkinSource}-${previewModel}-${refreshKey}`} uuid={previewUuid} skinUrl={skinUrl} />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center rounded-2xl p-4"
            style={{ background: 'radial-gradient(ellipse at center, var(--color-surface-2) 0%, var(--color-surface) 100%)', border: '1px solid var(--color-border)' }}>
            <SkinViews2D userUuid={previewUuid} />
            {user && (
              <div className="mt-4 text-center">
                <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{user.username}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Model: {previewModel === 'classic' ? 'Classic Arms' : 'Slim Arms'}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 p-1 rounded-xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {(['classic', 'slim'] as const).map(m => (
              <button key={m} onClick={() => {
                setSelectedPreset(null);
                setModel(m);
              }}
                className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all"
                style={model === m && !selectedPreset
                  ? { background: 'var(--color-primary)', color: 'var(--color-primary-text)' }
                  : { color: 'var(--color-text-secondary)' }}>
                {m === 'classic' ? 'Classic Arms' : 'Slim Arms'}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Options */}
        <div className="flex-1 overflow-y-auto space-y-5">
          {/* Upload Custom Skin */}
          <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-bold mb-1" style={{ color: 'var(--color-text)' }}>Upload Custom Skin</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Upload a PNG skin to your Microsoft account. Changes apply to all Minecraft sessions.
            </p>

            {!user ? (
              <div className="text-center py-6 rounded-xl" style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-border)' }}>
                <User className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Sign in to upload skins</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Microsoft account required</p>
              </div>
            ) : user.isDemo ? (
              <div className="text-center py-6 rounded-xl" style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-border)' }}>
                <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Demo accounts can't upload skins</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Sign in with Microsoft to upload your skin online</p>
              </div>
            ) : (
              <>
                <div
                  className="flex flex-col items-center justify-center p-8 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: dragOver ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
                    border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".png,image/png" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                  <Upload className="w-8 h-8 mb-3" style={{ color: dragOver ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {dragOver ? 'Drop to upload' : 'Drag & drop or click to browse'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>PNG, 64×64px</p>
                </div>

                <AnimatePresence>
                  {uploadError && (
                    <motion.div className="mt-3 p-3 rounded-xl flex items-center gap-2"
                      style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)' }}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--color-error)' }} />
                      <p className="text-sm" style={{ color: 'var(--color-error)' }}>{uploadError}</p>
                    </motion.div>
                  )}
                  {(uploading || uploadSuccess) && (
                    <motion.div className="mt-3 flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: uploadSuccess ? 'rgba(46,204,113,0.1)' : 'var(--color-surface-2)', border: `1px solid ${uploadSuccess ? 'var(--color-success)' : 'var(--color-border)'}` }}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {uploading ? (
                        <>
                          <span className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                          <p className="text-sm" style={{ color: 'var(--color-text)' }}>Uploading skin to Microsoft...</p>
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
                          <p className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>Skin uploaded successfully!</p>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Preset Skins */}
          <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-bold mb-1" style={{ color: 'var(--color-text)' }}>Preset Skins</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Classic Minecraft character skins
            </p>
            <div className="grid grid-cols-4 gap-3">
              {PRESET_SKINS.map(preset => (
                <motion.button key={preset.name} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedPreset(preset.name)}
                  className="relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                  style={{
                    background: selectedPreset === preset.name ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
                    border: `1px solid ${selectedPreset === preset.name ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}>
                  {selectedPreset === preset.name && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--color-primary)' }}>
                      <Check className="w-3 h-3" style={{ color: 'var(--color-primary-text)' }} />
                    </div>
                  )}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{ background: `${preset.color}25`, color: preset.color }}>
                    {preset.icon}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{preset.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                      {preset.model === 'classic' ? 'Classic' : 'Slim'}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
            {selectedPreset && (
              <button onClick={() => handleApplyPreset(selectedPreset)} className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-text)' }}>
                Apply {selectedPreset} Skin
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
