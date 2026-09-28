const state = { files: [], reports: [], response: null };

const form = document.querySelector('#ocr-form');
const imagesInput = document.querySelector('#images');
const dropZone = document.querySelector('#drop-zone');
const fileList = document.querySelector('#file-list');
const fileCount = document.querySelector('#file-count');
const runButton = document.querySelector('#run-button');
const formStatus = document.querySelector('#form-status');
const resultsSection = document.querySelector('#results-section');
const summary = document.querySelector('#summary');
const reportList = document.querySelector('#report-list');
const downloadButton = document.querySelector('#download-json');
const referenceInput = document.querySelector('#reference');
const goldInput = document.querySelector('#gold');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMs(value) {
  return `${Number(value ?? 0).toLocaleString('de-DE')} ms`;
}

function formatPercent(value) {
  return value === null || value === undefined ? 'n/a' : `${Math.round(Number(value) * 100)} %`;
}

function formatConfidence(value) {
  return value === null || value === undefined ? 'n/a' : `${Math.round(Number(value))} %`;
}

function setStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle('is-error', isError);
}

function renderFiles() {
  fileCount.textContent = `${state.files.length} ${state.files.length === 1 ? 'Bild' : 'Bilder'}`;
  runButton.disabled = state.files.length === 0;
  if (state.files.length === 0) {
    fileList.innerHTML = '';
    setStatus('Noch keine Bilder ausgewählt.');
    return;
  }
  fileList.innerHTML = state.files.map((file, index) => `
    <li class="file-row">
      <div class="file-meta">
        <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
        <div class="file-size">${formatBytes(file.size)} · ${escapeHtml(file.type || 'Bild')}</div>
      </div>
      <button class="remove-file" type="button" data-remove-index="${index}">Entfernen</button>
    </li>
  `).join('');
  setStatus(`${state.files.length} Bild${state.files.length === 1 ? '' : 'er'} bereit.`);
}

function addFiles(fileCollection) {
  const incoming = [...fileCollection].filter((file) => file.type.startsWith('image/'));
  const names = new Set(state.files.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  state.files = [...state.files, ...incoming.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (names.has(key)) return false;
    names.add(key);
    return true;
  })].slice(0, 12);
  renderFiles();
}

function renderFileName(input, target) {
  target.textContent = input.files?.[0]?.name || 'Keine Datei ausgewählt';
}

function confidenceClass(confidence) {
  return confidence !== null && confidence !== undefined && Number(confidence) < 60 ? 'is-low' : '';
}

function renderBoxes(report) {
  if (!report.normalizedImageDataUrl) {
    return '<p class="empty-note">Keine Bildvorschau verfügbar.</p>';
  }
  const width = Number(report.normalizedImage?.width || 1);
  const height = Number(report.normalizedImage?.height || 1);
  const boxes = (report.lines || []).map((line, index) => {
    const box = line.boundingBox || { x: 0, y: 0, width: 0, height: 0 };
    const left = Math.max(0, (Number(box.x) / width) * 100);
    const top = Math.max(0, (Number(box.y) / height) * 100);
    const boxWidth = Math.max(0, (Number(box.width) / width) * 100);
    const boxHeight = Math.max(0, (Number(box.height) / height) * 100);
    return `<span class="ocr-box" style="left:${left}%;top:${top}%;width:${boxWidth}%;height:${boxHeight}%" title="Zeile ${index + 1}: ${escapeHtml(line.text)}"></span>`;
  }).join('');
  return `<img src="${escapeHtml(report.normalizedImageDataUrl)}" alt="Normalisierte Vorschau von ${escapeHtml(report.input)}" />${boxes}`;
}

function renderLines(report) {
  if (!report.lines?.length) return '<p class="empty-note">Keine Textzeilen erkannt.</p>';
  return `<ol class="line-list">${report.lines.map((line, index) => `
    <li class="ocr-line">
      <span class="ocr-line-text"><strong>${index + 1}.</strong> ${escapeHtml(line.text)}</span>
      <span class="ocr-confidence ${confidenceClass(line.confidence)}">${formatConfidence(line.confidence)}</span>
    </li>
  `).join('')}</ol>`;
}

function renderTokenGroup(label, tokens, className) {
  const content = tokens?.length
    ? tokens.map((token) => `<span class="token">${escapeHtml(token)}</span>`).join('')
    : '<span class="empty-note">Keine</span>';
  return `<div class="token-group ${className}"><div class="token-group-label">${label}</div><div class="token-group-list">${content}</div></div>`;
}

function renderComparison(comparison) {
  if (!comparison) return '';
  return `
    <section class="comparison-panel">
      <h4>Native Referenzreport</h4>
      <div class="comparison-stats">
        <span>Token-Ähnlichkeit <strong>${formatPercent(comparison.tokenSimilarity)}</strong></span>
        <span>Zeilen <strong>${comparison.actualLineCount} / ${comparison.referenceLineCount}</strong></span>
      </div>
      <div class="token-groups">
        ${renderTokenGroup('Fehlende Tokens', comparison.missingTokens, 'missing')}
        ${renderTokenGroup('Zusätzliche Tokens', comparison.addedTokens, 'added')}
      </div>
    </section>`;
}

