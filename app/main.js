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

const nestBtn = document.getElementById('nestBtn');
const clearBtn = document.getElementById('clearBtn');
const exportPrintSvgBtn = document.getElementById('exportPrintSvgBtn');
const exportContourSvgBtn = document.getElementById('exportContourSvgBtn');

const statusEl = document.getElementById('status');
const tableBody = document.getElementById('photoTableBody');
const previewCanvas = document.getElementById('previewCanvas');
const ctx = previewCanvas.getContext('2d');

const state = {
  photos: [],
  placements: []
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

function nestPhotos(photos, config) {
  const sorted = [...photos].sort((a, b) => (b.widthMm * b.heightMm) - (a.widthMm * a.heightMm));
  const placed = [];

  let x = config.padding;
  let y = config.padding;
  let rowHeight = 0;

  for (const photo of sorted) {
    const variants = [{ width: photo.widthMm, height: photo.heightMm, rotated: false }];
    if (config.allowRotate) {
      variants.push({ width: photo.heightMm, height: photo.widthMm, rotated: true });
    }

    let bestVariant = null;

    for (const variant of variants) {
      const needsNewRow = x + variant.width > config.rollWidth - config.padding;
      const candidateX = needsNewRow ? config.padding : x;
      const candidateY = needsNewRow ? (y + rowHeight + config.gap) : y;

      if (candidateY + variant.height > config.maxHeight - config.padding) {
        continue;
      }

      bestVariant = {
        ...variant,
        xMm: candidateX,
        yMm: candidateY,
        needsNewRow
      };
      break;
    }

    if (!bestVariant) {
      continue;
    }

    if (bestVariant.needsNewRow) {
      x = config.padding;
      y = y + rowHeight + config.gap;
      rowHeight = 0;
      bestVariant.xMm = x;
      bestVariant.yMm = y;
    }

    placed.push({
      ...photo,
      xMm: bestVariant.xMm,
      yMm: bestVariant.yMm,
      widthMm: bestVariant.width,
      heightMm: bestVariant.height,
      rotated: bestVariant.rotated
    });

    x = bestVariant.xMm + bestVariant.width + config.gap;
    rowHeight = Math.max(rowHeight, bestVariant.height);
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
      ctx.drawImage(item.image, x, y, w, h);
    } else {
      ctx.fillStyle = '#9fd0c4';
      ctx.fillRect(x, y, w, h);
    }

    ctx.strokeStyle = '#21302c';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

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

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildSvg(includePhotos) {
  const rollWidth = Number(rollWidthInput.value);
  const maxHeight = Number(maxHeightInput.value);

  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${rollWidth}mm" height="${maxHeight}mm" viewBox="0 0 ${rollWidth} ${maxHeight}">`);
  parts.push(`<rect x="0" y="0" width="${rollWidth}" height="${maxHeight}" fill="white" />`);

  for (const item of state.placements) {
    if (includePhotos) {
      if (item.dataUrl) {
        parts.push(`<image href="${item.dataUrl}" x="${item.xMm}" y="${item.yMm}" width="${item.widthMm}" height="${item.heightMm}" preserveAspectRatio="none" />`);
      } else {
        parts.push(`<rect x="${item.xMm}" y="${item.yMm}" width="${item.widthMm}" height="${item.heightMm}" fill="#9fd0c4" />`);
      }
    }

    parts.push(`<rect x="${item.xMm}" y="${item.yMm}" width="${item.widthMm}" height="${item.heightMm}" fill="none" stroke="#111" stroke-width="0.2" />`);

    for (const reg of getRegmarks(item)) {
      parts.push(`<circle cx="${reg.cx}" cy="${reg.cy}" r="${reg.r}" fill="#000" />`);
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
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
      image,
      dataUrl
    });
  }

  state.photos = loaded;
  state.placements = [];
  renderTable();
  drawPreview();
  setStatus(`${loaded.length} Fotos geladen. Starte nun das Nesting.`);
}

function runNesting() {
  const config = {
    rollWidth: Number(rollWidthInput.value),
    maxHeight: Number(maxHeightInput.value),
    gap: Number(gapInput.value),
    allowRotate: allowRotateInput.checked,
    padding: Number(paddingInput.value)
  };

  state.placements = nestPhotos(state.photos, config);
  renderTable();
  drawPreview();

  const unplaced = state.photos.length - state.placements.length;
  setStatus(`Nesting abgeschlossen: ${state.placements.length} platziert, ${unplaced} nicht platziert.`);
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
  photoInput.value = '';
  renderTable();
  drawPreview();
  setStatus('Job geleert.');
});

exportPrintSvgBtn.addEventListener('click', () => {
  if (state.placements.length === 0) {
    setStatus('Kein Layout zum Exportieren vorhanden.');
    return;
  }
  const svg = buildSvg(true);
  downloadTextFile('druck_motive_regmarks.svg', svg, 'image/svg+xml');
  setStatus('Druck-SVG exportiert.');
});

exportContourSvgBtn.addEventListener('click', () => {
  if (state.placements.length === 0) {
    setStatus('Kein Layout zum Exportieren vorhanden.');
    return;
  }
  const svg = buildSvg(false);
  downloadTextFile('kontur_regmarks.svg', svg, 'image/svg+xml');
  setStatus('Kontur-SVG exportiert.');
});

drawPreview();
