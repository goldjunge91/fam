// Reads one fresh signup confirmation OTP from Mailosaur without exposing secrets.
var MAILOSAUR_API_URL = 'https://mailosaur.com/api/messages';
var SIGNUP_SUBJECT = 'Bestätige deine E-Mail-Adresse';
var MAX_ATTEMPTS = 8;
var POLL_INTERVAL_MS = 3000;

function required(name, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Fehlende Mailosaur-Laufzeitkonfiguration.');
  }
  return value.trim();
}

var apiKey = required('MAILOSAUR_API_KEY', typeof MAILOSAUR_API_KEY === 'string' ? MAILOSAUR_API_KEY : '');
var serverId = required('MAILOSAUR_SERVER_ID', typeof MAILOSAUR_SERVER_ID === 'string' ? MAILOSAUR_SERVER_ID : '');
var serverDomain = required('MAILOSAUR_SERVER_DOMAIN', typeof MAILOSAUR_SERVER_DOMAIN === 'string' ? MAILOSAUR_SERVER_DOMAIN : '');
var recipient = required('SIGNUP_EMAIL', typeof SIGNUP_EMAIL === 'string' ? SIGNUP_EMAIL : '');
var startedAt = required('SIGNUP_STARTED_AT', typeof SIGNUP_STARTED_AT === 'string' ? SIGNUP_STARTED_AT : '');
var sender = typeof MAILOSAUR_SENDER === 'string' ? MAILOSAUR_SENDER.trim() : '';
var startedTimestamp = Date.parse(startedAt);
if (!isFinite(startedTimestamp)) throw new Error('Ungueltiger Mailosaur-Anforderungszeitpunkt.');
if (!/^[a-z0-9.-]+$/i.test(serverDomain) || recipient.toLowerCase().slice(-serverDomain.length - 1) !== '@' + serverDomain.toLowerCase()) {
  throw new Error('Ungueltige Mailosaur-Empfaengeradresse.');
}

function base64(value) {
  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
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
function config() {
  return { headers: { Accept: 'application/json', Authorization: 'Basic ' + base64(apiKey + ':') } };
}
function parsed(body) { try { return json(body); } catch (_error) { return null; } }
function values(value, result) {
  if (typeof value === 'string') { result.push(value); return; }
  if (Array.isArray(value)) { value.forEach(function (item) { values(item, result); }); return; }
  if (!value || typeof value !== 'object') return;
  ['body', 'html', 'text', 'content'].forEach(function (key) { if (Object.prototype.hasOwnProperty.call(value, key)) values(value[key], result); });
}
function addresses(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.reduce(function (result, item) { return result.concat(addresses(item)); }, []);
  if (value && typeof value === 'object') return typeof value.email === 'string' ? [value.email] : [];
  return [];
}
function exact(value, expected) { return addresses(value).some(function (item) { return item.trim().toLowerCase() === expected.toLowerCase(); }); }
function code(message) {
  var body = [];
  values(message && (message.html || message.HTML), body);
  values(message && (message.text || message.Text), body);
  values(message && (message.body || message.Body), body);
  var pattern = /(?:code|token|bestätigung|confirmation|verify)[^0-9]{0,120}(\d{6})\b/i;
  for (var index = 0; index < body.length; index += 1) {
    var match = pattern.exec(body[index]) || /\b(\d{6})\b/.exec(body[index]);
    if (match) return match[1];
  }
  return null;
}
function find() {
  var query = 'server=' + encodeURIComponent(serverId) + '&sentTo=' + encodeURIComponent(recipient) + '&subject=' + encodeURIComponent(SIGNUP_SUBJECT) + '&receivedAfter=' + encodeURIComponent(startedAt);
  var list = http.get(MAILOSAUR_API_URL + '?' + query, config());
  if (!list || !list.ok) return null;
  var payload = parsed(list.body);
  var items = payload && (payload.items || payload.messages);
  if (!Array.isArray(items)) return null;
  for (var index = 0; index < items.length; index += 1) {
    var summary = items[index];
    var id = summary && (summary.id || summary.ID);
    if (!id) continue;
    var detailResponse = http.get(MAILOSAUR_API_URL + '/' + encodeURIComponent(id), config());
    var detail = detailResponse && detailResponse.ok ? parsed(detailResponse.body) : null;
    if (!detail) continue;
    var received = Date.parse(detail.received || detail.created || summary.received || summary.created || '');
    var subject = String(detail.subject || summary.subject || '').trim().toLowerCase();
    var from = detail.from || detail.From || summary.from || summary.From;
    if (received >= startedTimestamp && subject === SIGNUP_SUBJECT.toLowerCase() && exact(detail.to || detail.To || summary.to || summary.To, recipient) && (!sender || exact(from, sender))) {
      var result = code(detail);
      if (result) return result;
    }
  }
  return null;
}
var signupCode = null;
for (var attempt = 0; attempt < MAX_ATTEMPTS && !signupCode; attempt += 1) {
  try { signupCode = find(); } catch (_error) { signupCode = null; }
  if (!signupCode && attempt + 1 < MAX_ATTEMPTS && typeof sleep === 'function') sleep(POLL_INTERVAL_MS);
}
if (!signupCode) throw new Error('Kein passender Mailosaur-Bestaetigungscode gefunden.');
output.signupCode = signupCode;
console.log('Mailosaur-Bestaetigungscode gelesen.');
