// drag.js — gestion du pinch + drag des ingrédients vers le bol + drag du bol

const ghost = document.getElementById("drag-ghost");
const ghostCircle = ghost.querySelector(".drag-ghost-circle");
const bowl = document.getElementById("bowl");
const bowlMatchaLayer = document.getElementById("bowl-matcha-layer");
const bowlWaterLayer = document.getElementById("bowl-water-layer");

let draggedItem = null; // élément .ingredient en cours de drag
let bowlGrabbed = false; // le bol est-il attrapé au pinch?
let bowlGrabPos = { x: 0, y: 0 }; // position où on a attrapé le bol
let bowlOffset = { x: 0, y: 0 }; // offset du bol par rapport à sa position initiale
let wasPinching = false;
let dropCallbacks = [];
let pendingDropItem = null; // ingrédient en attente de validation
let allowBowlGrab = false; // le grab du bol est-il autorisé à cette étape?

// ── Hauteurs des couches ──────────────────────────────
let matchaHeight = 0; // hauteur du matcha
let waterHeight = 0; // hauteur de l'eau
let totalHeight = 0; // 0..100

// ── Couleurs du bol selon ingrédient ajouté ──────────────
const LIQUID_COLORS = {
  matcha: "#4A7C35",
  water: "#6A9C45",
  ice: "#5A8C50",
  milk: "#7AB870",
};

// ── API publique ─────────────────────────────────────────
export function isBowlGrabbed() {
  return bowlGrabbed;
}

export function getBowlOffset() {
  return bowlOffset;
}

export function setBowlGrabEnabled(enabled) {
  allowBowlGrab = enabled;
}

export function onDrop(cb) {
  dropCallbacks.push(cb);
}

export function confirmDrop() {
  if (!pendingDropItem) return;
  const el = pendingDropItem;
  const id = el.dataset.id;

  // Animation de chute dans le bol
  const ghost = document.getElementById("drag-ghost");
  const ghostCircle = ghost.querySelector(".drag-ghost-circle");
  animateDrop(ghost.style.left, ghost.style.top, ghostCircle.style.background);

  el.classList.add("used");
  updateBowl(id);

  pendingDropItem = null;
}

export function rejectDrop() {
  if (!pendingDropItem) return;
  const el = pendingDropItem;

  el.classList.remove("grabbed");
  pendingDropItem = null;
}

export function resetDrop() {
  pendingDropItem = null;
  matchaHeight = 0;
  waterHeight = 0;
  totalHeight = 0;
  bowlMatchaLayer.style.height = "0px";
  bowlWaterLayer.style.height = "0px";
}

// ── Boucle principale appelée par onHandUpdate ───────────
export function processDrag(hand) {
  const x = hand.x * window.innerWidth;
  const y = hand.y * window.innerHeight;

  const pinchStarted = hand.isPinching && !wasPinching;
  const pinchEnded = !hand.isPinching && wasPinching;

  // Priorité 1 : si le bol est déjà attrapé, le déplacer
  if (bowlGrabbed && hand.isPinching) {
    moveBowlDrag(x, y);
  }

  // Priorité 2 : si un ingrédient est déjà en cours de drag, continuer
  if (draggedItem && hand.isPinching) {
    moveDrag(x, y);
  }

  // Début du pinch : cherche un ingrédient ou le bol
  if (pinchStarted) {
    const el = ingredientUnderCursor(x, y);
    if (el && !el.classList.contains("used")) {
      startDrag(el, x, y);
    } else if (allowBowlGrab && isBowlUnderCursor(x, y)) {
      startBowlDrag(x, y);
    }
  }

  // Fin du pinch : dépose ou annule
  if (pinchEnded) {
    if (draggedItem) {
      if (isOverBowl(x, y)) {
        dropOnBowl(draggedItem);
      } else {
        cancelDrag();
      }
    }
    if (bowlGrabbed) {
      releaseBowl();
    }
  }

  wasPinching = hand.isPinching;
}

// ── Fonctions internes ───────────────────────────────────

// Détecte si le bol est sous le curseur
function isBowlUnderCursor(x, y) {
  const r = bowl.getBoundingClientRect();
  const margin = 20;
  return (
    x > r.left - margin &&
    x < r.right + margin &&
    y > r.top - margin &&
    y < r.bottom + margin
  );
}

function startBowlDrag(x, y) {
  bowlGrabbed = true;
  bowlGrabPos = { x, y };
  bowlOffset = { x: 0, y: 0 };
  bowl.classList.add("grabbed");
  ghost.classList.remove("hidden");
  ghostCircle.style.background = "rgba(100, 80, 60, 0.5)";
  moveBowlDrag(x, y);
}

