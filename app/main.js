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
const MM_PER_POINT = MM_PER_INCH / 72;
const MM_PER_CM = 10;
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
const nestPageBtn = document.getElementById('nestPageBtn');
const clearBtn = document.getElementById('clearBtn');
const placeSelectionBtn = document.getElementById('placeSelectionBtn');
const deleteSelectionBtn = document.getElementById('deleteSelectionBtn');
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
const manualNestingMenu = document.getElementById('manualNestingMenu');
const menuRotateBtn = document.getElementById('menuRotateBtn');
const menuUnplaceBtn = document.getElementById('menuUnplaceBtn');
const menuUpBtn = document.getElementById('menuUpBtn');
const menuLeftBtn = document.getElementById('menuLeftBtn');
const menuRightBtn = document.getElementById('menuRightBtn');
const menuDownBtn = document.getElementById('menuDownBtn');
const menuShowImageBtn = document.getElementById('menuShowImageBtn');
const menuCropBtn = document.getElementById('menuCropBtn');
const menuCurrentSizeValue = document.getElementById('menuCurrentSizeValue');
const menuScaleWidthCm = document.getElementById('menuScaleWidthCm');
const menuScaleHeightCm = document.getElementById('menuScaleHeightCm');
const menuScaleDpi = document.getElementById('menuScaleDpi');
const menuApplyScaleBtn = document.getElementById('menuApplyScaleBtn');
const photoOverlay = document.getElementById('photoOverlay');
const photoOverlayViewport = document.getElementById('photoOverlayViewport');
const photoOverlayImage = document.getElementById('photoOverlayImage');
const photoOverlayCaption = document.getElementById('photoOverlayCaption');
const photoOverlayCloseBtn = document.getElementById('photoOverlayCloseBtn');
const cropOverlay = document.getElementById('cropOverlay');
const cropOverlayCanvas = document.getElementById('cropOverlayCanvas');
const cropOverlayApplyBtn = document.getElementById('cropOverlayApplyBtn');
const cropOverlayCancelBtn = document.getElementById('cropOverlayCancelBtn');
const cropTargetWidthCm = document.getElementById('cropTargetWidthCm');
const cropTargetHeightCm = document.getElementById('cropTargetHeightCm');
const cropOverlayDpiInfo = document.getElementById('cropOverlayDpiInfo');
const cropRectXPercent = document.getElementById('cropRectXPercent');
const cropRectYPercent = document.getElementById('cropRectYPercent');
const cropRectWPercent = document.getElementById('cropRectWPercent');
const cropRectHPercent = document.getElementById('cropRectHPercent');
const cropRatioH = document.getElementById('cropRatioH');
const cropRatioW = document.getElementById('cropRatioW');

const overlayView = {
  scale: 1,
  tx: 0,
  ty: 0,
  dragging: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startTx: 0,
  startTy: 0
};

const statusEl = document.getElementById('status');
const tableBody = document.getElementById('photoTableBody');
const previewCanvas = document.getElementById('previewCanvas');
const ctx = previewCanvas.getContext('2d');

const PHOTO_CARD_ROW_HEIGHT = 86;
const PHOTO_CARD_OVERSCAN = 6;

const state = {
  photos: [],
  pages: [],
  listSelection: new Set(),
  selectedId: null,
  currentPage: 0,
  drag: {
    active: false,
    id: null,
    offsetXmm: 0,
    offsetYmm: 0,
    moved: false,
    startClientX: 0,
    startClientY: 0
  }
};

let suppressCanvasClick = false;
let virtualListInitialized = false;
let manualScaleLastEdited = 'width';

const virtualPhotoList = {
  items: []
};

