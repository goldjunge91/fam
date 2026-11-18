// Liest den neuesten Passwort-Reset-Code aus der lokalen Mailpit-Mailbox.
// Der Code wird nicht geloggt, sondern nur als Flow-Output gespeichert.
var email = RECOVERY_EMAIL;
if (!email) {
  throw new Error('Keine Recovery-E-Mail fuer den lokalen Mailpit-Code angegeben.');
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
  var query = encodeURIComponent('to:' + email);
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
  var labelledPattern = /(?:code|token|passwort|password|reset|zurücksetzen)[^0-9]{0,100}([0-9]{6})/gi;
  var labelledMatch = labelledPattern.exec(value);
  while (labelledMatch) {
    addUniqueCode(labelledCodes, labelledMatch[1]);
    labelledMatch = labelledPattern.exec(value);
  }
  if (labelledCodes.length > 0) return labelledCodes;

  return value.match(/\b[0-9]{6}\b/g) || [];
}

function createdAt(message) {
  return message.Created || message.created || message.Date || message.date || '';
}

function findCode() {
  var messages = listMessages();
  messages.sort(function (left, right) {
    return String(createdAt(right)).localeCompare(String(createdAt(left)));
  });

  for (var index = 0; index < messages.length; index += 1) {
    var summary = messages[index];
    var messageId = summary.ID || summary.id;
    var detail = messageId ? loadMessage(messageId) : summary;
    if (!detail) continue;

    var values = [detail.Subject, detail.Text, detail.HTML, detail.subject, detail.text, detail.html];
    for (var valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
      var extractedCodes = extractCodes(values[valueIndex]);
      if (extractedCodes.length > 0) return extractedCodes[0];
    }
  }

  return null;
}

var recoveryCode = null;
for (var attempt = 0; attempt < 40 && !recoveryCode; attempt += 1) {
  try {
    recoveryCode = findCode();
  } catch (_error) {
    recoveryCode = null;
  }
}

if (!recoveryCode) {
  throw new Error('Kein Passwort-Reset-Code ueber den lokalen Mailpit-Dienst gefunden.');
}

output.recoveryCode = recoveryCode;
console.log('Lokalen Passwort-Reset-Code gelesen.');
