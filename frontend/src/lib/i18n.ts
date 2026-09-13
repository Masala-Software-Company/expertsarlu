import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: localStorage.getItem('expert-lang') || 'fr',
  fallbackLng: 'fr',
  resources: {
    fr: {
      translation: {
        appName: 'eXpert',
        login: 'Connexion',
        dossiers: 'Dossiers',
        dashboard: 'Tableau de bord',
        prospects: 'Prospects',
        partenaires: 'Partenaires',
        inbox: 'Inbox',
        protocole: 'Protocole',
        tarification: 'Tarification',
        corbeille: 'Corbeille',
        audit: 'Audit',
        equipe: 'Équipe',
        profile: 'Mon profil',
        logout: 'Déconnexion',
        search: 'Rechercher…',
        save: 'Enregistrer',
        cancel: 'Annuler',
      },
    },
    en: {
      translation: {
        appName: 'eXpert',
        login: 'Sign in',
        dossiers: 'Cases',
        dashboard: 'Dashboard',
        prospects: 'Leads',
        partenaires: 'Partners',
        inbox: 'Inbox',
        protocole: 'Protocol',
        tarification: 'Pricing',
        corbeille: 'Trash',
        audit: 'Audit',
        equipe: 'Team',
        profile: 'My profile',
        logout: 'Sign out',
        search: 'Search…',
        save: 'Save',
        cancel: 'Cancel',
      },
    },
  },
});

export function setAppLanguage(lng: 'fr' | 'en') {
  localStorage.setItem('expert-lang', lng);
  void i18n.changeLanguage(lng);
}

export default i18n;
