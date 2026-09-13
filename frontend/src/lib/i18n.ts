import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  resources: {
    fr: {
      translation: {
        appName: 'eXpert',
        login: 'Connexion',
        dossiers: 'Dossiers',
        dashboard: 'Tableau de bord',
      },
    },
    en: {
      translation: {
        appName: 'eXpert',
        login: 'Sign in',
        dossiers: 'Cases',
        dashboard: 'Dashboard',
      },
    },
  },
});

export default i18n;
