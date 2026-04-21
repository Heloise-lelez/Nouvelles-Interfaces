// chop.js — gestion de découpe, avec chocolat en grille sur la planche
const LINES_NEEDED = 3;
const PROXIMITY_THRESH = 0.07;
const FOLLOW_FRAMES = 16;
const IDLE_RESET_MS = 1800;

// ── État ──────────────────────────────────────────────────────────────────────
let isActive = false;
let completeCbs = [];
let linesCompleted = 0;
let framesOnLine = 0;
let currentLineIdx = 0;
let idleTimer = null;
let lines = [];
let chocolateIsCut = false;

// ── Chocolat DOM ──────────────────────────────────────────────────────────────
const COLS = 4;
const ROWS = 3;

function getChocolateBlock() {
  return document.getElementById("chocolate-block");
}

function getChocGrid() {
  return document.querySelector(".choc-grid");
}

/** Construit les carrés dans la grille */
function buildChocSquares() {
  const grid = getChocGrid();
  if (!grid) return;
  grid.innerHTML = "";
  for (let i = 0; i < COLS * ROWS; i++) {
    const sq = document.createElement("div");
    sq.className = "choc-square";
    sq.dataset.idx = i;
    grid.appendChild(sq);
  }
}

/** Affiche le bloc de chocolat sur la planche */
export function showChocolateOnBoard() {
  buildChocSquares();
  const block = getChocolateBlock();
  if (block) {
    block.classList.remove("hidden");
    block.classList.add("visible");
  }
}

/** Cache / reset le chocolat */
export function hideChocolateOnBoard() {
  const block = getChocolateBlock();
  if (block) {
    block.classList.remove("visible");
    block.classList.add("hidden");
  }
  const grid = getChocGrid();
  if (grid) {
    grid
      .querySelectorAll(".choc-square")
      .forEach((sq) => sq.classList.remove("cut"));
  }
  // Cacher et vider les pièces de chocolat découpées
  const piecesWrap = document.getElementById("chocolate-pieces");
  if (piecesWrap) {
    piecesWrap.innerHTML = "";
    piecesWrap.classList.add("hidden");
  }
}

/**
 * Fait "tomber" les carrés de la colonne `col` (0-indexed)
 * pour simuler une coupe après validation d'un trait.
 */
function cutColumn(col) {
  const grid = getChocGrid();
  if (!grid) return;
  for (let row = 0; row < ROWS; row++) {
    const idx = row * COLS + col;
    const sq = grid.querySelector(`[data-idx="${idx}"]`);
    if (sq) {
      setTimeout(() => sq.classList.add("cut"), row * 60);
    }
  }
}

// ── Génération des traits de coupe ───────────────────────────────────────────
// On génère LINES_NEEDED traits verticaux sur la planche
// (coordonnées normalisées 0..1)
// La planche fait ~200px de large sur un écran ~1000px => ~20% de largeur
// On cible la zone centrale de la planche

function getBoardNormBounds() {
  const board = document.getElementById("cutting-board");
  if (!board) return { x: 0.3, y: 0.25, w: 0.18, h: 0.5 };
  const rect = board.getBoundingClientRect();
  return {
    x: rect.left / window.innerWidth,
    y: rect.top / window.innerHeight,
    w: rect.width / window.innerWidth,
    h: rect.height / window.innerHeight,
  };
}

function generateLines() {
  lines = [];
  const b = getBoardNormBounds();

  // On place LINES_NEEDED traits verticaux répartis sur la largeur du chocolat
  // Le chocolat fait ~96px (4×22+3×2+8) centré dans la planche de 200px
  // → offset horizontal ~ (200-96)/2 = 52px
  const chocOffsetX = 52 / window.innerWidth;
  const chocWidth = 96 / window.innerWidth;
  const segW = chocWidth / (LINES_NEEDED + 1);

  for (let i = 0; i < LINES_NEEDED; i++) {
    const x = b.x + chocOffsetX + segW * (i + 1);
    // Trait vertical du haut au bas du chocolat
    const yTop = b.y + b.h * 0.25;
    const yBottom = b.y + b.h * 0.75;
    lines.push({
      x1: x,
      y1: yTop,
      x2: x,
      y2: yBottom,
      progress: 0,
      done: false,
    });
  }
}

// ── Canvas de superposition ───────────────────────────────────────────────────
let canvas, ctx;

function initCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.id = "chop-canvas";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "50",
    display: "none",
  });
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);
}

// ── API publique ──────────────────────────────────────────────────────────────
export function setChopActive(active) {
  isActive = active;

  // Highlight visuel de la planche
  const cbc = document.getElementById("cutting-board-container");
  if (cbc) cbc.classList.toggle("chop-active", active);

  if (canvas) canvas.style.display = active ? "block" : "none";
  if (active) {
    generateLines(); // recalcule les traits selon la position réelle du DOM
    renderFrame();
  }
}

export function onChopComplete(cb) {
  completeCbs.push(cb);
}

export function resetChop() {
  linesCompleted = 0;
  framesOnLine = 0;
  currentLineIdx = 0;
  clearTimeout(idleTimer);
  generateLines();
  initCanvas();
  if (canvas) canvas.style.display = isActive ? "block" : "none";
  renderFrame();
}

