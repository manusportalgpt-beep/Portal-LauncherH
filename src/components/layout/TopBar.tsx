import { useTranslation } from 'react-i18next';

export function TopBar() {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">{t('app.name')}</p>
        <h2 className="text-xl font-semibold text-[var(--color-text)]">{t('app.tagline')}</h2>
      </div>
      <button className="rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-text)] shadow-sm shadow-[rgba(108,92,231,0.25)]">
        {t('auth.signIn')}
      </button>
    </header>
  );
}
