// Regmark-Logik: 4 Regmarks pro Bogen (außen)
function getSheetRegmarks(page, config, pageHeightMm = config.maxHeight) {
  if (page.length === 0) return [];

  const minX = Math.min(...page.map((item) => item.xMm));
  const minY = Math.min(...page.map((item) => item.yMm));
  const maxX = Math.max(...page.map((item) => item.xMm + item.widthMm));
  const maxY = Math.max(...page.map((item) => item.yMm + item.heightMm));

  // 3 mm Abstand von der Motivkante zur AUSSENkante des Regmarks.
  const leftCx = minX - REGMARK_OFFSET_MM;
  const rightCx = maxX + REGMARK_OFFSET_MM;
  const topCy = minY - REGMARK_OFFSET_MM;
  const bottomCy = maxY + REGMARK_OFFSET_MM;

  const minCx = REGMARK_RADIUS_MM;
  const maxCx = config.rollWidth - REGMARK_RADIUS_MM;
  const minCy = REGMARK_RADIUS_MM;
  const maxCy = pageHeightMm - REGMARK_RADIUS_MM;

  const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);

  return [
    { cx: clamp(leftCx, minCx, maxCx), cy: clamp(topCy, minCy, maxCy), r: REGMARK_RADIUS_MM },
    { cx: clamp(rightCx, minCx, maxCx), cy: clamp(topCy, minCy, maxCy), r: REGMARK_RADIUS_MM },
    { cx: clamp(leftCx, minCx, maxCx), cy: clamp(bottomCy, minCy, maxCy), r: REGMARK_RADIUS_MM },
    { cx: clamp(rightCx, minCx, maxCx), cy: clamp(bottomCy, minCy, maxCy), r: REGMARK_RADIUS_MM }
  ];
}
const MM_PER_INCH = 25.4;
const REGMARK_DIAMETER_MM = 5;
const REGMARK_RADIUS_MM = REGMARK_DIAMETER_MM / 2;
const REGMARK_OFFSET_MM = 3 + REGMARK_RADIUS_MM;

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
const effectiveHeightInfo = document.getElementById('effectiveHeightInfo');

const statusEl = document.getElementById('status');
const tableBody = document.getElementById('photoTableBody');
const previewCanvas = document.getElementById('previewCanvas');
const ctx = previewCanvas.getContext('2d');