function renderGold(gold) {
  if (!gold) return '';
  const totalLabel = gold.totalMatch === null ? 'nicht geprüft' : gold.totalMatch ? 'passt' : 'abweichend';
  const totalClass = gold.totalMatch === false ? 'match-bad' : gold.totalMatch === true ? 'match-good' : '';
  return `
    <section class="gold-panel">
      <h4>Goldvergleich · ${escapeHtml(gold.sourceFile || 'keine Quelle')}</h4>
      <div class="comparison-stats">
        <span>Gesamtsumme <strong class="${totalClass}">${totalLabel}</strong></span>
        <span>Erwartet <strong>${gold.expectedTotalCents === null ? 'n/a' : `${(gold.expectedTotalCents / 100).toFixed(2)} €`}</strong></span>
        <span>Artikel-Recall <strong>${formatPercent(gold.itemRecall)}</strong></span>
        <span>Artikel <strong>${gold.matchedItemCount} / ${gold.expectedItemCount}</strong></span>
      </div>
      ${gold.missingItems?.length ? `<p class="field-note"><strong>Fehlend:</strong> ${gold.missingItems.map(escapeHtml).join(', ')}</p>` : ''}
    </section>`;
}

function renderReport(report) {
  const image = report.normalizedImage || {};
  const preprocessing = image.preprocessing === 'none' ? 'keine' : 'Graustufen, Kontrast, Threshold';
  return `
    <article class="report-card">
      <header class="report-card-header">
        <h3>${escapeHtml(report.input)}</h3>
        <small>${formatMs(report.durationMs)} · ${escapeHtml(report.engineVersion)}</small>
      </header>
      <div class="report-grid">
        <section class="preview-panel" aria-label="Bildvorschau">
          <div class="preview-frame">${renderBoxes(report)}</div>
          <p class="preview-caption">${image.width || '?'} × ${image.height || '?'} px · ${formatBytes(image.byteSize || 0)} · Aufbereitung: ${preprocessing}</p>
        </section>
        <section class="analysis-panel" aria-label="OCR-Auswertung">
          <div class="analysis-meta">
            <span>Sprache <strong>${escapeHtml(report.language)}</strong></span>
            <span>PSM <strong>${report.pageSegmentationMode}</strong></span>
            <span>Zeilen <strong>${report.lines?.length || 0}</strong></span>
          </div>
          ${renderLines(report)}
          <div class="detail-grid">
            <details><summary>Rohtext</summary><pre class="text-block">${escapeHtml(report.text)}</pre></details>
            <details><summary>Normalisierter Text</summary><pre class="text-block">${escapeHtml(report.normalizedText)}</pre></details>
          </div>
          ${renderComparison(report.comparison)}
          ${renderGold(report.goldComparison)}
        </section>
      </div>
    </article>`;
}

function renderResults(response) {
  const reports = response.reports || [];
  const totalLines = reports.reduce((sum, report) => sum + (report.lines?.length || 0), 0);
  const totalDuration = reports.reduce((sum, report) => sum + Number(report.durationMs || 0), 0);
  const goldCount = reports.filter((report) => report.goldComparison).length;
  summary.innerHTML = [
    ['Bilder', reports.length],
    ['Erkannte Zeilen', totalLines],
    ['Tesseract-Laufzeit', formatMs(totalDuration)],
    ['Goldvergleich', goldCount ? `${goldCount} aktiv` : 'nicht geladen'],
  ].map(([label, value]) => `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${escapeHtml(value)}</div></div>`).join('');
  reportList.innerHTML = reports.map(renderReport).join('');
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function readOptionalJson(input) {
  const file = input.files?.[0];
  return file ? file.text() : null;
}

imagesInput.addEventListener('change', () => addFiles(imagesInput.files || []));
fileList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-index]');
  if (!button) return;
  state.files.splice(Number(button.dataset.removeIndex), 1);
  renderFiles();
});

['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragging');
}));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragging');
}));
dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
referenceInput.addEventListener('change', () => renderFileName(referenceInput, document.querySelector('#reference-name')));
goldInput.addEventListener('change', () => renderFileName(goldInput, document.querySelector('#gold-name')));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.files.length === 0) return;
  runButton.disabled = true;
  setStatus('OCR läuft lokal …');
  const body = new FormData();
  state.files.forEach((file) => body.append('images', file, file.name));
  body.set('language', document.querySelector('#language').value);
  body.set('psm', document.querySelector('#psm').value);
  body.set('preprocess', document.querySelector('#preprocess').value);
  const reference = await readOptionalJson(referenceInput);
  const gold = await readOptionalJson(goldInput);
  if (reference) body.set('reference', reference);
  if (gold) body.set('gold', gold);
  try {
    const response = await fetch('/api/ocr', { method: 'POST', body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'OCR-Anfrage fehlgeschlagen.');
    state.response = data;
    state.reports = data.reports || [];
    renderResults(data);
    setStatus(`${state.reports.length} Report${state.reports.length === 1 ? '' : 's'} erstellt.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unbekannter Fehler.', true);
  } finally {
    runButton.disabled = state.files.length === 0;
  }
});

downloadButton.addEventListener('click', () => {
  if (!state.response) return;
  const blob = new Blob([JSON.stringify(state.response, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-ocr-report-${new Date().toISOString().replaceAll(':', '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

renderFiles();