const cropEditor = {
  active: false,
  aspect: 1,
  rect: { x: 0, y: 0, w: 0, h: 0 },
  display: { x: 0, y: 0, w: 0, h: 0 },
  dragging: false,
  dragMode: null,
  activeHandle: null,
  pointerId: null,
  resizeAnchor: null,
  dragOffsetX: 0,
  dragOffsetY: 0
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

function getPhotoById(id) {
  return state.photos.find((photo) => photo.id === id) || null;
}

function cleanupEmptyPages() {
  for (let i = state.pages.length - 1; i >= 0; i--) {
    if (state.pages[i].length > 0) continue;
    state.pages.splice(i, 1);
    if (state.currentPage > i) {
      state.currentPage -= 1;
    }
  }

  if (state.pages.length === 0) {
    state.currentPage = 0;
    return;
  }

  state.currentPage = Math.min(Math.max(0, state.currentPage), state.pages.length - 1);
}

function findPlacementByIdGlobal(id) {
  for (let pageIndex = 0; pageIndex < state.pages.length; pageIndex++) {
    const itemIndex = state.pages[pageIndex].findIndex((item) => item.id === id);
    if (itemIndex >= 0) {
      return {
        pageIndex,
        itemIndex,
        item: state.pages[pageIndex][itemIndex]
      };
    }
  }
  return null;
}

function removePlacementByIdGlobal(id) {
  const found = findPlacementByIdGlobal(id);
  if (!found) return null;
  const [item] = state.pages[found.pageIndex].splice(found.itemIndex, 1);
  cleanupEmptyPages();
  return { ...found, item };
}

function ensureCurrentPage() {
  if (state.pages.length === 0) {
    state.pages = [[]];
    state.currentPage = 0;
  }
  if (!state.pages[state.currentPage]) {
    state.pages[state.currentPage] = [];
  }
}

function updateSelectionActionButtons() {
  const count = state.listSelection.size;
  if (placeSelectionBtn) placeSelectionBtn.disabled = count === 0;
  if (deleteSelectionBtn) deleteSelectionBtn.disabled = count === 0;
}

function getPlacementFromPhoto(photo) {
  return {
    ...photo,
    xMm: 0,
    yMm: 0,
    widthMm: photo.originalWidthMm,
    heightMm: photo.originalHeightMm,
    rotated: false
  };
}

function placePhotoOnCurrentPageAt(photoId, dropXmm, dropYmm) {
  const photo = getPhotoById(photoId);
  if (!photo) return false;

  const removed = removePlacementByIdGlobal(photoId);
  const base = removed?.item ? { ...removed.item } : getPlacementFromPhoto(photo);

  ensureCurrentPage();
  const page = getCurrentPagePlacements();
  const config = getConfig();
  const candidate = {
    ...base,
    xMm: dropXmm - base.widthMm / 2,
    yMm: dropYmm - base.heightMm / 2
  };

  const snapped = findNearestFreePlacement(candidate, page, config, null, {
    maxRadiusMm: Math.max(base.widthMm, base.heightMm) + 180,
    angleSamples: 24,
    stepMm: Math.max(1, Number(moveStepInput.value || 0) || 2)
  });

  if (!snapped) {
    if (removed?.item) {
      const restoreIndex = Math.min(Math.max(0, removed.pageIndex), state.pages.length);
      if (!state.pages[restoreIndex]) {
        state.pages.splice(restoreIndex, 0, []);
      }
      state.pages[restoreIndex].push(removed.item);
      cleanupEmptyPages();
    }
    return false;
  }

  page.push({
    ...base,
    xMm: snapped.xMm,
    yMm: snapped.yMm,
    widthMm: snapped.widthMm,
    heightMm: snapped.heightMm,
    rotated: snapped.rotated
  });

  return true;
}

function nestCurrentPage() {
  ensureCurrentPage();
  const page = getCurrentPagePlacements();
  if (page.length === 0) {
    setStatus('Auf dem aktuellen Bogen sind keine Motive platziert.');
    return;
  }

  const config = getConfig();
  const result = nestSinglePage(page, config);
  state.pages[state.currentPage] = result.placed;

  if (result.remaining.length > 0) {
    setStatus(`Bogen genestet: ${result.placed.length} platziert, ${result.remaining.length} passen nicht auf diesen Bogen.`);
  } else {
    setStatus(`Bogen genestet: ${result.placed.length} Motive sauber angeordnet.`);
  }

  renderTable();
  drawPreview();
}

function placeListSelectionOnCurrentPage() {
  const selectedIds = Array.from(state.listSelection);
  if (selectedIds.length === 0) {
    setStatus('Bitte zuerst Motive in der Liste auswaehlen.');
    return;
  }

  ensureCurrentPage();
  let placed = 0;
  const page = getCurrentPagePlacements();
  const startX = getConfig().padding + 30;
  const startY = getConfig().padding + 30;

  selectedIds.forEach((id, index) => {
    const offset = index * 12;
    if (placePhotoOnCurrentPageAt(id, startX + offset, startY + offset)) {
      placed += 1;
    }
  });

  nestCurrentPage();
  if (placed < selectedIds.length) {
    setStatus(`Auswahl teilweise platziert: ${placed}/${selectedIds.length}. Rest passt nicht auf den Bogen.`);
  }
}

function deleteListSelection() {
  const selectedIds = Array.from(state.listSelection);
  if (selectedIds.length === 0) {
    setStatus('Bitte zuerst Motive in der Liste auswaehlen.');
    return;
  }

  const deleteSet = new Set(selectedIds);
  state.photos = state.photos.filter((photo) => !deleteSet.has(photo.id));
  state.pages = state.pages.map((page) => page.filter((item) => !deleteSet.has(item.id)));
  cleanupEmptyPages();

  if (state.selectedId && deleteSet.has(state.selectedId)) {
    state.selectedId = null;
    selectedItemInput.value = 'Keins';
    hideManualMenu();
  }

  state.listSelection.clear();
  updateSelectionActionButtons();
  renderTable();
  drawPreview();
  setStatus(`${selectedIds.length} Motiv(e) aus der Auswahl geloescht.`);
}

function getCropNorm(item) {
  return item.cropNorm || { x: 0, y: 0, w: 1, h: 1 };
}

function getCropPixels(item) {
  const cn = getCropNorm(item);
  const iw = Math.max(1, item.image.naturalWidth);
  const ih = Math.max(1, item.image.naturalHeight);
  const sx = Math.max(0, Math.min(iw - 1, cn.x * iw));
  const sy = Math.max(0, Math.min(ih - 1, cn.y * ih));
  const sw = Math.max(1, Math.min(iw - sx, cn.w * iw));
  const sh = Math.max(1, Math.min(ih - sy, cn.h * ih));
  return { sx, sy, sw, sh, iw, ih };
}

function getPlacementPixelDims(item) {
  const crop = getCropPixels(item);
  return {
    pxWidth: item.rotated ? crop.sh : crop.sw,
    pxHeight: item.rotated ? crop.sw : crop.sh
  };
}

function getPlacementAspectRatio(item) {
  const dims = getPlacementPixelDims(item);
  return dims.pxWidth / Math.max(1e-6, dims.pxHeight);
}

function updateManualScaleControlsForSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    if (menuCurrentSizeValue) menuCurrentSizeValue.textContent = '-';
    if (menuScaleWidthCm) menuScaleWidthCm.value = '';
    if (menuScaleHeightCm) menuScaleHeightCm.value = '';
    if (menuScaleDpi) menuScaleDpi.value = '';
    return;
  }

  if (menuCurrentSizeValue) {
    menuCurrentSizeValue.textContent = `${(selected.widthMm / MM_PER_CM).toFixed(1)} x ${(selected.heightMm / MM_PER_CM).toFixed(1)} cm`;
  }
  if (menuScaleWidthCm) menuScaleWidthCm.value = (selected.widthMm / MM_PER_CM).toFixed(1);
  if (menuScaleHeightCm) menuScaleHeightCm.value = (selected.heightMm / MM_PER_CM).toFixed(1);

  const dims = getPlacementPixelDims(selected);
  const dpiX = dims.pxWidth / (selected.widthMm / MM_PER_INCH);
  const dpiY = dims.pxHeight / (selected.heightMm / MM_PER_INCH);
  const avgDpi = (dpiX + dpiY) / 2;
  if (menuScaleDpi) menuScaleDpi.value = Number.isFinite(avgDpi) ? String(Math.round(avgDpi)) : '';
}

function syncScaleInputsByRatio(changedAxis) {
  const selected = getSelectedPlacement();
  if (!selected) return;
  const ratio = getPlacementAspectRatio(selected);

  const w = Number(menuScaleWidthCm?.value || 0);
  const h = Number(menuScaleHeightCm?.value || 0);

  if (changedAxis === 'width' && w > 0 && menuScaleHeightCm) {
    menuScaleHeightCm.value = (w / ratio).toFixed(1);
  }
  if (changedAxis === 'height' && h > 0 && menuScaleWidthCm) {
    menuScaleWidthCm.value = (h * ratio).toFixed(1);
  }
}

function applyScaleToSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const page = getCurrentPagePlacements();
  const config = getConfig();

  const targetWidthCm = Number(menuScaleWidthCm?.value || 0);
  const targetHeightCm = Number(menuScaleHeightCm?.value || 0);
  const targetDpi = Number(menuScaleDpi?.value || 0);

  let targetWidthMm = targetWidthCm > 0 ? targetWidthCm * MM_PER_CM : null;
  let targetHeightMm = targetHeightCm > 0 ? targetHeightCm * MM_PER_CM : null;

  const pxDims = getPlacementPixelDims(selected);
  if ((!targetWidthMm || !targetHeightMm) && targetDpi > 0) {
    const dpiWidthMm = (pxDims.pxWidth / targetDpi) * MM_PER_INCH;
    const dpiHeightMm = (pxDims.pxHeight / targetDpi) * MM_PER_INCH;
    if (!targetWidthMm) targetWidthMm = dpiWidthMm;
    if (!targetHeightMm) targetHeightMm = dpiHeightMm;
  }

  const ratio = getPlacementAspectRatio(selected);
  if (targetWidthMm && !targetHeightMm) {
    targetHeightMm = targetWidthMm / ratio;
  }
  if (targetHeightMm && !targetWidthMm) {
    targetWidthMm = targetHeightMm * ratio;
  }
  if (targetWidthMm && targetHeightMm) {
    if (manualScaleLastEdited === 'height') {
      targetWidthMm = targetHeightMm * ratio;
    } else {
      targetHeightMm = targetWidthMm / ratio;
    }
  }

  if (!targetWidthMm || !targetHeightMm || targetWidthMm <= 0 || targetHeightMm <= 0) {
    setStatus('Bitte Zielgroesse oder DPI gueltig eingeben.');
    return;
  }

  const centerX = selected.xMm + selected.widthMm / 2;
  const centerY = selected.yMm + selected.heightMm / 2;
  const candidate = {
    ...selected,
    xMm: centerX - targetWidthMm / 2,
    yMm: centerY - targetHeightMm / 2,
    widthMm: targetWidthMm,
    heightMm: targetHeightMm
  };

  const snapped = findNearestFreePlacement(candidate, page, config, selected.id, {
    maxRadiusMm: Math.max(targetWidthMm, targetHeightMm) + 180,
    angleSamples: 24,
    stepMm: Math.max(1, Number(moveStepInput.value || 0) || 2)
  });

  if (!snapped) {
    setStatus('Skalierung nicht moeglich (keine freie Position gefunden).');
    return;
  }

  selected.xMm = snapped.xMm;
  selected.yMm = snapped.yMm;
  selected.widthMm = snapped.widthMm;
  selected.heightMm = snapped.heightMm;

  updateManualScaleControlsForSelected();
  drawPreview();
  setStatus(`${selected.name} skaliert auf ${(selected.widthMm / MM_PER_CM).toFixed(1)} x ${(selected.heightMm / MM_PER_CM).toFixed(1)} cm.`);
}

