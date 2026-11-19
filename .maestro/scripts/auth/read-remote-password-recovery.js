// Reads one fresh Supabase recovery message from Mailosaur without exposing its
// credentials or recovery value in Maestro logs.
var MAILOSAUR_API_URL = 'https://mailosaur.com/api/messages';
var RECOVERY_SUBJECT = 'Setze dein Passwort für fam zurück';
var MAX_ATTEMPTS = 8;
var POLL_TIMEOUT_MS = 30000;
var POLL_INTERVAL_MS = 3000;

function required(name, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Fehlende Mailosaur-Laufzeitkonfiguration.');
  }
  return value.trim();
}

var mode = required(
  'RECOVERY_MODE',
  typeof RECOVERY_MODE === 'string' ? RECOVERY_MODE : '',
);
var serverDomain = required(
  'MAILOSAUR_SERVER_DOMAIN',
  typeof MAILOSAUR_SERVER_DOMAIN === 'string' ? MAILOSAUR_SERVER_DOMAIN : '',
);
if (!/^[a-z0-9.-]+$/i.test(serverDomain)) {
  throw new Error('Ungueltige Mailosaur-Server-Domain.');
}

if (mode !== 'address' && mode !== 'preflight' && mode !== 'link' && mode !== 'code') {
  throw new Error('Ungueltiger Mailosaur-Recovery-Modus.');
}

function validateRecoveryEmail(value, domain) {
  var email = required('RECOVERY_EMAIL', value);
  var domainSuffix = '@' + domain.toLowerCase();
  if (
    email.indexOf('@') <= 0 ||
    email.toLowerCase().slice(-domainSuffix.length) !== domainSuffix
  ) {
    throw new Error('Ungueltige Mailosaur-Empfaengeradresse.');
  }
  return email;
}

function validateConfirmedRecoveryEmail(value, domain) {
  var email = required('CONFIRMED_RECOVERY_EMAIL', value);
  var domainSuffix = '@' + domain.toLowerCase();
  if (
    email.indexOf('@') <= 0 ||
    email.toLowerCase().slice(-domainSuffix.length) !== domainSuffix
  ) {
    throw new Error('Ungueltige bestaetigte Mailosaur-Empfaengeradresse.');
  }
  return email;
}

function generateRecoveryEmail(addressSuffix, configuredDomain) {
  var suffix = required(
    'MAILOSAUR_ADDRESS_SUFFIX',
    typeof addressSuffix === 'string' ? addressSuffix : '',
  );
  var domain = required('MAILOSAUR_SERVER_DOMAIN', configuredDomain);
  if (!/^[a-z0-9.-]+$/i.test(domain) || !/^@[a-z0-9.-]+$/i.test(suffix)) {
    throw new Error('Ungueltiges Mailosaur-Adresssuffix.');
  }
  if (suffix.toLowerCase() !== '@' + domain.toLowerCase()) {
    throw new Error('Mailosaur-Adresssuffix passt nicht zur Server-Domain.');
  }

  var localPart =
    'fam-e2e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  return localPart + suffix.toLowerCase();
}

var apiKey = '';
var serverId = '';
var recipient = '';
var requestStartedAt = '';

if (mode !== 'address' && mode !== 'preflight') {
  apiKey = required(
    'MAILOSAUR_API_KEY',
    typeof MAILOSAUR_API_KEY === 'string' ? MAILOSAUR_API_KEY : '',
  );
  serverId = required(
    'MAILOSAUR_SERVER_ID',
    typeof MAILOSAUR_SERVER_ID === 'string' ? MAILOSAUR_SERVER_ID : '',
  );
  recipient = validateRecoveryEmail(
    typeof RECOVERY_EMAIL === 'string' ? RECOVERY_EMAIL : '',
    serverDomain,
  );
  requestStartedAt = required(
    'RECOVERY_REQUEST_STARTED_AT',
    typeof RECOVERY_REQUEST_STARTED_AT === 'string'
      ? RECOVERY_REQUEST_STARTED_AT
      : '',
  );
}

