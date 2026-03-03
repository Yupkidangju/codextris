/*
 * [v3.19.0] 모바일 독립 웹앱 렌더 보조기
 *
 * 변경사항:
 *   - 모바일 앱이 데스크톱 main.js 없이도 자체 캔버스 크기와 프리뷰 렌더를 관리한다.
 *   - 플레이어/AI 보드 캔버스는 컨테이너 크기를 읽어 리사이즈한다.
 *   - HOLD/NEXT 프리뷰는 모바일 전용 단순 셀 렌더 프리셋으로 그린다.
 */

import { PIECES } from "../game/core/pieces.js";

function resizeCanvas(canvas, cols, rows, cellSize) {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = cols * cellSize;
  const height = rows * cellSize;

  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }
}

function parseHexColor(color) {
  const hex = String(color || "#999999").replace("#", "");
  const normalized = hex.length === 3
    ? hex.split("").map((char) => char + char).join("")
    : hex.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(normalized, 16) || 0;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function alpha(color, opacity) {
  const rgb = parseHexColor(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function mix(color, target, amount) {
  const base = parseHexColor(color);
  const dst = parseHexColor(target);
  const t = Math.max(0, Math.min(1, amount));
  const r = Math.round(base.r + (dst.r - base.r) * t);
  const g = Math.round(base.g + (dst.g - base.g) * t);
  const b = Math.round(base.b + (dst.b - base.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawMobileCell(ctx, x, y, size, color) {
  const inset = Math.max(1.5, size * 0.08);
  const innerX = x + inset;
  const innerY = y + inset;
  const innerSize = Math.max(2, size - inset * 2);
  const radius = Math.max(4, size * 0.16);
  const base = color || "#45c3ff";

  ctx.save();

  const glow = ctx.createRadialGradient(
    x + size * 0.5,
    y + size * 0.36,
    size * 0.12,
    x + size * 0.5,
    y + size * 0.5,
    size * 0.7,
  );
  glow.addColorStop(0, alpha(base, 0.38));
  glow.addColorStop(1, alpha(base, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - size * 0.18, y - size * 0.18, size * 1.36, size * 1.36);

  roundedRect(ctx, innerX, innerY, innerSize, innerSize, radius);
  const fill = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerSize);
  fill.addColorStop(0, mix(base, "#ffffff", 0.16));
  fill.addColorStop(0.58, base);
  fill.addColorStop(1, mix(base, "#08131e", 0.34));
  ctx.fillStyle = fill;
  ctx.fill();

  roundedRect(ctx, innerX, innerY, innerSize, innerSize, radius);
  ctx.strokeStyle = alpha(mix(base, "#ffffff", 0.24), 0.85);
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.stroke();

  roundedRect(
    ctx,
    innerX + innerSize * 0.14,
    innerY + innerSize * 0.12,
    innerSize * 0.72,
    innerSize * 0.24,
    Math.max(2, size * 0.09),
  );
  ctx.fillStyle = alpha("#ffffff", 0.13);
  ctx.fill();

  ctx.restore();
}

function drawPiecePreview(canvas, pieceKey) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssWidth = parseFloat(canvas.style.width || "0") || canvas.width / dpr;
  const cssHeight = parseFloat(canvas.style.height || "0") || canvas.height / dpr;

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (!pieceKey || !PIECES[pieceKey]) return;

  const shape = PIECES[pieceKey].r[0];
  const rows = shape.length;
  const cols = shape[0].length;
  const cellSize = Math.floor(Math.min(cssWidth / (cols + 1), cssHeight / (rows + 1)));
  const pieceWidth = cols * cellSize;
  const pieceHeight = rows * cellSize;
  const offsetX = Math.floor((cssWidth - pieceWidth) / 2);
  const offsetY = Math.floor((cssHeight - pieceHeight) / 2);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!shape[y][x]) continue;
      drawMobileCell(
        ctx,
        offsetX + x * cellSize,
        offsetY + y * cellSize,
        cellSize,
        PIECES[pieceKey].color,
      );
    }
  }
}

export function createMobileCanvasManager(config) {
  const {
    playerCanvas,
    aiCanvas,
    holdCanvas,
    nextCanvases = [],
  } = config;

  let observer = null;

  function getPlayerBoardWrap() {
    return document.querySelector(".player-lane .board-wrap");
  }

  function getAiBoardWrap() {
    return document.querySelector(".ai-lane .board-wrap");
  }

  function getPlayerCellSize() {
    const boardWrap = getPlayerBoardWrap();
    if (!boardWrap) return 18;
    const h = Math.floor(boardWrap.clientHeight / 20);
    const w = Math.floor(boardWrap.clientWidth / 10);
    return Math.max(12, Math.min(h || 999, w || 999, 28));
  }

  function resizeAll() {
    const playerCellSize = getPlayerCellSize();
    const aiCellSize = Math.max(5, Math.floor(playerCellSize * 0.4));
    const previewCellSize = Math.max(14, Math.min(24, Math.floor(playerCellSize * 0.9)));

    resizeCanvas(playerCanvas, 10, 20, playerCellSize);
    resizeCanvas(aiCanvas, 10, 20, aiCellSize);
    resizeCanvas(holdCanvas, 4, 4, previewCellSize);
    nextCanvases.forEach((canvas) => resizeCanvas(canvas, 4, 3, previewCellSize));
  }

  function renderPreviews(playerState) {
    drawPiecePreview(holdCanvas, playerState?.hold || null);
    nextCanvases.forEach((canvas, index) => {
      drawPiecePreview(canvas, playerState?.queue?.[index] || null);
    });
  }

  function attach() {
    resizeAll();

    if (observer) {
      observer.disconnect();
    }

    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(() => {
        resizeAll();
        window.requestAnimationFrame(() => renderPreviews(config.getPlayerState?.() || null));
      });
      const playerWrap = getPlayerBoardWrap();
      const aiWrap = getAiBoardWrap();
      if (playerWrap) observer.observe(playerWrap);
      if (aiWrap) observer.observe(aiWrap);
    } else {
      window.addEventListener("resize", resizeAll);
    }
  }

  return {
    attach,
    resizeAll,
    renderPreviews,
    getPlayerCellSize,
  };
}