function fitRectToAspect(rect, aspect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let w = rect.w;
  let h = rect.h;
  if (w / h > aspect) {
    w = h * aspect;
  } else {
    h = w / aspect;
  }
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function clampCropRect(rect, iw, ih) {
  const r = { ...rect };
  r.w = Math.min(Math.max(8, r.w), iw);
  r.h = Math.min(Math.max(8, r.h), ih);
  r.x = Math.min(Math.max(0, r.x), iw - r.w);
  r.y = Math.min(Math.max(0, r.y), ih - r.h);
  return r;
}

function toPercent(value, total) {
  return (value / Math.max(1e-6, total)) * 100;
}

function fromPercent(value, total) {
  return (value / 100) * total;
}

function getCropRectCanvas(selected) {
  const d = cropEditor.display;
  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  return {
    x: d.x + (cropEditor.rect.x / iw) * d.w,
    y: d.y + (cropEditor.rect.y / ih) * d.h,
    w: (cropEditor.rect.w / iw) * d.w,
    h: (cropEditor.rect.h / ih) * d.h
  };
}

function canvasToImagePoint(selected, x, y) {
  const d = cropEditor.display;
  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  const px = ((x - d.x) / Math.max(1e-6, d.w)) * iw;
  const py = ((y - d.y) / Math.max(1e-6, d.h)) * ih;
  return {
    x: Math.min(Math.max(0, px), iw),
    y: Math.min(Math.max(0, py), ih)
  };
}

function getHandlePoints(rect) {
  return {
    nw: { x: rect.x, y: rect.y },
    ne: { x: rect.x + rect.w, y: rect.y },
    se: { x: rect.x + rect.w, y: rect.y + rect.h },
    sw: { x: rect.x, y: rect.y + rect.h }
  };
}

function getHandleAtCanvasPoint(selected, x, y, threshold = 12) {
  const rect = getCropRectCanvas(selected);
  const handles = getHandlePoints(rect);
  let best = null;
  let bestDist = Infinity;

  for (const [key, pt] of Object.entries(handles)) {
    const dist = Math.hypot(x - pt.x, y - pt.y);
    if (dist <= threshold && dist < bestDist) {
      best = key;
      bestDist = dist;
    }
  }
  return best;
}

function getResizeAnchorForHandle(handle, rect) {
  if (handle === 'nw') return { x: rect.x + rect.w, y: rect.y + rect.h };
  if (handle === 'ne') return { x: rect.x, y: rect.y + rect.h };
  if (handle === 'se') return { x: rect.x, y: rect.y };
  if (handle === 'sw') return { x: rect.x + rect.w, y: rect.y };
  return null;
}

function buildRectFromHandleDrag(handle, anchor, pointer, iw, ih) {
  const minSize = 8;
  let x = 0;
  let y = 0;
  let w = minSize;
  let h = minSize;

  if (handle === 'nw') {
    x = Math.min(pointer.x, anchor.x - minSize);
    y = Math.min(pointer.y, anchor.y - minSize);
    w = anchor.x - x;
    h = anchor.y - y;
  } else if (handle === 'ne') {
    x = anchor.x;
    y = Math.min(pointer.y, anchor.y - minSize);
    w = Math.max(minSize, pointer.x - anchor.x);
    h = anchor.y - y;
  } else if (handle === 'se') {
    x = anchor.x;
    y = anchor.y;
    w = Math.max(minSize, pointer.x - anchor.x);
    h = Math.max(minSize, pointer.y - anchor.y);
  } else if (handle === 'sw') {
    x = Math.min(pointer.x, anchor.x - minSize);
    y = anchor.y;
    w = anchor.x - x;
    h = Math.max(minSize, pointer.y - anchor.y);
  }

  return clampCropRect({ x, y, w, h }, iw, ih);
}

// Ratio-Inputs aus aktuellem Crop-Rect aktualisieren (normiert: max(H,W) = 10)
function updateRatioInputsFromRect() {
  if (!cropEditor.active || !cropRatioH || !cropRatioW) return;
  // Nicht überschreiben, solange der Nutzer in den Ratio-Feldern tippt
  if (document.activeElement === cropRatioH || document.activeElement === cropRatioW) return;
  const h = cropEditor.rect.h;
  const w = cropEditor.rect.w;
  if (h <= 0 || w <= 0) return;
  const factor = 10 / Math.max(h, w);
  cropRatioH.value = (h * factor).toFixed(2);
  cropRatioW.value = (w * factor).toFixed(2);
}

// Ratio aus Ratio-Inputs auf das Crop-Rect anwenden (Mittelpunkt bleibt, Grösse passt sich an)
function applyCropRatioFromInputs() {
  if (!cropEditor.active) return;
  const selected = getSelectedPlacement();
  if (!selected) return;
  const rH = Number(cropRatioH?.value || 0);
  const rW = Number(cropRatioW?.value || 0);
  if (rH <= 0 || rW <= 0) return;

  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  const targetAspect = rW / rH; // W/H
  const cx = cropEditor.rect.x + cropEditor.rect.w / 2;
  const cy = cropEditor.rect.y + cropEditor.rect.h / 2;

  let w = cropEditor.rect.w;
  let h = w / targetAspect;
  if (h > ih) { h = ih; w = h * targetAspect; }
  if (w > iw) { w = iw; h = w / targetAspect; }

  cropEditor.rect = clampCropRect({ x: cx - w / 2, y: cy - h / 2, w, h }, iw, ih);
  cropEditor.aspect = targetAspect;
  renderCropOverlay();
  // X/Y/W/H% aktualisieren, aber Ratio-Inputs NICHT überschreiben (Nutzer tippt dort gerade)
  const iwc = Math.max(1, iw);
  const ihc = Math.max(1, ih);
  if (cropRectXPercent) cropRectXPercent.value = toPercent(cropEditor.rect.x, iwc).toFixed(2);
  if (cropRectYPercent) cropRectYPercent.value = toPercent(cropEditor.rect.y, ihc).toFixed(2);
  if (cropRectWPercent) cropRectWPercent.value = toPercent(cropEditor.rect.w, iwc).toFixed(2);
  if (cropRectHPercent) cropRectHPercent.value = toPercent(cropEditor.rect.h, ihc).toFixed(2);
  updateCropOverlayDpiInfo();
}

function updateCropRectInputs() {
  const selected = getSelectedPlacement();
  if (!selected || !cropEditor.active) return;
  const iw = Math.max(1, selected.image.naturalWidth);
  const ih = Math.max(1, selected.image.naturalHeight);

  if (cropRectXPercent) cropRectXPercent.value = toPercent(cropEditor.rect.x, iw).toFixed(2);
  if (cropRectYPercent) cropRectYPercent.value = toPercent(cropEditor.rect.y, ih).toFixed(2);
  if (cropRectWPercent) cropRectWPercent.value = toPercent(cropEditor.rect.w, iw).toFixed(2);
  if (cropRectHPercent) cropRectHPercent.value = toPercent(cropEditor.rect.h, ih).toFixed(2);
  updateRatioInputsFromRect();
}

function applyCropRectInputs(changedField) {
  if (!cropEditor.active) return;
  const selected = getSelectedPlacement();
  if (!selected) return;

  const iw = Math.max(1, selected.image.naturalWidth);
  const ih = Math.max(1, selected.image.naturalHeight);
  const current = cropEditor.rect;

  let x = fromPercent(Number(cropRectXPercent?.value || toPercent(current.x, iw)), iw);
  let y = fromPercent(Number(cropRectYPercent?.value || toPercent(current.y, ih)), ih);
  let w = fromPercent(Number(cropRectWPercent?.value || toPercent(current.w, iw)), iw);
  let h = fromPercent(Number(cropRectHPercent?.value || toPercent(current.h, ih)), ih);

  if (changedField === 'x') x = Math.max(0, x);
  if (changedField === 'y') y = Math.max(0, y);
  if (changedField === 'w') w = Math.max(8, w);
  if (changedField === 'h') h = Math.max(8, h);

  cropEditor.rect = clampCropRect({ x, y, w, h }, iw, ih);
  cropEditor.aspect = cropEditor.rect.w / Math.max(1e-6, cropEditor.rect.h);
  renderCropOverlay();
  updateCropRectInputs();
  updateCropOverlayDpiInfo();
}

function applyOverlayTransform() {
  if (!photoOverlayImage) return;
  photoOverlayImage.style.transform = `translate(${overlayView.tx}px, ${overlayView.ty}px) scale(${overlayView.scale})`;
}

function resetOverlayView() {
  overlayView.scale = 1;
  overlayView.tx = 0;
  overlayView.ty = 0;
  overlayView.dragging = false;
  overlayView.pointerId = null;
  if (photoOverlayViewport) {
    photoOverlayViewport.classList.remove('is-dragging');
  }
  applyOverlayTransform();
}

function renderCropOverlay() {
  if (!cropOverlayCanvas || !cropEditor.active) return;
  const selected = getSelectedPlacement();
  if (!selected) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cw = Math.max(1, Math.floor(cropOverlayCanvas.clientWidth));
  const ch = Math.max(1, Math.floor(cropOverlayCanvas.clientHeight));
  cropOverlayCanvas.width = Math.floor(cw * dpr);
  cropOverlayCanvas.height = Math.floor(ch * dpr);
  const c = cropOverlayCanvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  const scale = Math.min(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  cropEditor.display = { x: dx, y: dy, w: dw, h: dh };

  c.clearRect(0, 0, cw, ch);
  c.drawImage(selected.image, dx, dy, dw, dh);

  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.fillRect(0, 0, cw, ch);

  const rx = dx + (cropEditor.rect.x / iw) * dw;
  const ry = dy + (cropEditor.rect.y / ih) * dh;
  const rw = (cropEditor.rect.w / iw) * dw;
  const rh = (cropEditor.rect.h / ih) * dh;

  c.drawImage(selected.image, cropEditor.rect.x, cropEditor.rect.y, cropEditor.rect.w, cropEditor.rect.h, rx, ry, rw, rh);
  c.strokeStyle = '#77ff9d';
  c.lineWidth = 2;
  c.strokeRect(rx, ry, rw, rh);

  const handles = getHandlePoints({ x: rx, y: ry, w: rw, h: rh });
  c.fillStyle = '#f5fff8';
  c.strokeStyle = '#0d2118';
  c.lineWidth = 1.5;
  for (const pt of Object.values(handles)) {
    c.beginPath();
    c.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

function getCropTargetSizeMm() {
  const wCm = Number(cropTargetWidthCm?.value || 0);
  const hCm = Number(cropTargetHeightCm?.value || 0);
  if (wCm <= 0 || hCm <= 0) return null;
  return { widthMm: wCm * MM_PER_CM, heightMm: hCm * MM_PER_CM };
}

function getCropPlacementPixelDims(item, rect) {
  if (item.rotated) {
    return { pxWidth: rect.h, pxHeight: rect.w };
  }
  return { pxWidth: rect.w, pxHeight: rect.h };
}

function updateCropOverlayDpiInfo() {
  if (!cropOverlayDpiInfo) return;
  const selected = getSelectedPlacement();
  if (!selected || !cropEditor.active) {
    cropOverlayDpiInfo.textContent = 'DPI: -';
    return;
  }

  const target = getCropTargetSizeMm();
  if (!target) {
    cropOverlayDpiInfo.textContent = 'DPI: Bitte Zielbreite und Zielhoehe eingeben.';
    return;
  }

  const px = getCropPlacementPixelDims(selected, cropEditor.rect);
  const dpiX = px.pxWidth / (target.widthMm / MM_PER_INCH);
  const dpiY = px.pxHeight / (target.heightMm / MM_PER_INCH);
  const minDpi = Math.min(dpiX, dpiY);
  cropOverlayDpiInfo.textContent = `DPI X: ${Math.round(dpiX)} | DPI Y: ${Math.round(dpiY)} | Min: ${Math.round(minDpi)}`;
}

function getCurrentCropAspect() {
  if (cropEditor.active && cropEditor.rect.w > 0 && cropEditor.rect.h > 0) {
    return cropEditor.rect.w / Math.max(1e-6, cropEditor.rect.h);
  }
  const selected = getSelectedPlacement();
  if (selected) {
    const crop = getCropPixels(selected);
    return crop.sw / Math.max(1e-6, crop.sh);
  }
  return 1;
}

function updateCropAspectFromInputs(changedAxis = null) {
  if (!cropEditor.active) return;

  const aspect = getCurrentCropAspect(); // W/H
  const widthValue = Number(cropTargetWidthCm?.value || 0);
  const heightValue = Number(cropTargetHeightCm?.value || 0);

  if (changedAxis === 'width' && widthValue > 0 && cropTargetHeightCm) {
    cropTargetHeightCm.value = (widthValue / Math.max(1e-6, aspect)).toFixed(1);
  } else if (changedAxis === 'height' && heightValue > 0 && cropTargetWidthCm) {
    cropTargetWidthCm.value = (heightValue * aspect).toFixed(1);
  } else if (changedAxis === null) {
    if (widthValue > 0 && (!heightValue || heightValue <= 0) && cropTargetHeightCm) {
      cropTargetHeightCm.value = (widthValue / Math.max(1e-6, aspect)).toFixed(1);
    } else if (heightValue > 0 && (!widthValue || widthValue <= 0) && cropTargetWidthCm) {
      cropTargetWidthCm.value = (heightValue * aspect).toFixed(1);
    }
  }

  if (menuScaleWidthCm && cropTargetWidthCm) menuScaleWidthCm.value = cropTargetWidthCm.value;
  if (menuScaleHeightCm && cropTargetHeightCm) menuScaleHeightCm.value = cropTargetHeightCm.value;

  // Wenn Druckgrösse geändert wurde: Ratio-Inputs aus Druckgrösse setzen und Ausschnitt anpassen
  if (changedAxis !== null) {
    const newW = Number(cropTargetWidthCm?.value || 0);
    const newH = Number(cropTargetHeightCm?.value || 0);
    if (newW > 0 && newH > 0 && cropRatioH && cropRatioW) {
      const factor = 10 / Math.max(newH, newW);
      cropRatioH.value = (newH * factor).toFixed(2);
      cropRatioW.value = (newW * factor).toFixed(2);
      applyCropRatioFromInputs();
    }
  }

  updateCropOverlayDpiInfo();
}

function openCropOverlayForSelected() {
  const selected = getSelectedPlacement();
  if (!selected || !cropOverlay) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const tw = Number(menuScaleWidthCm?.value || 0) || (selected.widthMm / MM_PER_CM);
  const th = Number(menuScaleHeightCm?.value || 0) || (selected.heightMm / MM_PER_CM);

  if (cropTargetWidthCm) cropTargetWidthCm.value = tw.toFixed(1);
  if (cropTargetHeightCm) cropTargetHeightCm.value = th.toFixed(1);

  const cropPx = getCropPixels(selected);
  const rect = clampCropRect({ x: cropPx.sx, y: cropPx.sy, w: cropPx.sw, h: cropPx.sh }, cropPx.iw, cropPx.ih);

  cropEditor.active = true;
  cropEditor.aspect = rect.w / Math.max(1e-6, rect.h);
  cropEditor.rect = rect;
  cropEditor.dragging = false;
  cropEditor.dragMode = null;
  cropEditor.activeHandle = null;
  cropEditor.pointerId = null;
  cropEditor.resizeAnchor = null;

  cropOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  updateCropAspectFromInputs();
  renderCropOverlay();
  updateCropRectInputs();
  updateCropOverlayDpiInfo();
}

function closeCropOverlay() {
  cropEditor.active = false;
  cropEditor.dragging = false;
  cropEditor.dragMode = null;
  cropEditor.activeHandle = null;
  cropEditor.pointerId = null;
  cropEditor.resizeAnchor = null;
  if (cropOverlay) cropOverlay.hidden = true;
  if (photoOverlay && !photoOverlay.hidden) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

function applyCropOverlay() {
  const selected = getSelectedPlacement();
  if (!selected || !cropEditor.active) {
    closeCropOverlay();
    return;
  }

  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  const r = clampCropRect(cropEditor.rect, iw, ih);
  selected.cropNorm = {
    x: r.x / iw,
    y: r.y / ih,
    w: r.w / iw,
    h: r.h / ih
  };

  // Placement-Dimensionen so anpassen, dass kein Strecken entsteht.
  // cropAspectWH = W/H des Ausschnitts auf dem Bogen (berücksichtigt Rotation).
  const cropAspectWH = getPlacementAspectRatio(selected);
  const targetW = Number(cropTargetWidthCm?.value || 0);
  const targetH = Number(cropTargetHeightCm?.value || 0);

  if (targetW > 0 && targetH > 0) {
    // Explizite Zielgrösse übernehmen
    selected.widthMm = targetW * MM_PER_CM;
    selected.heightMm = targetH * MM_PER_CM;
  } else if (targetW > 0) {
    selected.widthMm = targetW * MM_PER_CM;
    selected.heightMm = selected.widthMm / Math.max(1e-6, cropAspectWH);
  } else if (targetH > 0) {
    selected.heightMm = targetH * MM_PER_CM;
    selected.widthMm = selected.heightMm * cropAspectWH;
  } else {
    // Keine Zielgrösse: Breite beibehalten, Höhe aus Ausschnitt-Verhältnis ableiten
    selected.heightMm = selected.widthMm / Math.max(1e-6, cropAspectWH);
  }

  closeCropOverlay();
  updateManualScaleControlsForSelected();
  drawPreview();
  setStatus('Beschnitt uebernommen.');
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

function clampCandidateToBounds(candidate, config) {
  const minX = config.padding;
  const maxX = config.rollWidth - config.padding - candidate.widthMm;
  const minY = config.padding;
  const maxY = config.maxHeight - config.padding - candidate.heightMm;

  return {
    ...candidate,
    xMm: Math.min(Math.max(candidate.xMm, minX), maxX),
    yMm: Math.min(Math.max(candidate.yMm, minY), maxY)
  };
}

function findNearestFreePlacement(candidate, pagePlacements, config, ignoreId = null, options = {}) {
  const stepMm = Math.max(1, Number(options.stepMm) || Number(moveStepInput.value) || 2);
  const maxRadiusMm = Math.max(stepMm, Number(options.maxRadiusMm) || 120);
  const angleSamples = Math.max(8, Number(options.angleSamples) || 16);

  const base = clampCandidateToBounds(candidate, config);
  if (canPlaceCandidate(base, pagePlacements, config, ignoreId)) {
    return base;
  }

  for (let radius = stepMm; radius <= maxRadiusMm + 1e-6; radius += stepMm) {
    for (let i = 0; i < angleSamples; i++) {
      const angle = (Math.PI * 2 * i) / angleSamples;
      const test = clampCandidateToBounds(
        {
          ...candidate,
          xMm: base.xMm + Math.cos(angle) * radius,
          yMm: base.yMm + Math.sin(angle) * radius
        },
        config
      );
      if (canPlaceCandidate(test, pagePlacements, config, ignoreId)) {
        return test;
      }
    }
  }

  return null;
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

function updatePhotoCardSelection() {
  const cards = tableBody.querySelectorAll('.photo-card');
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) return;
    const id = card.dataset.photoId || '';
    card.classList.toggle('is-selected', id === state.selectedId);
  });
}

function createPhotoCardElement(item, index) {
  const card = document.createElement('div');
  card.className = `photo-card${item.id === state.selectedId ? ' is-selected' : ''}`;
  card.dataset.photoId = item.id;
  card.draggable = true;
  card.style.position = 'absolute';
  card.style.left = '0';
  card.style.right = '0';
  card.style.top = `${index * PHOTO_CARD_ROW_HEIGHT}px`;

  card.innerHTML = `
    <input class="photo-card-select" type="checkbox" aria-label="${item.name} auswaehlen" ${item.isChecked ? 'checked' : ''} />
    <img class="photo-card-thumb" src="${item.thumbSrc}" alt="Vorschau ${item.name}" loading="lazy" decoding="async" />
    <div class="photo-card-lines">
      <div class="photo-line-1">${item.name}</div>
      <div class="photo-line-2">${item.pixelWidth}x${item.pixelHeight} px | ${item.widthCm.toFixed(1)} x ${item.heightCm.toFixed(1)} cm</div>
      <div class="photo-line-3">Auf Seite ${item.onPage || '-'}</div>
    </div>
  `;

  const checkbox = card.querySelector('.photo-card-select');
  if (checkbox instanceof HTMLInputElement) {
    checkbox.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.listSelection.add(item.id);
      } else {
        state.listSelection.delete(item.id);
      }
      updateSelectionActionButtons();
    });
  }

  card.addEventListener('click', () => {
    selectPlacementById(item.id);
    openPhotoOverlay(item);
  });

  card.addEventListener('dragstart', (event) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('text/photo-id', item.id);
    event.dataTransfer.effectAllowed = 'move';
  });

  return card;
}

