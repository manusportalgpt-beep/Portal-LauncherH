import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ru from './ru.json';
import zh from './zh.json';
import de from './de.json';
import fr from './fr.json';

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  zh: { translation: zh },
  de: { translation: de },
  fr: { translation: fr }
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