// ── Logique principale ────────────────────────────────────────────────────────
export function processChop(hand) {
  if (!isActive) return;
  if (linesCompleted >= LINES_NEEDED) return;

  const line = lines[currentLineIdx];
  if (!line || line.done) return;

  const hx = hand.x;
  const hy = hand.y;
  const dist = distToSegment(hx, hy, line.x1, line.y1, line.x2, line.y2);

  if (dist < PROXIMITY_THRESH) {
    framesOnLine++;
    clearTimeout(idleTimer);

    const proj = projectOnSegment(hx, hy, line.x1, line.y1, line.x2, line.y2);
    line.progress = Math.max(line.progress, proj);

    if (framesOnLine >= FOLLOW_FRAMES && line.progress > 0.85) {
      validateLine();
    }
  } else {
    framesOnLine = Math.max(0, framesOnLine - 2);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      line.progress = 0;
      framesOnLine = 0;
    }, IDLE_RESET_MS);
  }

  renderFrame();
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateLine() {
  const line = lines[currentLineIdx];
  line.done = true;
  line.progress = 1;
  framesOnLine = 0;

  cutColumn(currentLineIdx + 1);

  flashCutEffect();
  linesCompleted++;

  if (linesCompleted >= LINES_NEEDED) {
    finishChop();
    return;
  }
  currentLineIdx++;
}

function finishChop() {
  linesCompleted = LINES_NEEDED;
  renderFrame();

  revealChocolatePieces();

  setTimeout(() => {
    setChopActive(false);
    completeCbs.forEach((cb) => cb());
  }, 700);
}

// ── Rendu canvas ──────────────────────────────────────────────────────────────
function renderFrame() {
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!isActive) return;

  // Instructions en haut de la planche
  const b = getBoardNormBounds();
  const labelX = (b.x + b.w / 2) * W;
  const labelY = (b.y - 0.04) * H;

  ctx.font = `500 13px 'DM Sans', sans-serif`;
  ctx.fillStyle = "rgba(92,138,74,0.9)";
  ctx.textAlign = "center";
  ctx.fillText("✂  Suivez les traits pour couper", labelX, labelY);

  // Jauge compacte
  const gaugeW = 100;
  const gaugeX = (b.x + b.w / 2) * W - gaugeW / 2;
  const gaugeY = labelY + 14;
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.roundRect(gaugeX, gaugeY, gaugeW, 4, 2);
  ctx.fill();
  ctx.fillStyle = "#5c8a4a";
  ctx.beginPath();
  ctx.roundRect(gaugeX, gaugeY, gaugeW * (linesCompleted / LINES_NEEDED), 4, 2);
  ctx.fill();

  // Traits de coupe
  lines.forEach((line, i) => {
    const lx1 = line.x1 * W;
    const ly1 = line.y1 * H;
    const lx2 = line.x2 * W;
    const ly2 = line.y2 * H;

    const isCurrent = i === currentLineIdx && !line.done;
    const isDone = line.done;
    const isFuture = i > currentLineIdx;

    // Trait fantôme
    ctx.strokeStyle = isFuture
      ? "rgba(180,140,80,0.25)"
      : isDone
        ? "rgba(92,138,74,0.3)"
        : "rgba(180,140,80,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx2, ly2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Progression remplie
    if (!isFuture && line.progress > 0) {
      const fillY2 = ly1 + (ly2 - ly1) * line.progress;
      ctx.strokeStyle = isDone ? "#5c8a4a" : "#fff";
      ctx.lineWidth = isDone ? 3 : 2.5;
      ctx.globalAlpha = isDone ? 1 : 0.85;
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, fillY2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Check ou flèche
    if (isDone) {
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = "#5c8a4a";
      ctx.textAlign = "center";
      ctx.fillText("✓", lx1 + 12, (ly1 + ly2) / 2);
    } else if (isCurrent) {
      drawArrow(ctx, lx1, ly1, lx2, ly2);
    }
  });
}

function flashCutEffect() {
  if (!ctx) return;
  const b = getBoardNormBounds();
  const W = canvas.width;
  const H = canvas.height;

  let opacity = 0.4;
  const flash = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = `rgba(92,138,74,${opacity})`;
    ctx.beginPath();
    ctx.roundRect(b.x * W, b.y * H, b.w * W, b.h * H, 10);
    ctx.fill();
    opacity -= 0.07;
    if (opacity > 0) requestAnimationFrame(flash);
    else renderFrame();
  };
  requestAnimationFrame(flash);
}

function drawArrow(ctx, x1, y1, x2, y2) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const size = 9;

  ctx.save();
  ctx.translate(mx + 14, my);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.6, -size * 0.5);
  ctx.lineTo(-size * 0.6, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Géométrie ─────────────────────────────────────────────────────────────────
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function projectOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  return Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
}

function revealChocolatePieces() {
  const block = getChocolateBlock();
  const piecesWrap = document.getElementById("chocolate-pieces");
  if (!block || !piecesWrap) return;

  piecesWrap.innerHTML = "";
  piecesWrap.classList.remove("hidden");
  block.classList.add("breaking");

  const count = 12;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "ingredient choc-piece";
    piece.dataset.id = "chopped-chocolate";

    const visual = document.createElement("div");
    visual.className = "chopped-chocolate-visual";
    piece.appendChild(visual);

    const col = i % 4;
    const row = Math.floor(i / 4);
    piece.style.position = "absolute";
    piece.style.left = `${18 + col * 24}px`;
    piece.style.top = `${10 + row * 22}px`;
    piece.style.setProperty("--dx", `${(Math.random() - 0.5) * 18}px`);
    piece.style.setProperty("--dy", `${(Math.random() - 0.5) * 14}px`);
    piece.style.setProperty("--rot", `${(Math.random() - 0.5) * 10}deg`);

    piecesWrap.appendChild(piece);
  }

  setTimeout(() => {
    block.style.display = "none"; // plus propre que classList
    piecesWrap.classList.add("visible");
  }, 220);
}

initCanvas();
generateLines();
