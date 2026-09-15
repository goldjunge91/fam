// Liest den OTP aus der lokalen Inbucket-Mailbox. Die Adresse wird aus dem
// zuvor erzeugten output.auth-Objekt genommen, damit keine alte Mail getroffen
// wird. Der Code wird nicht geloggt, sondern nur als Flow-Output gespeichert.
var auth = output.auth;
if (!auth || !auth.email) {
  throw new Error('Kein Registrierungsaccount in output.auth gefunden.');
}

var mailbox = auth.email.split('@')[0];
var baseUrl = 'http://127.0.0.1:54324/api/v1/mailbox/';

function parseJson(body) {
  try {
    return json(body);
  } catch (_error) {
    return null;
  }
}

function listMessages() {
  var response = http.get(baseUrl + encodeURIComponent(mailbox));
  if (!response.ok) return [];

  var payload = parseJson(response.body);
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.messages)) return payload.messages;
  return [];
}

function loadMessage(id) {
  var response = http.get(baseUrl + encodeURIComponent(mailbox) + '/' + encodeURIComponent(id));
  return response.ok ? parseJson(response.body) : null;
}

function extractCode(value) {
  if (typeof value !== 'string') return null;

  var labelled = value.match(
    /(?:code|token|bestätigung|confirmation)[^0-9]{0,100}([0-9]{6})/i,
  );
  if (labelled) return labelled[1];

  var fallback = value.match(/\b([0-9]{6})\b/);
  return fallback ? fallback[1] : null;
}

function findCode() {
  var messages = listMessages();

  for (var index = 0; index < messages.length; index += 1) {
    var summary = messages[index];
    var detail = summary.id ? loadMessage(summary.id) : summary;
    if (!detail) continue;

    var code = extractCode(
      [detail.subject, detail.text, detail.html, detail.body, detail.raw].join('\n'),
    );
    if (code) return code;
  }

  return null;
}

// SMTP/Inbucket verarbeitet die Nachricht normalerweise vor dem ersten
// Abruf. Mehrere kurze Abrufe decken trotzdem die lokale Zustell-Latenz ab,
// ohne künstliche Sleeps in den YAML-Flows einzuführen.
var confirmationCode = null;
for (var attempt = 0; attempt < 40 && !confirmationCode; attempt += 1) {
  try {
    confirmationCode = findCode();
  } catch (_error) {
    confirmationCode = null;
  }
}

if (!confirmationCode) {
  throw new Error(
    'Kein OTP für ' + mailbox + ' über Inbucket unter http://127.0.0.1:54324 gefunden.',
  );
}

output.auth.confirmationCode = confirmationCode;
console.log('Lokalen Bestätigungscode für ' + mailbox + ' gelesen.');
