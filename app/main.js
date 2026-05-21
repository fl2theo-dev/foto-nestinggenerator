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
const exportPrintPdfBtn = document.getElementById('exportPrintPdfBtn');
const exportContourPdfBtn = document.getElementById('exportContourPdfBtn');
const rotateBtn = document.getElementById('rotateBtn');
const unplaceBtn = document.getElementById('unplaceBtn');
const moveLeftBtn = document.getElementById('moveLeftBtn');
const moveRightBtn = document.getElementById('moveRightBtn');
const moveUpBtn = document.getElementById('moveUpBtn');
const moveDownBtn = document.getElementById('moveDownBtn');

const statusEl = document.getElementById('status');
const tableBody = document.getElementById('photoTableBody');
const previewCanvas = document.getElementById('previewCanvas');
const ctx = previewCanvas.getContext('2d');

const state = {
  photos: [],
  placements: [],
  selectedId: null
};

function setStatus(message) {
  statusEl.textContent = message;
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

function pxToMm(px, dpi) {
  return (px / dpi) * MM_PER_INCH;
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

function getConfig() {
  return {
    rollWidth: Number(rollWidthInput.value),
    maxHeight: Number(maxHeightInput.value),
    gap: Number(gapInput.value),
    allowRotate: allowRotateInput.checked,
    padding: Number(paddingInput.value)
  };
}

function canPlaceCandidate(candidate, ignoreId = null) {
  const config = getConfig();
  const fp = getFootprintRect(candidate);

  if (fp.x < config.padding - 1e-6) return false;
  if (fp.y < config.padding - 1e-6) return false;
  if (fp.x + fp.width > config.rollWidth - config.padding + 1e-6) return false;
  if (fp.y + fp.height > config.maxHeight - config.padding + 1e-6) return false;

  for (const other of state.placements) {
    if (other.id === ignoreId) continue;
    const otherFp = getFootprintRect(other);
    if (rectsOverlap(fp, otherFp, config.gap)) return false;
  }

  return true;
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

    if (ox1 > rx1 + 1e-6) {
      result.push({ x: rx1, y: ry1, width: ox1 - rx1, height: rect.height });
    }
    if (ox2 < rx2 - 1e-6) {
      result.push({ x: ox2, y: ry1, width: rx2 - ox2, height: rect.height });
    }
    if (oy1 > ry1 + 1e-6) {
      result.push({ x: rx1, y: ry1, width: rect.width, height: oy1 - ry1 });
    }
    if (oy2 < ry2 - 1e-6) {
      result.push({ x: rx1, y: oy2, width: rect.width, height: ry2 - oy2 });
    }
  }

  return pruneContained(result).filter((r) => r.width > 1e-3 && r.height > 1e-3);
}

function nestPhotos(photos, config) {
  const sorted = [...photos].sort((a, b) => (b.widthMm * b.heightMm) - (a.widthMm * a.heightMm));
  const placed = [];
  let freeRects = [
    {
      x: config.padding,
      y: config.padding,
      width: config.rollWidth - config.padding * 2,
      height: config.maxHeight - config.padding * 2
    }
  ];

  for (const photo of sorted) {
    const baseVariants = [{ width: photo.widthMm, height: photo.heightMm, rotated: false }];
    if (config.allowRotate) {
      baseVariants.push({ width: photo.heightMm, height: photo.widthMm, rotated: true });
    }

    const variants = baseVariants.map((variant) => {
      return {
        ...variant,
        footprintWidth: variant.width + 2 * REGMARK_OUTER_PAD_MM,
        footprintHeight: variant.height
      };
    });

    let best = null;

    for (let i = 0; i < freeRects.length; i++) {
      const rect = freeRects[i];
      for (const variant of variants) {
        if (variant.footprintWidth > rect.width + 1e-6 || variant.footprintHeight > rect.height + 1e-6) {
          continue;
        }

        const shortSideFit = Math.min(rect.width - variant.footprintWidth, rect.height - variant.footprintHeight);
        const longSideFit = Math.max(rect.width - variant.footprintWidth, rect.height - variant.footprintHeight);

        if (
          !best ||
          shortSideFit < best.shortSideFit - 1e-9 ||
          (Math.abs(shortSideFit - best.shortSideFit) < 1e-9 && longSideFit < best.longSideFit - 1e-9)
        ) {
          best = {
            rectIndex: i,
            footprintX: rect.x,
            footprintY: rect.y,
            shortSideFit,
            longSideFit,
            variant
          };
        }
      }
    }

    if (!best) {
      continue;
    }

    const place = {
      ...photo,
      xMm: best.footprintX + REGMARK_OUTER_PAD_MM,
      yMm: best.footprintY,
      widthMm: best.variant.width,
      heightMm: best.variant.height,
      rotated: best.variant.rotated
    };

    placed.push(place);

    const obstacle = {
      x: best.footprintX,
      y: best.footprintY,
      width: best.variant.footprintWidth,
      height: best.variant.footprintHeight
    };
    freeRects = splitFreeRects(freeRects, obstacle, config.gap);
  }

  return placed;
}

function drawPreview() {
  const rollWidth = Number(rollWidthInput.value);
  const maxHeight = Number(maxHeightInput.value);

  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  if (rollWidth <= 0 || maxHeight <= 0) return;

  const pad = 20;
  const scale = Math.min(
    (previewCanvas.width - pad * 2) / rollWidth,
    (previewCanvas.height - pad * 2) / maxHeight
  );

  const mapX = (mm) => pad + mm * scale;
  const mapY = (mm) => pad + mm * scale;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#c4bca9';
  ctx.lineWidth = 2;
  ctx.fillRect(mapX(0), mapY(0), rollWidth * scale, maxHeight * scale);
  ctx.strokeRect(mapX(0), mapY(0), rollWidth * scale, maxHeight * scale);

  for (const item of state.placements) {
    const x = mapX(item.xMm);
    const y = mapY(item.yMm);
    const w = item.widthMm * scale;
    const h = item.heightMm * scale;

    if (item.image) {
      if (item.rotated) {
        ctx.save();
        ctx.translate(x + w, y);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(item.image, 0, 0, item.originalWidthMm * scale, item.originalHeightMm * scale);
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
}

function renderTable() {
  tableBody.innerHTML = '';
  const placedNames = new Set(state.placements.map((p) => p.id));

  state.photos.forEach((photo) => {
    const tr = document.createElement('tr');
    const placed = placedNames.has(photo.id) ? 'Ja' : 'Nein';
    tr.innerHTML = `
      <td>${photo.name}</td>
      <td>${photo.pixelWidth} x ${photo.pixelHeight}</td>
      <td>${photo.widthMm.toFixed(1)} x ${photo.heightMm.toFixed(1)}</td>
      <td>${placed}</td>
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

function getUsedHeightMm() {
  const padding = Number(paddingInput.value);
  return Math.max(
    padding,
    ...state.placements.map((item) => item.yMm + item.heightMm + padding)
  );
}

function exportPdf(includePhotos) {
  if (state.placements.length === 0) {
    setStatus('Kein Layout zum Exportieren vorhanden.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    setStatus('PDF-Bibliothek lokal nicht gefunden. Bitte im Projektordner einmal npm install ausfuehren.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const rollWidth = Number(rollWidthInput.value);
  const pageHeight = Math.min(Number(maxHeightInput.value), Math.max(50, getUsedHeightMm()));
  const pdf = new jsPDF({
    unit: 'mm',
    format: [rollWidth, pageHeight],
    compress: false,
    precision: 12
  });

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, rollWidth, pageHeight, 'F');

  for (const item of state.placements) {
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

  pdf.save(includePhotos ? 'druck_motive_regmarks.pdf' : 'kontur_regmarks.pdf');
  if (includePhotos) {
    setStatus('Druck-PDF exportiert. Fuer ICC/PDFX bitte danach scripts/make-pdfx.js nutzen.');
  } else {
    setStatus('Kontur-PDF exportiert.');
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
      widthMm: pxToMm(image.naturalWidth, dpi),
      heightMm: pxToMm(image.naturalHeight, dpi),
      originalWidthMm: pxToMm(image.naturalWidth, dpi),
      originalHeightMm: pxToMm(image.naturalHeight, dpi),
      image,
      dataUrl
    });
  }

  state.photos = loaded;
  state.placements = [];
  state.selectedId = null;
  selectedItemInput.value = 'Keins';
  renderTable();
  drawPreview();
  setStatus(`${loaded.length} Fotos geladen. Starte nun das Nesting.`);
}

function runNesting() {
  const config = getConfig();

  state.placements = nestPhotos(state.photos, config);
  state.selectedId = null;
  selectedItemInput.value = 'Keins';
  renderTable();
  drawPreview();

  const unplaced = state.photos.length - state.placements.length;
  setStatus(`Nesting abgeschlossen: ${state.placements.length} platziert, ${unplaced} nicht platziert.`);
}

function selectPlacementById(id) {
  state.selectedId = id;
  const item = state.placements.find((p) => p.id === id);
  selectedItemInput.value = item ? item.name : 'Keins';
  drawPreview();
}

function getSelectedPlacement() {
  return state.placements.find((item) => item.id === state.selectedId) || null;
}

function moveSelected(dx, dy) {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const candidate = { ...selected, xMm: selected.xMm + dx, yMm: selected.yMm + dy };
  if (!canPlaceCandidate(candidate, selected.id)) {
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

  const candidate = {
    ...selected,
    widthMm: selected.heightMm,
    heightMm: selected.widthMm,
    rotated: !selected.rotated
  };

  if (!canPlaceCandidate(candidate, selected.id)) {
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

  state.placements = state.placements.filter((item) => item.id !== selected.id);
  state.selectedId = null;
  selectedItemInput.value = 'Keins';
  renderTable();
  drawPreview();
  setStatus(`${selected.name} zurueck in die Liste gelegt.`);
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

clearBtn.addEventListener('click', () => {
  state.photos = [];
  state.placements = [];
  state.selectedId = null;
  selectedItemInput.value = 'Keins';
  photoInput.value = '';
  renderTable();
  drawPreview();
  setStatus('Job geleert.');
});

exportPrintPdfBtn.addEventListener('click', () => exportPdf(true));
exportContourPdfBtn.addEventListener('click', () => exportPdf(false));

previewCanvas.addEventListener('click', (event) => {
  const rect = previewCanvas.getBoundingClientRect();
  const sx = previewCanvas.width / rect.width;
  const sy = previewCanvas.height / rect.height;
  const px = (event.clientX - rect.left) * sx;
  const py = (event.clientY - rect.top) * sy;

  const rollWidth = Number(rollWidthInput.value);
  const maxHeight = Number(maxHeightInput.value);
  const pad = 20;
  const scale = Math.min(
    (previewCanvas.width - pad * 2) / rollWidth,
    (previewCanvas.height - pad * 2) / maxHeight
  );

  for (let i = state.placements.length - 1; i >= 0; i--) {
    const item = state.placements[i];
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

drawPreview();
