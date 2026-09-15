// Erzeugt pro Flow-Lauf einen isolierten Account. Die Werte werden über den
// globalen Maestro-output an die folgenden UI- und Mail-Schritte weitergereicht.
var password = typeof TEST_PASSWORD === 'undefined' ? 'Passwort123!' : TEST_PASSWORD;
var email = 'maestro-e2e-signup-' + new Date().getTime() + '@example.com';

output.auth = {
  email: email,
  password: password,
};

console.log('Registrierungsaccount erzeugt: ' + email);