function renderVirtualizedPhotoCards() {
  if (!tableBody) return;

  const items = virtualPhotoList.items;
  const total = items.length;
  const viewportHeight = tableBody.clientHeight || 0;
  const scrollTop = tableBody.scrollTop || 0;

  const start = Math.max(0, Math.floor(scrollTop / PHOTO_CARD_ROW_HEIGHT) - PHOTO_CARD_OVERSCAN);
  const visibleCount = Math.ceil((viewportHeight || 1) / PHOTO_CARD_ROW_HEIGHT) + PHOTO_CARD_OVERSCAN * 2;
  const end = Math.min(total, start + Math.max(1, visibleCount));

  tableBody.innerHTML = '';
  const spacer = document.createElement('div');
  spacer.className = 'photo-card-spacer';
  spacer.style.height = `${total * PHOTO_CARD_ROW_HEIGHT}px`;
  tableBody.appendChild(spacer);

  const fragment = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    fragment.appendChild(createPhotoCardElement(items[i], i));
  }
  spacer.appendChild(fragment);
}

function ensureVirtualizedListInitialized() {
  if (virtualListInitialized || !tableBody) return;
  tableBody.addEventListener('scroll', () => {
    renderVirtualizedPhotoCards();
  });
  window.addEventListener('resize', () => {
    renderVirtualizedPhotoCards();
  });
  virtualListInitialized = true;
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
      const crop = getCropPixels(item);
      if (item.rotated) {
        ctx.save();
        ctx.translate(x, y + h);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, h, w);
        ctx.restore();
      } else {
        ctx.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, x, y, w, h);
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
  ensureVirtualizedListInitialized();
  const placementMap = getPlacementMap();
  const existingIds = new Set(state.photos.map((photo) => photo.id));
  for (const id of Array.from(state.listSelection)) {
    if (!existingIds.has(id)) {
      state.listSelection.delete(id);
    }
  }

  virtualPhotoList.items = state.photos.map((photo) => ({
    ...photo,
    onPage: placementMap.get(photo.id) || null,
    widthCm: photo.originalWidthMm / 10,
    heightCm: photo.originalHeightMm / 10,
    thumbSrc: photo.thumbnailDataUrl || photo.dataUrl,
    isChecked: state.listSelection.has(photo.id)
  }));

  updateSelectionActionButtons();
  renderVirtualizedPhotoCards();
}

