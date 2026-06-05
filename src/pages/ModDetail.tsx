import { useTranslation } from 'react-i18next';

export function ModDetail() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('discover.install')}</h2>
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-secondary)]">
        View detailed mod information and install mods from CurseForge or Modrinth.
      </div>
    </div>
  );
}
