import { useTranslation } from 'react-i18next';

export function InstancesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('instances.title')}</h2>
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-secondary)]">
        Create and manage your Minecraft instances.
      </div>
    </div>
  );
}