function openPhotoOverlay(photo) {
  if (!photoOverlay || !photoOverlayImage || !photo) return;
  photoOverlayImage.src = photo.dataUrl || '';
  photoOverlayImage.draggable = false;
  resetOverlayView();
  if (photoOverlayCaption) {
    photoOverlayCaption.textContent = `${photo.name} - ${photo.pixelWidth} x ${photo.pixelHeight}px - Mausrad: Zoom, Ziehen: Verschieben`;
  }
  photoOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function buildThumbnailDataUrl(image, maxSide = 96) {
  const srcW = Math.max(1, image.naturalWidth || image.width || 1);
  const srcH = Math.max(1, image.naturalHeight || image.height || 1);
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  c.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.78);
}

function closePhotoOverlay() {
  if (!photoOverlay || !photoOverlayImage) return;
  photoOverlay.hidden = true;
  photoOverlayImage.src = '';
  resetOverlayView();
  document.body.style.overflow = '';
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

function buildPlacementImageDataUrl(item) {
  const crop = getCropPixels(item);
  if (!item.rotated) {
    const cw = Math.max(1, Math.round(crop.sw));
    const ch = Math.max(1, Math.round(crop.sh));
    const off = document.createElement('canvas');
    off.width = cw;
    off.height = ch;
    const c = off.getContext('2d');
    c.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cw, ch);
    return off.toDataURL('image/png');
  }

  const cw = Math.max(1, Math.round(crop.sh));
  const ch = Math.max(1, Math.round(crop.sw));
  const off = document.createElement('canvas');
  off.width = cw;
  off.height = ch;
  const c = off.getContext('2d');
  c.translate(cw, 0);
  c.rotate(Math.PI / 2);
  c.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
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
        const source = buildPlacementImageDataUrl(item);
        const format = getImageFormatFromDataUrl(source);
        pdf.addImage(source, format, item.xMm, item.yMm, item.widthMm, item.heightMm, undefined, 'NONE');
      }

      if (!includePhotos) {
        pdf.setDrawColor(0, 255, 0);
        pdf.setLineWidth(0.25 * MM_PER_POINT);
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
        dataUrl,
        thumbnailDataUrl: buildThumbnailDataUrl(image),
        cropNorm: { x: 0, y: 0, w: 1, h: 1 }
      });
    } catch {
      skipped += 1;
    }
  }

  if (loaded.length === 0) {
    state.photos = [];
    state.pages = [];
    state.listSelection.clear();
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
  state.listSelection.clear();
  state.selectedId = null;
  state.currentPage = 0;
  selectedItemInput.value = 'Keins';
  hideManualMenu();
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
  state.listSelection.clear();
  state.currentPage = 0;
  state.selectedId = null;
  selectedItemInput.value = 'Keins';
  hideManualMenu();

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
  const photo = getPhotoById(id);
  selectedItemInput.value = item ? item.name : (photo ? photo.name : 'Keins');
  updateManualScaleControlsForSelected();
  if (!id) hideManualMenu();
  updatePhotoCardSelection();
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

  const snapped = findNearestFreePlacement(candidate, page, config, selected.id, {
    maxRadiusMm: Math.max(120, Number(moveStepInput.value || 0) * 20),
    angleSamples: 20
  });
  if (!snapped) {
    setStatus('Verschieben nicht moeglich (Kollision oder ausserhalb des Bogens).');
    return;
  }

  selected.xMm = snapped.xMm;
  selected.yMm = snapped.yMm;
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
  const centerX = selected.xMm + selected.widthMm / 2;
  const centerY = selected.yMm + selected.heightMm / 2;
  const candidate = {
    ...selected,
    xMm: centerX - selected.heightMm / 2,
    yMm: centerY - selected.widthMm / 2,
    widthMm: selected.heightMm,
    heightMm: selected.widthMm,
    rotated: !selected.rotated
  };

  const snapped = findNearestFreePlacement(candidate, page, config, selected.id, {
    maxRadiusMm: Math.max(selected.widthMm, selected.heightMm) + 160,
    angleSamples: 24
  });
  if (!snapped) {
    setStatus('Rotation nicht moeglich (Kollision oder ausserhalb des Bogens).');
    return;
  }

  selected.xMm = snapped.xMm;
  selected.yMm = snapped.yMm;
  selected.widthMm = snapped.widthMm;
  selected.heightMm = snapped.heightMm;
  selected.rotated = snapped.rotated;
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
      dataUrl: photo.dataUrl,
      cropNorm: photo.cropNorm || { x: 0, y: 0, w: 1, h: 1 }
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
      image,
      thumbnailDataUrl: buildThumbnailDataUrl(image),
      cropNorm: p.cropNorm || { x: 0, y: 0, w: 1, h: 1 }
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
  state.listSelection.clear();
  state.currentPage = Math.min(Math.max(0, project.currentPage || 0), Math.max(0, pages.length - 1));
  state.selectedId = null;
  selectedItemInput.value = 'Keins';
  hideManualMenu();

  renderTable();
  drawPreview();
  setStatus(`Projekt geladen: ${photos.length} Motive, ${pages.length} Seiten.`);
}

