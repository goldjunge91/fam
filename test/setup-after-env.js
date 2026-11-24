const matchers = require('@testing-library/react-native/matchers');

expect.extend(matchers);

beforeEach(async () => {
  const reactI18next = require('react-i18next');
  if (!reactI18next.initReactI18next) return;

  const { i18n } = require('../src/i18n');
  if (!i18n?.changeLanguage) return;
  await i18n.changeLanguage('de');
});
