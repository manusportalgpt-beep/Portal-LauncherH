import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n';

export type Lang = 'en' | 'ru' | 'uk' | 'zh' | 'de' | 'fr';

const NAMES: Record<Lang, string> = {
  en: 'English',
  ru: 'Русский', uk: 'Українська',
  zh: '中文 (简体)',
  de: 'Deutsch',
  fr: 'Français',
};

interface LanguageState {
  lang: Lang;
  setLang: (l: Lang) => void;
  getName: (l: Lang) => string;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      lang: 'en' as Lang,
      setLang: (lang: Lang) => {
        set({ lang });
        void i18n.changeLanguage(lang);
      },
      getName: (l: Lang) => NAMES[l],
    }),
    { name: 'portal-language' }
  )
);