function clearAll() {
  state.photos = [];
  state.pages = [];
  state.listSelection.clear();
  state.selectedId = null;
  state.currentPage = 0;
  selectedItemInput.value = 'Keins';
  hideManualMenu();
  photoInput.value = '';
  projectLoadInput.value = '';
  renderTable();
  drawPreview();
  setStatus('Job geleert.');
}

function goToPage(index) {
  if (state.pages.length === 0) {
    state.currentPage = 0;
    hideManualMenu();
    drawPreview();
    return;
  }

  state.currentPage = Math.min(Math.max(0, index), state.pages.length - 1);
  state.selectedId = null;
  selectedItemInput.value = 'Keins';
  hideManualMenu();
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
  suppressCanvasClick = state.drag.moved;
  state.drag.active = false;
  state.drag.id = null;
  state.drag.offsetXmm = 0;
  state.drag.offsetYmm = 0;
  state.drag.moved = false;
  state.drag.startClientX = 0;
  state.drag.startClientY = 0;
}

function hideManualMenu() {
  if (manualNestingMenu) {
    manualNestingMenu.hidden = true;
  }
}

function showManualMenuAtCanvasEvent(event) {
  if (!manualNestingMenu) return;

  const canvasRect = previewCanvas.getBoundingClientRect();
  const parent = manualNestingMenu.offsetParent instanceof HTMLElement
    ? manualNestingMenu.offsetParent
    : previewCanvas.parentElement;
  if (!parent) return;

  const parentRect = parent.getBoundingClientRect();
  let left = event.clientX - parentRect.left + 10;
  let top = event.clientY - parentRect.top + 10;

  manualNestingMenu.hidden = false;
  const menuWidth = manualNestingMenu.offsetWidth;
  const menuHeight = manualNestingMenu.offsetHeight;

  const minLeft = canvasRect.left - parentRect.left + 8;
  const maxLeft = canvasRect.right - parentRect.left - menuWidth - 8;
  const minTop = canvasRect.top - parentRect.top + 8;
  const maxTop = canvasRect.bottom - parentRect.top - menuHeight - 8;

  left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));
  top = Math.min(Math.max(top, minTop), Math.max(minTop, maxTop));

  manualNestingMenu.style.left = `${left}px`;
  manualNestingMenu.style.top = `${top}px`;
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

