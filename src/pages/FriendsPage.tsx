import { useTranslation } from 'react-i18next';

export function FriendsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('friends.title')}</h2>
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-secondary)]">
        View your friends list, chat, and voice call features.
      </div>
    </div>
  );
}
