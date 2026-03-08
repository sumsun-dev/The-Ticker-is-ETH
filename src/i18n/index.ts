import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import koCommon from './ko/common.json';
import koHome from './ko/home.json';
import koAbout from './ko/about.json';
import koTeam from './ko/team.json';
import koContents from './ko/contents.json';
import koEvents from './ko/events.json';
import koEcosystem from './ko/ecosystem.json';

import enCommon from './en/common.json';
import enHome from './en/home.json';
import enAbout from './en/about.json';
import enTeam from './en/team.json';
import enContents from './en/contents.json';
import enEvents from './en/events.json';
import enEcosystem from './en/ecosystem.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: {
        common: koCommon,
        home: koHome,
        about: koAbout,
        team: koTeam,
        contents: koContents,
        events: koEvents,
        ecosystem: koEcosystem,
      },
      en: {
        common: enCommon,
        home: enHome,
        about: enAbout,
        team: enTeam,
        contents: enContents,
        events: enEvents,
        ecosystem: enEcosystem,
      },
    },
    fallbackLng: 'ko',
    defaultNS: 'common',
    ns: ['common', 'home', 'about', 'team', 'contents', 'events', 'ecosystem'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

document.documentElement.lang = i18n.language;

export default i18n;
