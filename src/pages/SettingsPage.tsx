import { useTranslation } from 'react-i18next';

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('settings.general')}</h2>
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-secondary)]">
        Customize theme, language, chat and audio preferences.
      </div>
    </div>
  );
}