if (mode === 'preflight') {
  var recoveryEmail = validateRecoveryEmail(
    typeof RECOVERY_EMAIL === 'string' ? RECOVERY_EMAIL : '',
    serverDomain,
  );
  var confirmedRecoveryEmail = validateConfirmedRecoveryEmail(
    typeof CONFIRMED_RECOVERY_EMAIL === 'string'
      ? CONFIRMED_RECOVERY_EMAIL
      : '',
    serverDomain,
  );
  if (recoveryEmail !== confirmedRecoveryEmail) {
    throw new Error('Recovery-Adresse und bestaetigte Adresse stimmen nicht ueberein.');
  }
  output.confirmedRecoveryEmail = confirmedRecoveryEmail;
}

var configuredSender =
  typeof MAILOSAUR_SENDER === 'string' ? MAILOSAUR_SENDER.trim() : '';

var parsedRequestStart = Number(requestStartedAt);
if (mode !== 'address' && mode !== 'preflight') {
  if (!isFinite(parsedRequestStart) || parsedRequestStart <= 0) {
    parsedRequestStart = Date.parse(requestStartedAt);
  }
  if (!isFinite(parsedRequestStart)) {
    throw new Error('Ungueltiger Mailosaur-Anforderungszeitpunkt.');
  }
}

function base64Ascii(value) {
  var alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var result = '';

  for (var index = 0; index < value.length; index += 3) {
    var first = value.charCodeAt(index);
    var second = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
    var third = index + 2 < value.length ? value.charCodeAt(index + 2) : 0;
    var hasSecond = index + 1 < value.length;
    var hasThird = index + 2 < value.length;

    result += alphabet.charAt(first >> 2);
    result += alphabet.charAt(((first & 3) << 4) | (second >> 4));
    result += hasSecond ? alphabet.charAt(((second & 15) << 2) | (third >> 6)) : '=';
    result += hasThird ? alphabet.charAt(third & 63) : '=';
  }

  return result;
}

function requestConfig() {
  return {
    headers: {
      Accept: 'application/json',
      Authorization: 'Basic ' + base64Ascii(apiKey + ':'),
    },
  };
}

function parseJson(body) {
  try {
    return json(body);
  } catch (_error) {
    return null;
  }
}

function listMessages() {
  var query = [
    'server=' + encodeURIComponent(serverId),
    'sentTo=' + encodeURIComponent(recipient),
    'subject=' + encodeURIComponent(RECOVERY_SUBJECT),
    'receivedAfter=' + encodeURIComponent(requestStartedAt),
  ];
  if (configuredSender) {
    query.push('sentFrom=' + encodeURIComponent(configuredSender));
  }

  var response = http.get(MAILOSAUR_API_URL + '?' + query.join('&'), requestConfig());
  if (!response || !response.ok) return [];

  var payload = parseJson(response.body);
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.messages)) return payload.messages;
  return [];
}

function loadMessage(id) {
  var response = http.get(
    MAILOSAUR_API_URL + '/' + encodeURIComponent(id),
    requestConfig(),
  );
  return response && response.ok ? parseJson(response.body) : null;
}

function addressValues(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    var arrayValues = [];
    for (var index = 0; index < value.length; index += 1) {
      arrayValues = arrayValues.concat(addressValues(value[index]));
    }
    return arrayValues;
  }
  if (!value || typeof value !== 'object') return [];
  if (typeof value.email === 'string') return [value.email];
  if (typeof value.address === 'string') return [value.address];
  return [];
}

function hasExactAddress(value, expected) {
  var expectedLower = expected.toLowerCase();
  var values = addressValues(value);
  for (var index = 0; index < values.length; index += 1) {
    if (values[index].trim().toLowerCase() === expectedLower) return true;
  }
  return false;
}

function messageSubject(message) {
  return message && (message.subject || message.Subject || '');
}

function messageReceivedAt(message) {
  return message && (message.received || message.Received || message.created || message.Created || '');
}

function isFresh(message) {
  var receivedAt = Date.parse(messageReceivedAt(message));
  return isFinite(receivedAt) && receivedAt >= parsedRequestStart;
}

function isRecoveryMessage(summary, detail) {
  var message = detail || summary;
  var recipientMatches =
    hasExactAddress(message.to || message.To || message.recipients, recipient) ||
    hasExactAddress(summary.to || summary.To || summary.recipients, recipient);
  if (!recipientMatches) return false;

  var subject = messageSubject(message) || messageSubject(summary);
  if (String(subject).trim().toLowerCase() !== RECOVERY_SUBJECT.toLowerCase()) {
    return false;
  }

  if (!isFresh(message) && !isFresh(summary)) return false;

  if (configuredSender) {
    var senderMatches =
      hasExactAddress(message.from || message.From || message.sender, configuredSender) ||
      hasExactAddress(summary.from || summary.From || summary.sender, configuredSender);
    if (!senderMatches) return false;
  }

  return true;
}

