var configuredPassword =
  typeof TEST_PASSWORD === 'string' &&
  TEST_PASSWORD.trim() !== '' &&
  TEST_PASSWORD.trim().toLowerCase() !== 'undefined'
    ? TEST_PASSWORD
    : null;
var generatedPassword =
  'Ma' +
  Date.now().toString(36).padStart(8, '0') +
  Math.random().toString(36).slice(2, 10) +
  '!7';

output.remoteSignupPassword = configuredPassword || generatedPassword;
