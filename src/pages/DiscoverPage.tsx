import { useTranslation } from 'react-i18next';

export function DiscoverPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('nav.discover')}</h2>
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-secondary)]">
        Discover Minecraft mods across CurseForge and Modrinth.
      </div>
    </div>
  );
}