function bodyValues(value, values) {
  if (typeof value === 'string') {
    values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (var index = 0; index < value.length; index += 1) {
      bodyValues(value[index], values);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;

  var keys = ['body', 'html', 'text', 'links', 'url', 'href', 'content'];
  for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    var key = keys[keyIndex];
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      bodyValues(value[key], values);
    }
  }
}

function recoveryBodyValues(message) {
  var values = [];
  bodyValues(message && (message.html || message.HTML), values);
  bodyValues(message && (message.text || message.Text), values);
  bodyValues(message && (message.body || message.Body), values);
  return values;
}

function extractLink(message) {
  var values = recoveryBodyValues(message);
  var linkPattern = /fam:\/\/\/password-recovery\?[^\s"'<>]+/gi;

  for (var valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
    var normalized = values[valueIndex].replace(/&amp;/g, '&');
    var match = linkPattern.exec(normalized);
    while (match) {
      var link = match[0].replace(/[),.;]+$/, '');
      if (/[?&]token_hash=[^&#\s]+/i.test(link) && /[?&]type=recovery(?:&|$)/i.test(link)) {
        return link;
      }
      match = linkPattern.exec(normalized);
    }
    linkPattern.lastIndex = 0;
  }

  return null;
}

function extractCode(message) {
  var values = recoveryBodyValues(message);
  var codePattern =
    /(?:\btoken\b|\beinmalcode\b|\bcode\b|\bpasswort\b|\bpassword\b|\breset\b)[^0-9]{0,120}(\d{6})\b/gi;

  for (var valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
    var match = codePattern.exec(values[valueIndex]);
    if (match) return match[1];
    codePattern.lastIndex = 0;
  }

  return null;
}

function waitBetweenAttempts(deadline) {
  var remaining = deadline - Date.now();
  if (remaining <= 0) return;

  var waitMilliseconds = Math.min(POLL_INTERVAL_MS, remaining);
  if (typeof sleep === 'function') {
    sleep(waitMilliseconds);
    return;
  }

  var waitUntil = Date.now() + waitMilliseconds;
  while (Date.now() < waitUntil) {}
}

function findRecoveryValue() {
  var summaries = listMessages();
  for (var index = 0; index < summaries.length; index += 1) {
    var summary = summaries[index];
    var messageId = summary && (summary.id || summary.ID);
    if (!messageId) continue;

    var detail = loadMessage(messageId);
    if (!detail || !isRecoveryMessage(summary, detail)) continue;

    var value = mode === 'link' ? extractLink(detail) : extractCode(detail);
    if (value) return value;
  }

  return null;
}

if (mode === 'address') {
  output.testEmail = generateRecoveryEmail(
    typeof MAILOSAUR_ADDRESS_SUFFIX === 'string' ? MAILOSAUR_ADDRESS_SUFFIX : '',
    serverDomain,
  );
  console.log('Eindeutige Mailosaur-Testadresse erzeugt: ' + output.testEmail);
} else if (mode !== 'preflight') {
  var recoveryValue = null;
  var deadline = Date.now() + POLL_TIMEOUT_MS;
  for (
    var attempt = 0;
    attempt < MAX_ATTEMPTS && Date.now() <= deadline;
    attempt += 1
  ) {
    try {
      recoveryValue = findRecoveryValue();
    } catch (_error) {
      recoveryValue = null;
    }
    if (recoveryValue) break;
    if (attempt + 1 < MAX_ATTEMPTS) waitBetweenAttempts(deadline);
  }

  if (!recoveryValue) {
    throw new Error('Keine passende Mailosaur-Recovery-Mail innerhalb des Limits gefunden.');
  }

  if (mode === 'link') {
    output.recoveryLink = recoveryValue;
  } else {
    output.recoveryCode = recoveryValue;
  }
  console.log('Mailosaur-Recovery-Mail erfolgreich korreliert.');
}
