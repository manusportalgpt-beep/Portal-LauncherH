import { useTranslation } from 'react-i18next';

export function LibraryPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('nav.library')}</h2>
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-secondary)]">
        Browse installed content and manage your Minecraft library.
      </div>
    </div>
  );
}