function moveBowlDrag(x, y) {
  // Calculer le déplacement depuis le grip initial
  const offsetX = x - bowlGrabPos.x;
  const offsetY = y - bowlGrabPos.y;

  bowlOffset = { x: offsetX, y: offsetY };

  // Appliquer le transform au bol
  bowl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

  // Le ghost suit aussi la main
  ghost.style.left = x + "px";
  ghost.style.top = y + "px";
}

function releaseBowl() {
  bowlGrabbed = false;
  bowl.classList.remove("grabbed");
  bowl.style.transform = "translate(0px, 0px)";
  bowlOffset = { x: 0, y: 0 };
  ghost.classList.add("hidden");
}

// ── Fonctions internes ───────────────────────────────────
function ingredientUnderCursor(x, y) {
  const all = document.querySelectorAll(".ingredient");
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (x > r.left && x < r.right && y > r.top && y < r.bottom) {
      return el;
    }
  }
  return null;
}

function isOverBowl(x, y) {
  const r = bowl.getBoundingClientRect();
  // Zone un peu plus large que le bol visuel pour faciliter le drop
  const margin = 30;
  return (
    x > r.left - margin &&
    x < r.right + margin &&
    y > r.top - margin &&
    y < r.bottom + margin
  );
}

function startDrag(el, x, y) {
  draggedItem = el;
  el.classList.add("grabbed");

  // Couleur du ghost = couleur visuelle de l'ingrédient
  const visual = el.querySelector(".ingredient-visual");
  const color = getComputedStyle(visual).backgroundColor;
  ghostCircle.style.background = color;

  ghost.classList.remove("hidden");
  moveDrag(x, y);
}

function moveDrag(x, y) {
  ghost.style.left = x + "px";
  ghost.style.top = y + "px";

  // Feedback visuel : bol s'illumine si on survole
  bowl.classList.toggle("drop-hover", isOverBowl(x, y));
}

function cancelDrag() {
  draggedItem.classList.remove("grabbed");
  draggedItem = null;
  ghost.classList.add("hidden");
  bowl.classList.remove("drop-hover");
}

function dropOnBowl(el) {
  const id = el.dataset.id;

  el.classList.remove("grabbed");
  draggedItem = null;
  ghost.classList.add("hidden");
  bowl.classList.remove("drop-hover");

  // Marquer comme en attente de validation (pas encore "used")
  pendingDropItem = el;

  // Notifie script.js
  dropCallbacks.forEach((cb) => cb(id));
}

function updateBowl(id) {
  const maxH = 78; // hauteur max du bol

  if (id === "matcha") {
    // Ajouter du matcha : remplit la couche de matcha
    matchaHeight = Math.min(maxH, matchaHeight + 12);
    bowlMatchaLayer.style.height = matchaHeight + "px";
  } else if (id === "water") {
    // Ajouter de l'eau : remplit la couche d'eau au-dessus du matcha
    waterHeight = Math.min(maxH - matchaHeight, waterHeight + 12);
    bowlWaterLayer.style.height = waterHeight + "px";
    bowlWaterLayer.style.bottom = matchaHeight + "px";
  } else {
    // Autres ingrédients (glaçons, lait)
    totalHeight = Math.min(maxH, totalHeight + 22);
    bowlMatchaLayer.style.height = totalHeight + "px";
  }
}

function animateDrop(leftPx, topPx, ghostColor) {
  // Crée un mini clone qui tombe dans le bol
  const drop = document.createElement("div");
  drop.style.cssText = `
    position: fixed;
    left: ${leftPx};
    top: ${topPx};
    width: 20px; height: 20px;
    border-radius: 50%;
    background: ${ghostColor};
    opacity: 0.85;
    pointer-events: none;
    z-index: 998;
    transform: translate(-50%, -50%);
    transition: top 0.35s cubic-bezier(0.4, 0, 1, 1),
                left 0.35s ease,
                opacity 0.35s ease,
                transform 0.35s ease;
  `;
  document.body.appendChild(drop);

  const bowlRect = bowl.getBoundingClientRect();
  const targetX = bowlRect.left + bowlRect.width / 2;
  const targetY = bowlRect.top + bowlRect.height / 2;

  // Force reflow puis anime
  drop.getBoundingClientRect();
  drop.style.left = targetX + "px";
  drop.style.top = targetY + "px";
  drop.style.opacity = "0";
  drop.style.transform = "translate(-50%, -50%) scale(0.2)";

  setTimeout(() => drop.remove(), 400);
}