const state = {
  photos: [],
  pages: [],
  selectedId: null,
  currentPage: 0,
  drag: {
    active: false,
    id: null,
    offsetXmm: 0,
    offsetYmm: 0
  }
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

function getFootprintRect(item) {
  return {
    x: item.xMm,
    y: item.yMm,
    width: item.widthMm,
    height: item.heightMm
  };
}

function getRectBottomY(rect) {
  return rect.y + rect.height;
}

function getPlacedUsedBottom(placed, config) {
  return Math.max(config.padding, ...placed.map((p) => p.yMm + p.heightMm));
}

function getRotationPenalty(variant, strategy) {
  if (strategy === 'prefer-upright') return variant.rotated ? 1 : 0;
  if (strategy === 'prefer-rotated') return variant.rotated ? 0 : 1;
  return 0;
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

function nestSinglePageWithStrategy(photos, config, strategy) {
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
    const variants = [];
    if (strategy !== 'force-rotated') {
      variants.push({ width: photo.originalWidthMm, height: photo.originalHeightMm, rotated: false });
    }
    if (config.allowRotate && strategy !== 'force-upright') {
      variants.push({ width: photo.originalHeightMm, height: photo.originalWidthMm, rotated: true });
    }

    let best = null;
    for (const rect of freeRects) {
      for (const variant of variants) {
        const footprintWidth = variant.width;
        const footprintHeight = variant.height;
        if (footprintWidth > rect.width + 1e-6 || footprintHeight > rect.height + 1e-6) {
          continue;
        }

        const placedRect = {
          x: rect.x,
          y: rect.y,
          width: footprintWidth,
          height: footprintHeight
        };
        const resultingUsedBottom = Math.max(
          ...placed.map((p) => p.yMm + p.heightMm),
          getRectBottomY(placedRect)
        );
        const shortSideFit = Math.min(rect.width - footprintWidth, rect.height - footprintHeight);
        const longSideFit = Math.max(rect.width - footprintWidth, rect.height - footprintHeight);
        const rotationPenalty = getRotationPenalty(variant, strategy);
        const topY = rect.y;
        const leftX = rect.x;

        if (
          !best ||
          resultingUsedBottom < best.resultingUsedBottom - 1e-9 ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty < best.rotationPenalty) ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty === best.rotationPenalty && topY < best.topY - 1e-9) ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty === best.rotationPenalty && Math.abs(topY - best.topY) < 1e-9 && shortSideFit < best.shortSideFit - 1e-9) ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty === best.rotationPenalty && Math.abs(topY - best.topY) < 1e-9 && Math.abs(shortSideFit - best.shortSideFit) < 1e-9 && longSideFit < best.longSideFit - 1e-9) ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty === best.rotationPenalty && Math.abs(topY - best.topY) < 1e-9 && Math.abs(shortSideFit - best.shortSideFit) < 1e-9 && Math.abs(longSideFit - best.longSideFit) < 1e-9 && leftX < best.leftX - 1e-9)
        ) {
          best = {
            rect,
            variant,
            footprintWidth,
            footprintHeight,
            resultingUsedBottom,
            rotationPenalty,
            topY,
            leftX,
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
      xMm: best.rect.x,
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

function comparePageResults(a, b, config) {
  if (a.placed.length !== b.placed.length) {
    return b.placed.length - a.placed.length;
  }

  const aBottom = getPlacedUsedBottom(a.placed, config);
  const bBottom = getPlacedUsedBottom(b.placed, config);
  if (Math.abs(aBottom - bBottom) > 1e-9) {
    return aBottom - bBottom;
  }

  const aRotated = a.placed.reduce((sum, item) => sum + (item.rotated ? 1 : 0), 0);
  const bRotated = b.placed.reduce((sum, item) => sum + (item.rotated ? 1 : 0), 0);
  if (aRotated !== bRotated) {
    return aRotated - bRotated;
  }

  const aLeftSum = a.placed.reduce((sum, item) => sum + item.xMm, 0);
  const bLeftSum = b.placed.reduce((sum, item) => sum + item.xMm, 0);
  if (Math.abs(aLeftSum - bLeftSum) > 1e-9) {
    return aLeftSum - bLeftSum;
  }

  const aTopSum = a.placed.reduce((sum, item) => sum + item.yMm, 0);
  const bTopSum = b.placed.reduce((sum, item) => sum + item.yMm, 0);
  if (Math.abs(aTopSum - bTopSum) > 1e-9) {
    return aTopSum - bTopSum;
  }

  return 0;
}

function nestSinglePage(photos, config) {
  const strategies = ['prefer-upright', 'neutral'];
  if (config.allowRotate) {
    strategies.push('prefer-rotated');
  }

  const results = strategies.map((strategy) => nestSinglePageWithStrategy(photos, config, strategy));
  results.sort((a, b) => comparePageResults(a, b, config));
  return results[0];
}

function nestAllPagesForMode(photos, config, mode) {
  const pages = [];
  let remaining = [...photos];
  let guard = 0;

  while (remaining.length > 0 && guard < 300) {
    guard += 1;
    const result = mode === 'mixed'
      ? nestSinglePage(remaining, config)
      : nestSinglePageWithStrategy(remaining, config, mode);
    if (result.placed.length === 0) break;
    pages.push(result.placed);
    remaining = result.remaining;
  }

  const totalUsedHeight = pages.reduce((sum, page) => sum + getPageUsedHeightMm(page, config), 0);
  const rotatedCount = pages.reduce(
    (sum, page) => sum + page.reduce((inner, item) => inner + (item.rotated ? 1 : 0), 0),
    0
  );

  return {
    mode,
    pages,
    remaining,
    totalUsedHeight,
    rotatedCount
  };
}

function compareJobResults(a, b) {
  if (a.remaining.length !== b.remaining.length) {
    return a.remaining.length - b.remaining.length;
  }
  if (a.pages.length !== b.pages.length) {
    return a.pages.length - b.pages.length;
  }
  if (Math.abs(a.totalUsedHeight - b.totalUsedHeight) > 1e-9) {
    return a.totalUsedHeight - b.totalUsedHeight;
  }
  if (a.rotatedCount !== b.rotatedCount) {
    return a.rotatedCount - b.rotatedCount;
  }
  return 0;
}

function nestAllPages(photos, config) {
  const modes = config.allowRotate
    ? ['mixed', 'force-upright', 'force-rotated']
    : ['force-upright'];

  const candidates = modes.map((mode) => nestAllPagesForMode(photos, config, mode));
  candidates.sort(compareJobResults);
  const best = candidates[0];

  return {
    pages: best.pages,
    remaining: best.remaining,
    mode: best.mode
  };
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

  if (!effectiveHeightInfo) return;
  if (total === 0) {
    effectiveHeightInfo.textContent = 'Effektive Seitenhoehe: -';
    return;
  }

  const config = getConfig();
  const page = getCurrentPagePlacements();
  const effectiveHeight = getEffectivePageHeightMm(page, config);
  effectiveHeightInfo.textContent = `Effektive Seitenhoehe: ${effectiveHeight.toFixed(1)} mm (Max: ${config.maxHeight.toFixed(1)} mm)`;
}

function drawPreview() {
  const config = getConfig();
  const page = getCurrentPagePlacements();
  const effectivePageHeight = getEffectivePageHeightMm(page, config);

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

    if (item.id === state.selectedId) {
      ctx.strokeStyle = '#e07a1f';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }

    ctx.fillStyle = '#123f37';
    ctx.font = '12px Trebuchet MS';
    ctx.fillText(item.name, x + 6, y + 14);

  }

  // Regmarks für den Bogen (außen)
  ctx.fillStyle = '#111';
  for (const reg of getSheetRegmarks(page, config, effectivePageHeight)) {
    ctx.beginPath();
    ctx.arc(mapX(reg.cx), mapY(reg.cy), reg.r * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  if (page.length > 0) {
    const cutY = mapY(effectivePageHeight);
    ctx.save();
    ctx.strokeStyle = '#b45622';
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(mapX(0), cutY);
    ctx.lineTo(mapX(config.rollWidth), cutY);
    ctx.stroke();
    ctx.restore();
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
  return Math.min(
    config.maxHeight,
    Math.max(
    config.padding,
    ...page.map((item) => item.yMm + item.heightMm + config.padding)
    )
  );
}

function getEffectivePageHeightMm(page, config) {
  return getPageUsedHeightMm(page, config);
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
  const pageHeights = state.pages.map((page) => getEffectivePageHeightMm(page, config));
  const firstPageHeight = pageHeights[0];

  const pdf = new jsPDF({
    unit: 'mm',
    format: [config.rollWidth, firstPageHeight],
    compress: false,
    precision: 12
  });

  state.pages.forEach((page, index) => {
    const pageHeight = pageHeights[index];
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

      if (!includePhotos) {
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        pdf.rect(item.xMm, item.yMm, item.widthMm, item.heightMm);
      }

      // Regmarks werden jetzt pro Bogen gezeichnet (außen)
    }
    // Regmarks für den Bogen (außen)
    for (const reg of getSheetRegmarks(page, config, pageHeight)) {
      pdf.setFillColor(0, 0, 0);
      pdf.circle(reg.cx, reg.cy, reg.r, 'F');
    }
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
  let skipped = 0;

  for (const file of files) {
    try {
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
    } catch {
      skipped += 1;
    }
  }

  if (loaded.length === 0) {
    state.photos = [];
    state.pages = [];
    state.selectedId = null;
    state.currentPage = 0;
    selectedItemInput.value = 'Keins';
    renderTable();
    drawPreview();
    setStatus('Keine lesbaren Bilddateien geladen. Bitte JPG/PNG/WebP pruefen.');
    return;
  }

  state.photos = loaded;
  state.pages = [];
  state.selectedId = null;
  state.currentPage = 0;
  selectedItemInput.value = 'Keins';
  renderTable();
  drawPreview();
  if (skipped > 0) {
    setStatus(`${loaded.length} Fotos geladen, ${skipped} Datei(en) konnten nicht gelesen werden.`);
  } else {
    setStatus(`${loaded.length} Fotos geladen. Starte nun das Nesting.`);
  }
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

  const modeLabel = result.mode || 'mixed';
  setStatus(`Nesting abgeschlossen: ${state.pages.length} Seiten, ${result.remaining.length} nicht platziert (Modus: ${modeLabel}).`);
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

function getCanvasTransform(config) {
  const pad = 20;
  const scale = Math.min(
    (previewCanvas.width - pad * 2) / config.rollWidth,
    (previewCanvas.height - pad * 2) / config.maxHeight
  );
  return { pad, scale };
}

function canvasEventToMm(event, config) {
  const rect = previewCanvas.getBoundingClientRect();
  const sx = previewCanvas.width / rect.width;
  const sy = previewCanvas.height / rect.height;
  const px = (event.clientX - rect.left) * sx;
  const py = (event.clientY - rect.top) * sy;
  const { pad, scale } = getCanvasTransform(config);
  return {
    px,
    py,
    xMm: (px - pad) / scale,
    yMm: (py - pad) / scale,
    pad,
    scale
  };
}

function findItemAtCanvasPoint(px, py, page, config) {
  const { pad, scale } = getCanvasTransform(config);
  for (let i = page.length - 1; i >= 0; i--) {
    const item = page[i];
    const x = pad + item.xMm * scale;
    const y = pad + item.yMm * scale;
    const w = item.widthMm * scale;
    const h = item.heightMm * scale;
    if (px >= x && px <= x + w && py >= y && py <= y + h) {
      return item;
    }
  }
  return null;
}

function stopDrag() {
  state.drag.active = false;
  state.drag.id = null;
  state.drag.offsetXmm = 0;
  state.drag.offsetYmm = 0;
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
  const { px, py } = canvasEventToMm(event, config);
  const item = findItemAtCanvasPoint(px, py, page, config);
  if (item) {
    selectPlacementById(item.id);
    return;
  }

  selectPlacementById(null);
});

previewCanvas.addEventListener('mousedown', (event) => {
  const page = getCurrentPagePlacements();
  if (page.length === 0) return;

  const config = getConfig();
  const { px, py, xMm, yMm } = canvasEventToMm(event, config);
  const item = findItemAtCanvasPoint(px, py, page, config);
  if (!item) return;

  selectPlacementById(item.id);
  state.drag.active = true;
  state.drag.id = item.id;
  state.drag.offsetXmm = xMm - item.xMm;
  state.drag.offsetYmm = yMm - item.yMm;
});

previewCanvas.addEventListener('mousemove', (event) => {
  if (!state.drag.active || !state.drag.id) return;

  const page = getCurrentPagePlacements();
  const selected = page.find((item) => item.id === state.drag.id);
  if (!selected) {
    stopDrag();
    return;
  }

  const config = getConfig();
  const { xMm, yMm } = canvasEventToMm(event, config);
  let nextX = xMm - state.drag.offsetXmm;
  let nextY = yMm - state.drag.offsetYmm;

  const minX = config.padding;
  const maxX = config.rollWidth - config.padding - selected.widthMm;
  const minY = config.padding;
  const maxY = config.maxHeight - config.padding - selected.heightMm;
  nextX = Math.min(Math.max(nextX, minX), maxX);
  nextY = Math.min(Math.max(nextY, minY), maxY);

  const candidate = { ...selected, xMm: nextX, yMm: nextY };
  if (!canPlaceCandidate(candidate, page, config, selected.id)) {
    return;
  }

  selected.xMm = nextX;
  selected.yMm = nextY;
  drawPreview();
});

previewCanvas.addEventListener('mouseup', stopDrag);
previewCanvas.addEventListener('mouseleave', stopDrag);

rotateBtn.addEventListener('click', rotateSelected);
unplaceBtn.addEventListener('click', unplaceSelected);
moveLeftBtn.addEventListener('click', () => moveSelected(-Number(moveStepInput.value || 0), 0));
moveRightBtn.addEventListener('click', () => moveSelected(Number(moveStepInput.value || 0), 0));
moveUpBtn.addEventListener('click', () => moveSelected(0, -Number(moveStepInput.value || 0)));
moveDownBtn.addEventListener('click', () => moveSelected(0, Number(moveStepInput.value || 0)));

renderTable();
drawPreview();
