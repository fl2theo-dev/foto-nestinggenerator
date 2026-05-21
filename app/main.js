const MM_PER_INCH = 25.4;
const REGMARK_DIAMETER_MM = 5;
const REGMARK_RADIUS_MM = REGMARK_DIAMETER_MM / 2;
const REGMARK_OFFSET_MM = 3 + REGMARK_RADIUS_MM;
const REGMARK_OUTER_PAD_MM = 3 + REGMARK_DIAMETER_MM;

const photoInput = document.getElementById('photoInput');
const rollWidthInput = document.getElementById('rollWidth');
const maxHeightInput = document.getElementById('maxHeight');
const dpiInput = document.getElementById('dpi');
const gapInput = document.getElementById('gap');
const allowRotateInput = document.getElementById('allowRotate');
const paddingInput = document.getElementById('padding');
const moveStepInput = document.getElementById('moveStep');
const selectedItemInput = document.getElementById('selectedItem');

const nestBtn = document.getElementById('nestBtn');
const clearBtn = document.getElementById('clearBtn');
const saveProjectBtn = document.getElementById('saveProjectBtn');
const loadProjectBtn = document.getElementById('loadProjectBtn');
const projectLoadInput = document.getElementById('projectLoadInput');
const exportPrintPdfBtn = document.getElementById('exportPrintPdfBtn');
const exportContourPdfBtn = document.getElementById('exportContourPdfBtn');
const exportHotfolderBtn = document.getElementById('exportHotfolderBtn');
const rotateBtn = document.getElementById('rotateBtn');
const unplaceBtn = document.getElementById('unplaceBtn');
const moveLeftBtn = document.getElementById('moveLeftBtn');
const moveRightBtn = document.getElementById('moveRightBtn');
const moveUpBtn = document.getElementById('moveUpBtn');
const moveDownBtn = document.getElementById('moveDownBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageIndicator = document.getElementById('pageIndicator');

const statusEl = document.getElementById('status');
const tableBody = document.getElementById('photoTableBody');
const previewCanvas = document.getElementById('previewCanvas');
const ctx = previewCanvas.getContext('2d');

const state = {
  photos: [],
  pages: [],
  selectedId: null,
  currentPage: 0
};

function setStatus(message) {
  statusEl.textContent = message;
}

function pxToMm(px, dpi) {
  return (px / dpi) * MM_PER_INCH;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function getConfig() {
  return {
    rollWidth: Number(rollWidthInput.value),
    maxHeight: Number(maxHeightInput.value),
    gap: Number(gapInput.value),
    allowRotate: allowRotateInput.checked,
    padding: Number(paddingInput.value),
    dpi: Number(dpiInput.value),
    moveStep: Number(moveStepInput.value)
  };
}

function applyConfig(config) {
  if (!config) return;
  if (typeof config.rollWidth === 'number') rollWidthInput.value = String(config.rollWidth);
  if (typeof config.maxHeight === 'number') maxHeightInput.value = String(config.maxHeight);
  if (typeof config.gap === 'number') gapInput.value = String(config.gap);
  if (typeof config.allowRotate === 'boolean') allowRotateInput.checked = config.allowRotate;
  if (typeof config.padding === 'number') paddingInput.value = String(config.padding);
  if (typeof config.dpi === 'number') dpiInput.value = String(config.dpi);
  if (typeof config.moveStep === 'number') moveStepInput.value = String(config.moveStep);
}

function getRegmarks(item) {
  const y1 = item.yMm + Math.min(18, Math.max(8, item.heightMm * 0.2));
  const y2 = item.yMm + item.heightMm - Math.min(18, Math.max(8, item.heightMm * 0.2));
  const leftX = item.xMm - REGMARK_OFFSET_MM;
  const rightX = item.xMm + item.widthMm + REGMARK_OFFSET_MM;

  return [
    { cx: leftX, cy: y1, r: REGMARK_RADIUS_MM },
    { cx: leftX, cy: y2, r: REGMARK_RADIUS_MM },
    { cx: rightX, cy: y1, r: REGMARK_RADIUS_MM },
    { cx: rightX, cy: y2, r: REGMARK_RADIUS_MM }
  ];
}

function getFootprintRect(item) {
  return {
    x: item.xMm - REGMARK_OUTER_PAD_MM,
    y: item.yMm,
    width: item.widthMm + 2 * REGMARK_OUTER_PAD_MM,
    height: item.heightMm
  };
}

function rectsOverlap(a, b, gap = 0) {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function pruneContained(rects) {
  const keep = new Array(rects.length).fill(true);
  for (let i = 0; i < rects.length; i++) {
    if (!keep[i]) continue;
    for (let j = 0; j < rects.length; j++) {
      if (i === j || !keep[j]) continue;
      const a = rects[i];
      const b = rects[j];
      const contains =
        b.x <= a.x + 1e-6 &&
        b.y <= a.y + 1e-6 &&
        b.x + b.width >= a.x + a.width - 1e-6 &&
        b.y + b.height >= a.y + a.height - 1e-6;
      if (contains) {
        keep[i] = false;
        break;
      }
    }
  }
  return rects.filter((_, index) => keep[index]);
}

function splitFreeRects(freeRects, obstacle, gap) {
  const ox1 = obstacle.x - gap;
  const oy1 = obstacle.y - gap;
  const ox2 = obstacle.x + obstacle.width + gap;
  const oy2 = obstacle.y + obstacle.height + gap;
  const result = [];

  for (const rect of freeRects) {
    const rx1 = rect.x;
    const ry1 = rect.y;
    const rx2 = rect.x + rect.width;
    const ry2 = rect.y + rect.height;

    const noOverlap = ox2 <= rx1 + 1e-6 || ox1 >= rx2 - 1e-6 || oy2 <= ry1 + 1e-6 || oy1 >= ry2 - 1e-6;
    if (noOverlap) {
      result.push(rect);
      continue;
    }

    if (ox1 > rx1 + 1e-6) result.push({ x: rx1, y: ry1, width: ox1 - rx1, height: rect.height });
    if (ox2 < rx2 - 1e-6) result.push({ x: ox2, y: ry1, width: rx2 - ox2, height: rect.height });
    if (oy1 > ry1 + 1e-6) result.push({ x: rx1, y: ry1, width: rect.width, height: oy1 - ry1 });
    if (oy2 < ry2 - 1e-6) result.push({ x: rx1, y: oy2, width: rect.width, height: ry2 - oy2 });
  }

  return pruneContained(result).filter((r) => r.width > 1e-3 && r.height > 1e-3);
}

function nestSinglePage(photos, config) {
  const sorted = [...photos].sort((a, b) => (b.originalWidthMm * b.originalHeightMm) - (a.originalWidthMm * a.originalHeightMm));
  const placed = [];
  const placedIds = new Set();
  let freeRects = [
    {
      x: config.padding,
      y: config.padding,
      width: config.rollWidth - config.padding * 2,
      height: config.maxHeight - config.padding * 2
    }
  ];

  for (const photo of sorted) {
    const variants = [{ width: photo.originalWidthMm, height: photo.originalHeightMm, rotated: false }];
    if (config.allowRotate) {
      variants.push({ width: photo.originalHeightMm, height: photo.originalWidthMm, rotated: true });
    }

    let best = null;
    for (const rect of freeRects) {
      for (const variant of variants) {
        const footprintWidth = variant.width + 2 * REGMARK_OUTER_PAD_MM;
        const footprintHeight = variant.height;
        if (footprintWidth > rect.width + 1e-6 || footprintHeight > rect.height + 1e-6) {
          continue;
        }

        const shortSideFit = Math.min(rect.width - footprintWidth, rect.height - footprintHeight);
        const longSideFit = Math.max(rect.width - footprintWidth, rect.height - footprintHeight);

        if (
          !best ||
          shortSideFit < best.shortSideFit - 1e-9 ||
          (Math.abs(shortSideFit - best.shortSideFit) < 1e-9 && longSideFit < best.longSideFit - 1e-9)
        ) {
          best = {
            rect,
            variant,
            footprintWidth,
            footprintHeight,
            shortSideFit,
            longSideFit
          };
        }
      }
    }

    if (!best) {
      continue;
    }

    placed.push({
      ...photo,
      xMm: best.rect.x + REGMARK_OUTER_PAD_MM,
      yMm: best.rect.y,
      widthMm: best.variant.width,
      heightMm: best.variant.height,
      rotated: best.variant.rotated
    });
    placedIds.add(photo.id);

    freeRects = splitFreeRects(
      freeRects,
      {
        x: best.rect.x,
        y: best.rect.y,
        width: best.footprintWidth,
        height: best.footprintHeight
      },
      config.gap
    );
  }

  return {
    placed,
    remaining: photos.filter((p) => !placedIds.has(p.id))
  };
}

function nestAllPages(photos, config) {
  const pages = [];
  let remaining = [...photos];
  let guard = 0;

  while (remaining.length > 0 && guard < 300) {
    guard += 1;
    const result = nestSinglePage(remaining, config);
    if (result.placed.length === 0) break;
    pages.push(result.placed);
    remaining = result.remaining;
  }

  return { pages, remaining };
}

function getCurrentPagePlacements() {
  return state.pages[state.currentPage] || [];
}

function getPlacementMap() {
  const map = new Map();
  state.pages.forEach((page, idx) => {
    page.forEach((item) => {
      map.set(item.id, idx + 1);
    });
  });
  return map;
}

function canPlaceCandidate(candidate, pagePlacements, config, ignoreId = null) {
  const fp = getFootprintRect(candidate);

  if (fp.x < config.padding - 1e-6) return false;
  if (fp.y < config.padding - 1e-6) return false;
  if (fp.x + fp.width > config.rollWidth - config.padding + 1e-6) return false;
  if (fp.y + fp.height > config.maxHeight - config.padding + 1e-6) return false;

  for (const other of pagePlacements) {
    if (other.id === ignoreId) continue;
    if (rectsOverlap(fp, getFootprintRect(other), config.gap)) return false;
  }

  return true;
}

function updatePageIndicator() {
  const total = state.pages.length;
  const current = total === 0 ? 0 : state.currentPage + 1;
  pageIndicator.textContent = `Seite ${current} / ${total}`;
}

function drawPreview() {
  const config = getConfig();
  const page = getCurrentPagePlacements();

  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  if (config.rollWidth <= 0 || config.maxHeight <= 0) {
    updatePageIndicator();
    return;
  }

  const pad = 20;
  const scale = Math.min(
    (previewCanvas.width - pad * 2) / config.rollWidth,
    (previewCanvas.height - pad * 2) / config.maxHeight
  );

  const mapX = (mm) => pad + mm * scale;
  const mapY = (mm) => pad + mm * scale;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#c4bca9';
  ctx.lineWidth = 2;
  ctx.fillRect(mapX(0), mapY(0), config.rollWidth * scale, config.maxHeight * scale);
  ctx.strokeRect(mapX(0), mapY(0), config.rollWidth * scale, config.maxHeight * scale);

  for (const item of page) {
    const x = mapX(item.xMm);
    const y = mapY(item.yMm);
    const w = item.widthMm * scale;
    const h = item.heightMm * scale;

    if (item.image) {
      if (item.rotated) {
        ctx.save();
        ctx.translate(x, y + h);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(item.image, 0, 0, h, w);
        ctx.restore();
      } else {
        ctx.drawImage(item.image, x, y, w, h);
      }
    } else {
      ctx.fillStyle = '#9fd0c4';
      ctx.fillRect(x, y, w, h);
    }

    ctx.strokeStyle = '#21302c';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    if (item.id === state.selectedId) {
      ctx.strokeStyle = '#e07a1f';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }

    ctx.fillStyle = '#123f37';
    ctx.font = '12px Trebuchet MS';
    ctx.fillText(item.name, x + 6, y + 14);

    ctx.fillStyle = '#111';
    for (const reg of getRegmarks(item)) {
      ctx.beginPath();
      ctx.arc(mapX(reg.cx), mapY(reg.cy), reg.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  updatePageIndicator();
}

function renderTable() {
  tableBody.innerHTML = '';
  const placementMap = getPlacementMap();

  state.photos.forEach((photo) => {
    const tr = document.createElement('tr');
    const onPage = placementMap.get(photo.id);
    tr.innerHTML = `
      <td>${photo.name}</td>
      <td>${photo.pixelWidth} x ${photo.pixelHeight}</td>
      <td>${photo.originalWidthMm.toFixed(1)} x ${photo.originalHeightMm.toFixed(1)}</td>
      <td>${onPage ? `Seite ${onPage}` : 'Nein'}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function getImageFormatFromDataUrl(dataUrl) {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function buildRotatedImageDataUrl(item) {
  if (!item.dataUrl || !item.rotated) return item.dataUrl;

  const cw = Math.max(1, Math.round(item.image.naturalHeight));
  const ch = Math.max(1, Math.round(item.image.naturalWidth));
  const off = document.createElement('canvas');
  off.width = cw;
  off.height = ch;
  const c = off.getContext('2d');

  c.translate(cw, 0);
  c.rotate(Math.PI / 2);
  c.drawImage(item.image, 0, 0);
  return off.toDataURL('image/png');
}

function getPageUsedHeightMm(page, config) {
  return Math.max(
    config.padding,
    ...page.map((item) => item.yMm + item.heightMm + config.padding)
  );
}

function buildPdfDocument(includePhotos) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    setStatus('PDF-Bibliothek lokal nicht gefunden. Bitte im Projektordner einmal npm install ausfuehren.');
    return null;
  }

  if (state.pages.length === 0) {
    setStatus('Kein Layout zum Exportieren vorhanden.');
    return null;
  }

  const config = getConfig();
  const { jsPDF } = window.jspdf;
  const pageHeight = config.maxHeight;

  const pdf = new jsPDF({
    unit: 'mm',
    format: [config.rollWidth, pageHeight],
    compress: false,
    precision: 12
  });

  state.pages.forEach((page, index) => {
    if (index > 0) {
      pdf.addPage([config.rollWidth, pageHeight], 'portrait');
      pdf.setPage(index + 1);
    }

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, config.rollWidth, pageHeight, 'F');

    for (const item of page) {
      if (includePhotos && item.dataUrl) {
        const source = item.rotated ? buildRotatedImageDataUrl(item) : item.dataUrl;
        const format = getImageFormatFromDataUrl(source);
        pdf.addImage(source, format, item.xMm, item.yMm, item.widthMm, item.heightMm, undefined, 'NONE');
      }

      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.2);
      pdf.rect(item.xMm, item.yMm, item.widthMm, item.heightMm);

      for (const reg of getRegmarks(item)) {
        pdf.setFillColor(0, 0, 0);
        pdf.circle(reg.cx, reg.cy, reg.r, 'F');
      }
    }

    const usedHeight = getPageUsedHeightMm(page, config);
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.1);
    pdf.line(0, usedHeight, config.rollWidth, usedHeight);
  });

  return pdf;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportPdf(includePhotos) {
  const pdf = buildPdfDocument(includePhotos);
  if (!pdf) return;
  const filename = includePhotos ? 'druck_motive_regmarks.pdf' : 'kontur_regmarks.pdf';
  const blob = pdf.output('blob');
  downloadBlob(filename, blob);
  setStatus(includePhotos ? 'Druck-PDF exportiert.' : 'Kontur-PDF exportiert.');
}

async function exportToHotfolder() {
  if (state.pages.length === 0) {
    setStatus('Kein Layout zum Exportieren vorhanden.');
    return;
  }

  if (typeof window.showDirectoryPicker !== 'function') {
    setStatus('Hotfolder-Export im Browser nicht verfuegbar. Bitte Chromium/Chrome nutzen oder PDFs normal exportieren.');
    return;
  }

  const printPdf = buildPdfDocument(true);
  const contourPdf = buildPdfDocument(false);
  if (!printPdf || !contourPdf) return;

  try {
    const dir = await window.showDirectoryPicker();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const files = [
      { name: `druck_motive_regmarks_${stamp}.pdf`, blob: printPdf.output('blob') },
      { name: `kontur_regmarks_${stamp}.pdf`, blob: contourPdf.output('blob') }
    ];

    for (const file of files) {
      const handle = await dir.getFileHandle(file.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file.blob);
      await writable.close();
    }

    setStatus('Hotfolder-Export abgeschlossen (2 PDF-Dateien geschrieben).');
  } catch (error) {
    setStatus(`Hotfolder-Export abgebrochen/fehlgeschlagen: ${error.message}`);
  }
}

async function handlePhotoInput(files) {
  const dpi = Number(dpiInput.value) || 300;
  const loaded = [];

  for (const file of files) {
    const dataUrl = await fileToDataURL(file);
    const image = await loadImage(dataUrl);

    loaded.push({
      id: crypto.randomUUID(),
      name: file.name,
      pixelWidth: image.naturalWidth,
      pixelHeight: image.naturalHeight,
      originalWidthMm: pxToMm(image.naturalWidth, dpi),
      originalHeightMm: pxToMm(image.naturalHeight, dpi),
      image,
      dataUrl
    });
  }

  state.photos = loaded;
  state.pages = [];
  state.selectedId = null;
  state.currentPage = 0;
  selectedItemInput.value = 'Keins';
  renderTable();
  drawPreview();
  setStatus(`${loaded.length} Fotos geladen. Starte nun das Nesting.`);
}

function runNesting() {
  const config = getConfig();
  const result = nestAllPages(state.photos, config);

  state.pages = result.pages;
  state.currentPage = 0;
  state.selectedId = null;
  selectedItemInput.value = 'Keins';

  renderTable();
  drawPreview();

  setStatus(`Nesting abgeschlossen: ${state.pages.length} Seiten, ${result.remaining.length} nicht platziert.`);
}

function getSelectedPlacement() {
  const page = getCurrentPagePlacements();
  return page.find((item) => item.id === state.selectedId) || null;
}

function selectPlacementById(id) {
  state.selectedId = id;
  const item = getSelectedPlacement();
  selectedItemInput.value = item ? item.name : 'Keins';
  drawPreview();
}

function moveSelected(dx, dy) {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const page = getCurrentPagePlacements();
  const config = getConfig();
  const candidate = { ...selected, xMm: selected.xMm + dx, yMm: selected.yMm + dy };

  if (!canPlaceCandidate(candidate, page, config, selected.id)) {
    setStatus('Verschieben nicht moeglich (Kollision oder ausserhalb des Bogens).');
    return;
  }

  selected.xMm = candidate.xMm;
  selected.yMm = candidate.yMm;
  drawPreview();
  setStatus(`${selected.name} verschoben.`);
}

function rotateSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const page = getCurrentPagePlacements();
  const config = getConfig();
  const candidate = {
    ...selected,
    widthMm: selected.heightMm,
    heightMm: selected.widthMm,
    rotated: !selected.rotated
  };

  if (!canPlaceCandidate(candidate, page, config, selected.id)) {
    setStatus('Rotation nicht moeglich (Kollision oder ausserhalb des Bogens).');
    return;
  }

  selected.widthMm = candidate.widthMm;
  selected.heightMm = candidate.heightMm;
  selected.rotated = candidate.rotated;
  drawPreview();
  setStatus(`${selected.name} rotiert.`);
}

function unplaceSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  state.pages[state.currentPage] = getCurrentPagePlacements().filter((item) => item.id !== selected.id);
  if (state.pages[state.currentPage].length === 0 && state.pages.length > 1) {
    state.pages.splice(state.currentPage, 1);
    state.currentPage = Math.max(0, state.currentPage - 1);
  }

  state.selectedId = null;
  selectedItemInput.value = 'Keins';
  renderTable();
  drawPreview();
  setStatus(`${selected.name} zurueck in die Liste gelegt.`);
}

function saveProject() {
  const project = {
    version: '0.3.0',
    savedAt: new Date().toISOString(),
    config: getConfig(),
    currentPage: state.currentPage,
    photos: state.photos.map((photo) => ({
      id: photo.id,
      name: photo.name,
      pixelWidth: photo.pixelWidth,
      pixelHeight: photo.pixelHeight,
      originalWidthMm: photo.originalWidthMm,
      originalHeightMm: photo.originalHeightMm,
      dataUrl: photo.dataUrl
    })),
    pages: state.pages.map((page) =>
      page.map((item) => ({
        id: item.id,
        xMm: item.xMm,
        yMm: item.yMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        rotated: item.rotated
      }))
    )
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadBlob(`nesting_projekt_${stamp}.json`, blob);
  setStatus('Projektdatei gespeichert.');
}

async function loadProjectFromFile(file) {
  const text = await file.text();
  const project = JSON.parse(text);

  applyConfig(project.config || {});

  const photos = [];
  for (const p of project.photos || []) {
    const image = await loadImage(p.dataUrl);
    photos.push({
      id: p.id,
      name: p.name,
      pixelWidth: p.pixelWidth,
      pixelHeight: p.pixelHeight,
      originalWidthMm: p.originalWidthMm,
      originalHeightMm: p.originalHeightMm,
      dataUrl: p.dataUrl,
      image
    });
  }

  const byId = new Map(photos.map((p) => [p.id, p]));
  const pages = [];

  for (const page of project.pages || []) {
    const parsedPage = [];
    for (const item of page) {
      const base = byId.get(item.id);
      if (!base) continue;
      parsedPage.push({
        ...base,
        xMm: item.xMm,
        yMm: item.yMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        rotated: Boolean(item.rotated)
      });
    }
    if (parsedPage.length > 0) pages.push(parsedPage);
  }

  state.photos = photos;
  state.pages = pages;
  state.currentPage = Math.min(Math.max(0, project.currentPage || 0), Math.max(0, pages.length - 1));
  state.selectedId = null;
  selectedItemInput.value = 'Keins';

  renderTable();
  drawPreview();
  setStatus(`Projekt geladen: ${photos.length} Motive, ${pages.length} Seiten.`);
}

function clearAll() {
  state.photos = [];
  state.pages = [];
  state.selectedId = null;
  state.currentPage = 0;
  selectedItemInput.value = 'Keins';
  photoInput.value = '';
  projectLoadInput.value = '';
  renderTable();
  drawPreview();
  setStatus('Job geleert.');
}

function goToPage(index) {
  if (state.pages.length === 0) {
    state.currentPage = 0;
    drawPreview();
    return;
  }

  state.currentPage = Math.min(Math.max(0, index), state.pages.length - 1);
  state.selectedId = null;
  selectedItemInput.value = 'Keins';
  drawPreview();
}

photoInput.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  try {
    await handlePhotoInput(files);
  } catch (error) {
    setStatus(`Fehler beim Laden: ${error.message}`);
  }
});

nestBtn.addEventListener('click', () => {
  if (state.photos.length === 0) {
    setStatus('Bitte zuerst Fotos laden.');
    return;
  }
  runNesting();
});

clearBtn.addEventListener('click', clearAll);
saveProjectBtn.addEventListener('click', saveProject);
loadProjectBtn.addEventListener('click', () => projectLoadInput.click());
projectLoadInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await loadProjectFromFile(file);
  } catch (error) {
    setStatus(`Projekt konnte nicht geladen werden: ${error.message}`);
  }
});

exportPrintPdfBtn.addEventListener('click', () => exportPdf(true));
exportContourPdfBtn.addEventListener('click', () => exportPdf(false));
exportHotfolderBtn.addEventListener('click', exportToHotfolder);

prevPageBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
nextPageBtn.addEventListener('click', () => goToPage(state.currentPage + 1));

previewCanvas.addEventListener('click', (event) => {
  const page = getCurrentPagePlacements();
  if (page.length === 0) {
    selectPlacementById(null);
    return;
  }

  const config = getConfig();
  const rect = previewCanvas.getBoundingClientRect();
  const sx = previewCanvas.width / rect.width;
  const sy = previewCanvas.height / rect.height;
  const px = (event.clientX - rect.left) * sx;
  const py = (event.clientY - rect.top) * sy;

  const pad = 20;
  const scale = Math.min(
    (previewCanvas.width - pad * 2) / config.rollWidth,
    (previewCanvas.height - pad * 2) / config.maxHeight
  );

  for (let i = page.length - 1; i >= 0; i--) {
    const item = page[i];
    const x = pad + item.xMm * scale;
    const y = pad + item.yMm * scale;
    const w = item.widthMm * scale;
    const h = item.heightMm * scale;
    if (px >= x && px <= x + w && py >= y && py <= y + h) {
      selectPlacementById(item.id);
      return;
    }
  }

  selectPlacementById(null);
});

rotateBtn.addEventListener('click', rotateSelected);
unplaceBtn.addEventListener('click', unplaceSelected);
moveLeftBtn.addEventListener('click', () => moveSelected(-Number(moveStepInput.value || 0), 0));
moveRightBtn.addEventListener('click', () => moveSelected(Number(moveStepInput.value || 0), 0));
moveUpBtn.addEventListener('click', () => moveSelected(0, -Number(moveStepInput.value || 0)));
moveDownBtn.addEventListener('click', () => moveSelected(0, Number(moveStepInput.value || 0)));

renderTable();
drawPreview();
