// Liest den OTP aus der lokalen Mailpit-Mailbox. Die Adresse wird aus dem
// zuvor erzeugten output.auth-Objekt genommen, damit keine alte Mail getroffen
// wird. Der Code wird nicht geloggt, sondern nur als Flow-Output gespeichert.
var auth = output.auth;
if (!auth || !auth.email) {
  throw new Error('Kein Registrierungsaccount in output.auth gefunden.');
}

var baseUrl = 'http://127.0.0.1:54324/api/v1/';

function parseJson(body) {
  try {
    return json(body);
  } catch (_error) {
    return null;
  }
}

function listMessages() {
  var query = encodeURIComponent('to:' + auth.email);
  var response = http.get(baseUrl + 'search?query=' + query + '&limit=10');
  if (!response.ok) return [];

  var payload = parseJson(response.body);
  return payload && Array.isArray(payload.messages) ? payload.messages : [];
}

function loadMessage(id) {
  var response = http.get(baseUrl + 'message/' + encodeURIComponent(id));
  return response.ok ? parseJson(response.body) : null;
}

function addUniqueCode(codes, code) {
  if (codes.indexOf(code) === -1) codes.push(code);
}

function extractCodes(value) {
  if (typeof value !== 'string') return [];

  var labelledCodes = [];
  var labelledPattern = /(?:code|token|bestätigung|confirmation)[^0-9]{0,100}([0-9]{6})/gi;
  var labelledMatch = labelledPattern.exec(value);
  while (labelledMatch) {
    addUniqueCode(labelledCodes, labelledMatch[1]);
    labelledMatch = labelledPattern.exec(value);
  }
  if (labelledCodes.length > 0) return labelledCodes;

  return value.match(/\b[0-9]{6}\b/g) || [];
}

function findCode() {
  var messages = listMessages();
  var codes = [];

  for (var index = 0; index < messages.length; index += 1) {
    var summary = messages[index];
    var messageId = summary.ID || summary.id;
    var detail = messageId ? loadMessage(messageId) : summary;
    if (!detail) continue;

    var values = [detail.Subject, detail.Text, detail.HTML, detail.subject, detail.text, detail.html];
    for (var valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
      var extractedCodes = extractCodes(values[valueIndex]);
      for (var codeIndex = 0; codeIndex < extractedCodes.length; codeIndex += 1) {
        addUniqueCode(codes, extractedCodes[codeIndex]);
      }
    }

    if (codes.length === 1) return codes[0];
    if (codes.length > 1) return null;
  }

  return null;
}

// SMTP/Mailpit verarbeitet die Nachricht normalerweise vor dem ersten Abruf.
// Mehrere kurze Abrufe decken trotzdem die lokale Zustell-Latenz ab, ohne
// künstliche Sleeps in den YAML-Flows einzuführen.
var confirmationCode = null;
for (var attempt = 0; attempt < 40 && !confirmationCode; attempt += 1) {
  try {
    confirmationCode = findCode();
  } catch (_error) {
    confirmationCode = null;
  }
}

if (!confirmationCode) {
  throw new Error('Kein eindeutiger OTP über den lokalen Mailpit-Dienst gefunden.');
}

output.auth.confirmationCode = confirmationCode;
console.log('Lokalen Bestätigungscode gelesen.');
