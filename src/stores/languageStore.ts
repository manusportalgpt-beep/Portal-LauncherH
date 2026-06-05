import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n';

export type Lang = 'en' | 'ru' | 'zh' | 'de' | 'fr';

export const useLanguageStore = create(
  persist(
    (set, get) => ({
      lang: 'en' as Lang,
      setLang: (lang: Lang) => {
        set({ lang });
        i18n.changeLanguage(lang);
      },
      getName: (lang: Lang) => {
        return {
          en: 'English',
          ru: 'Русский',
          zh: '中文',
          de: 'Deutsch',
          fr: 'Français'
        }[lang];
      }
    }),
    { name: 'portal-launcher-language' }
  )
);