if (nestPageBtn) {
  nestPageBtn.addEventListener('click', () => nestCurrentPage());
}

if (placeSelectionBtn) {
  placeSelectionBtn.addEventListener('click', () => placeListSelectionOnCurrentPage());
}

if (deleteSelectionBtn) {
  deleteSelectionBtn.addEventListener('click', () => deleteListSelection());
}

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
  if (suppressCanvasClick) {
    suppressCanvasClick = false;
    return;
  }

  const page = getCurrentPagePlacements();
  if (page.length === 0) {
    selectPlacementById(null);
    hideManualMenu();
    return;
  }

  const config = getConfig();
  const { px, py } = canvasEventToMm(event, config);
  const item = findItemAtCanvasPoint(px, py, page, config);
  if (item) {
    selectPlacementById(item.id);
    showManualMenuAtCanvasEvent(event);
    return;
  }

  selectPlacementById(null);
  hideManualMenu();
});

previewCanvas.addEventListener('mousedown', (event) => {
  const page = getCurrentPagePlacements();
  if (page.length === 0) return;

  const config = getConfig();
  const { px, py, xMm, yMm } = canvasEventToMm(event, config);
  const item = findItemAtCanvasPoint(px, py, page, config);
  if (!item) return;

  hideManualMenu();
  selectPlacementById(item.id);
  state.drag.active = true;
  state.drag.id = item.id;
  state.drag.offsetXmm = xMm - item.xMm;
  state.drag.offsetYmm = yMm - item.yMm;
  state.drag.moved = false;
  state.drag.startClientX = event.clientX;
  state.drag.startClientY = event.clientY;
});

previewCanvas.addEventListener('mousemove', (event) => {
  if (!state.drag.active || !state.drag.id) return;

  if (!state.drag.moved) {
    const dx = event.clientX - state.drag.startClientX;
    const dy = event.clientY - state.drag.startClientY;
    if (Math.hypot(dx, dy) >= 3) {
      state.drag.moved = true;
    }
  }

  const page = getCurrentPagePlacements();
  const selected = page.find((item) => item.id === state.drag.id);
  if (!selected) {
    stopDrag();
    return;
  }

  const config = getConfig();
  const { xMm, yMm } = canvasEventToMm(event, config);
  const candidate = { ...selected, xMm: xMm - state.drag.offsetXmm, yMm: yMm - state.drag.offsetYmm };
  const snapped = findNearestFreePlacement(candidate, page, config, selected.id, {
    maxRadiusMm: 60,
    angleSamples: 16
  });
  if (!snapped) {
    return;
  }

  selected.xMm = snapped.xMm;
  selected.yMm = snapped.yMm;
  drawPreview();
});

previewCanvas.addEventListener('mouseup', stopDrag);
previewCanvas.addEventListener('mouseleave', stopDrag);

previewCanvas.addEventListener('dragover', (event) => {
  const id = event.dataTransfer?.getData('text/photo-id');
  if (!id) return;
  event.preventDefault();
  previewCanvas.classList.add('drop-active');
});

previewCanvas.addEventListener('dragleave', () => {
  previewCanvas.classList.remove('drop-active');
});

previewCanvas.addEventListener('drop', (event) => {
  const id = event.dataTransfer?.getData('text/photo-id');
  previewCanvas.classList.remove('drop-active');
  if (!id) return;
  event.preventDefault();

  const config = getConfig();
  const { xMm, yMm } = canvasEventToMm(event, config);
  const placed = placePhotoOnCurrentPageAt(id, xMm, yMm);
  if (!placed) {
    setStatus('Drop nicht moeglich: keine freie Position auf dem Bogen gefunden.');
    return;
  }

  selectPlacementById(id);
  renderTable();
  drawPreview();
  const photo = getPhotoById(id);
  setStatus(`${photo?.name || 'Motiv'} auf dem Bogen platziert.`);
});

if (menuRotateBtn) {
  menuRotateBtn.addEventListener('click', () => rotateSelected());
}

if (menuUnplaceBtn) {
  menuUnplaceBtn.addEventListener('click', () => unplaceSelected());
}

if (menuLeftBtn) {
  menuLeftBtn.addEventListener('click', () => moveSelected(-Number(moveStepInput.value || 0), 0));
}

if (menuRightBtn) {
  menuRightBtn.addEventListener('click', () => moveSelected(Number(moveStepInput.value || 0), 0));
}

if (menuUpBtn) {
  menuUpBtn.addEventListener('click', () => moveSelected(0, -Number(moveStepInput.value || 0)));
}

if (menuDownBtn) {
  menuDownBtn.addEventListener('click', () => moveSelected(0, Number(moveStepInput.value || 0)));
}

if (menuShowImageBtn) {
  menuShowImageBtn.addEventListener('click', () => {
    const selected = getSelectedPlacement();
    if (selected) openPhotoOverlay(selected);
  });
}

if (menuCropBtn) {
  menuCropBtn.addEventListener('click', () => openCropOverlayForSelected());
}

if (menuApplyScaleBtn) {
  menuApplyScaleBtn.addEventListener('click', () => applyScaleToSelected());
}

if (menuScaleWidthCm) {
  menuScaleWidthCm.addEventListener('input', () => {
    manualScaleLastEdited = 'width';
    syncScaleInputsByRatio('width');
  });
}

if (menuScaleHeightCm) {
  menuScaleHeightCm.addEventListener('input', () => {
    manualScaleLastEdited = 'height';
    syncScaleInputsByRatio('height');
  });
}

if (photoOverlayCloseBtn) {
  photoOverlayCloseBtn.addEventListener('click', closePhotoOverlay);
}

if (photoOverlay) {
  photoOverlay.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeOverlay === 'true') {
      closePhotoOverlay();
    }
  });
}

if (photoOverlayViewport) {
  photoOverlayViewport.addEventListener('pointerdown', (event) => {
    if (photoOverlay.hidden) return;
    if (event.button !== 0) return;
    event.preventDefault();
    overlayView.dragging = true;
    overlayView.pointerId = event.pointerId;
    overlayView.startX = event.clientX;
    overlayView.startY = event.clientY;
    overlayView.startTx = overlayView.tx;
    overlayView.startTy = overlayView.ty;
    photoOverlayViewport.classList.add('is-dragging');
    if (typeof photoOverlayViewport.setPointerCapture === 'function') {
      try {
        photoOverlayViewport.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture errors; dragging still works without capture.
      }
    }
  });

  photoOverlayViewport.addEventListener('pointermove', (event) => {
    if (!overlayView.dragging || overlayView.pointerId !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - overlayView.startX;
    const dy = event.clientY - overlayView.startY;
    overlayView.tx = overlayView.startTx + dx;
    overlayView.ty = overlayView.startTy + dy;
    applyOverlayTransform();
  });

  const endOverlayDrag = (event) => {
    if (overlayView.pointerId !== event.pointerId) return;
    overlayView.dragging = false;
    overlayView.pointerId = null;
    photoOverlayViewport.classList.remove('is-dragging');
  };

  photoOverlayViewport.addEventListener('pointerup', endOverlayDrag);
  photoOverlayViewport.addEventListener('pointercancel', endOverlayDrag);

  photoOverlayViewport.addEventListener('wheel', (event) => {
    if (photoOverlay.hidden) return;
    event.preventDefault();
    const step = event.deltaY < 0 ? 0.12 : -0.12;
    const nextScale = Math.min(6, Math.max(1, overlayView.scale + step));
    if (Math.abs(nextScale - overlayView.scale) < 1e-6) return;
    overlayView.scale = nextScale;
    applyOverlayTransform();
  }, { passive: false });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (cropOverlay && !cropOverlay.hidden) {
      closeCropOverlay();
      return;
    }
    closePhotoOverlay();
  }
});

