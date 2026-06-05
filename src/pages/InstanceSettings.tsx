import { useTranslation } from 'react-i18next';

export function InstanceSettings() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('instances.settings')}</h2>
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-secondary)]">
        Update instance name, loader, JVM configuration, and game directory.
      </div>
    </div>
  );
}
