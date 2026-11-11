import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { IS_EN } from '../utils/lang';

import koCommon from './ko/common.json';
import koHome from './ko/home.json';
import koAbout from './ko/about.json';
import koTeam from './ko/team.json';
import koContents from './ko/contents.json';
import koEvents from './ko/events.json';
import koEcosystem from './ko/ecosystem.json';
import koNews from './ko/news.json';
import koDebates from './ko/debates.json';
import koCalls from './ko/calls.json';
import koEips from './ko/eips.json';
import koErcs from './ko/ercs.json';

import enCommon from './en/common.json';
import enHome from './en/home.json';
import enAbout from './en/about.json';
import enTeam from './en/team.json';
import enContents from './en/contents.json';
import enEvents from './en/events.json';
import enEcosystem from './en/ecosystem.json';
import enNews from './en/news.json';
import enDebates from './en/debates.json';
import enCalls from './en/calls.json';
import enEips from './en/eips.json';
import enErcs from './en/ercs.json';

i18n
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
        news: koNews,
        debates: koDebates,
        calls: koCalls,
        eips: koEips,
        ercs: koErcs,
      },
      en: {
        common: enCommon,
        home: enHome,
        about: enAbout,
        team: enTeam,
        contents: enContents,
        events: enEvents,
        ecosystem: enEcosystem,
        news: enNews,
        debates: enDebates,
        calls: enCalls,
        eips: enEips,
        ercs: enErcs,
      },
    },
    // 언어는 주소(/en)로 정한다
    lng: IS_EN ? 'en' : 'ko',
    fallbackLng: 'ko',
    defaultNS: 'common',
    ns: ['common', 'home', 'about', 'team', 'contents', 'events', 'ecosystem', 'news', 'debates', 'calls'],
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

document.documentElement.lang = i18n.language;

export default i18n;