if (cropOverlayCanvas) {
  cropOverlayCanvas.addEventListener('pointerdown', (event) => {
    if (!cropEditor.active) return;
    if (event.button !== 0) return;
    const selected = getSelectedPlacement();
    if (!selected) return;
    event.preventDefault();
    const rect = cropOverlayCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rectCanvas = getCropRectCanvas(selected);
    const handle = getHandleAtCanvasPoint(selected, x, y);

    if (handle) {
      cropEditor.dragging = true;
      cropEditor.dragMode = 'resize';
      cropEditor.activeHandle = handle;
      cropEditor.pointerId = event.pointerId;
      cropEditor.resizeAnchor = getResizeAnchorForHandle(handle, cropEditor.rect);
      cropOverlayCanvas.setPointerCapture(event.pointerId);
      return;
    }

    const rx = rectCanvas.x;
    const ry = rectCanvas.y;
    const rw = rectCanvas.w;
    const rh = rectCanvas.h;
    if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
      cropEditor.dragging = true;
      cropEditor.dragMode = 'move';
      cropEditor.activeHandle = null;
      cropEditor.pointerId = event.pointerId;
      cropEditor.dragOffsetX = x - rx;
      cropEditor.dragOffsetY = y - ry;
      cropOverlayCanvas.setPointerCapture(event.pointerId);
    }
  });

  cropOverlayCanvas.addEventListener('pointermove', (event) => {
    if (!cropEditor.active) return;
    const selected = getSelectedPlacement();
    if (!selected) return;

    const rect = cropOverlayCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (!cropEditor.dragging || cropEditor.pointerId !== event.pointerId) {
      const handle = getHandleAtCanvasPoint(selected, x, y);
      if (handle === 'nw' || handle === 'se') {
        cropOverlayCanvas.style.cursor = 'nwse-resize';
      } else if (handle === 'ne' || handle === 'sw') {
        cropOverlayCanvas.style.cursor = 'nesw-resize';
      } else {
        const rcv = getCropRectCanvas(selected);
        const inside = x >= rcv.x && x <= rcv.x + rcv.w && y >= rcv.y && y <= rcv.y + rcv.h;
        cropOverlayCanvas.style.cursor = inside ? 'move' : 'grab';
      }
      return;
    }

    event.preventDefault();
    const d = cropEditor.display;
    const iw = selected.image.naturalWidth;
    const ih = selected.image.naturalHeight;

    if (cropEditor.dragMode === 'resize' && cropEditor.activeHandle && cropEditor.resizeAnchor) {
      const pointerPx = canvasToImagePoint(selected, x, y);
      cropEditor.rect = buildRectFromHandleDrag(
        cropEditor.activeHandle,
        cropEditor.resizeAnchor,
        pointerPx,
        iw,
        ih
      );
    } else if (cropEditor.dragMode === 'move') {
      const nx = ((x - cropEditor.dragOffsetX - d.x) / d.w) * iw;
      const ny = ((y - cropEditor.dragOffsetY - d.y) / d.h) * ih;
      cropEditor.rect = clampCropRect({ ...cropEditor.rect, x: nx, y: ny }, iw, ih);
    }

    cropEditor.aspect = cropEditor.rect.w / Math.max(1e-6, cropEditor.rect.h);

    renderCropOverlay();
    updateCropRectInputs();
    updateCropOverlayDpiInfo();
  });

  cropOverlayCanvas.addEventListener('pointerup', (event) => {
    if (cropEditor.pointerId !== event.pointerId) return;
    cropEditor.dragging = false;
    cropEditor.dragMode = null;
    cropEditor.activeHandle = null;
    cropEditor.pointerId = null;
    cropEditor.resizeAnchor = null;
  });
  cropOverlayCanvas.addEventListener('pointercancel', (event) => {
    if (cropEditor.pointerId !== event.pointerId) return;
    cropEditor.dragging = false;
    cropEditor.dragMode = null;
    cropEditor.activeHandle = null;
    cropEditor.pointerId = null;
    cropEditor.resizeAnchor = null;
  });

  cropOverlayCanvas.addEventListener('wheel', (event) => {
    if (!cropEditor.active) return;
    event.preventDefault();
    const selected = getSelectedPlacement();
    if (!selected) return;
    const factor = event.deltaY < 0 ? 0.94 : 1.06;
    const r = cropEditor.rect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    let nw = Math.max(24, Math.min(selected.image.naturalWidth, r.w * factor));
    let nh = Math.max(24, Math.min(selected.image.naturalHeight, r.h * factor));
    cropEditor.rect = clampCropRect({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }, selected.image.naturalWidth, selected.image.naturalHeight);
    cropEditor.aspect = cropEditor.rect.w / Math.max(1e-6, cropEditor.rect.h);
    renderCropOverlay();
    updateCropRectInputs();
    updateCropOverlayDpiInfo();
  }, { passive: false });
}

if (cropTargetWidthCm) {
  cropTargetWidthCm.addEventListener('input', () => {
    updateCropAspectFromInputs('width');
    updateCropRectInputs();
  });
}

if (cropTargetHeightCm) {
  cropTargetHeightCm.addEventListener('input', () => {
    updateCropAspectFromInputs('height');
    updateCropRectInputs();
  });
}

if (cropRectXPercent) {
  cropRectXPercent.addEventListener('input', () => applyCropRectInputs('x'));
}

if (cropRectYPercent) {
  cropRectYPercent.addEventListener('input', () => applyCropRectInputs('y'));
}

if (cropRectWPercent) {
  cropRectWPercent.addEventListener('input', () => applyCropRectInputs('w'));
}

if (cropRectHPercent) {
  cropRectHPercent.addEventListener('input', () => applyCropRectInputs('h'));
}

if (cropRatioH) {
  cropRatioH.addEventListener('input', () => applyCropRatioFromInputs());
}

if (cropRatioW) {
  cropRatioW.addEventListener('input', () => applyCropRatioFromInputs());
}

if (cropOverlayApplyBtn) {
  cropOverlayApplyBtn.addEventListener('click', () => applyCropOverlay());
}

if (cropOverlayCancelBtn) {
  cropOverlayCancelBtn.addEventListener('click', () => closeCropOverlay());
}

if (cropOverlay) {
  cropOverlay.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeCropOverlay === 'true') {
      closeCropOverlay();
    }
  });
}

closePhotoOverlay();

rotateBtn.addEventListener('click', rotateSelected);
unplaceBtn.addEventListener('click', unplaceSelected);
moveLeftBtn.addEventListener('click', () => moveSelected(-Number(moveStepInput.value || 0), 0));
moveRightBtn.addEventListener('click', () => moveSelected(Number(moveStepInput.value || 0), 0));
moveUpBtn.addEventListener('click', () => moveSelected(0, -Number(moveStepInput.value || 0)));
moveDownBtn.addEventListener('click', () => moveSelected(0, Number(moveStepInput.value || 0)));

renderTable();
drawPreview();
