// drag.js — gestion du pinch + drag des ingrédients vers le bol + drag du bol

const ghost = document.getElementById("drag-ghost");
const ghostCircle = ghost.querySelector(".drag-ghost-circle");
const bowl = document.getElementById("bowl");
const bowlMatchaLayer = document.getElementById("bowl-matcha-layer");
const bowlWaterLayer = document.getElementById("bowl-water-layer");
const bowlIceLayer = document.getElementById("bowl-ice-layer");
const glassIce = document.getElementById("glass-ice");
const cuttingBoard = document.getElementById("cutting-board-container");

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
let lastIngredient = null; // dernier ingrédient ajouté (autres que matcha/water)
let iceCubesAdded = 0; // nombre de fois qu'on a ajouté des glaçons

// ── Couleurs du bol selon ingrédient ajouté ──────────────
const LIQUID_COLORS = {
  matcha: "#4A7C35",
  water: "#6A9C45",
  ice: "#5A8C50",
  milk: "#98c690",
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

export function confirmDropChocolate() {
  if (!pendingDropItem) return;
  const el = pendingDropItem;

  el.classList.add("used");
  pendingDropItem = null;
}

export function resetDrop() {
  pendingDropItem = null;
  matchaHeight = 0;
  waterHeight = 0;
  totalHeight = 0;
  lastIngredient = null;
  iceCubesAdded = 0;
  bowlMatchaLayer.style.height = "0px";
  bowlMatchaLayer.style.background = LIQUID_COLORS.matcha;
  bowlWaterLayer.style.height = "0px";
  bowlIceLayer.style.height = "0px";
  bowlIceLayer.innerHTML = "";
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
      if (isOverCuttingBoard(x, y)) {
        dropOnBowl(draggedItem, "board");
      } else if (isOverBowl(x, y)) {
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
  const offsetX = x - bowlGrabPos.x;
  const offsetY = y - bowlGrabPos.y;
  bowlOffset = { x: offsetX, y: offsetY };

  ghost.style.left = x + "px";
  ghost.style.top = y + "px";
}

function releaseBowl() {
  console.log("Bowl released");
  bowlGrabbed = false;
  bowl.classList.remove("grabbed");
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
  let visual = el.querySelector(".ingredient-visual");
  if (!visual) {
    visual = el.querySelector(".chopped-chocolate-visual");
  }
  const color = visual ? getComputedStyle(visual).backgroundColor : "#fdf3c0";
  ghostCircle.style.background = color;

  ghost.classList.remove("hidden");
  moveDrag(x, y);
}

function moveDrag(x, y) {
  ghost.style.left = x + "px";
  ghost.style.top = y + "px";

  // Feedback visuel : bol s'illumine si on survole
  bowl.classList.toggle("drop-hover", isOverBowl(x, y));
  cuttingBoard.classList.toggle("drop-hover", isOverCuttingBoard(x, y));
}

function cancelDrag() {
  draggedItem.classList.remove("grabbed");
  draggedItem = null;
  ghost.classList.add("hidden");
  bowl.classList.remove("drop-hover");
  cuttingBoard.classList.remove("drop-hover");
}

function dropOnBowl(el, target = "bowl") {
  const id = el.dataset.id;

  el.classList.remove("grabbed");
  draggedItem = null;
  bowl.classList.remove("drop-hover");
  cuttingBoard.classList.remove("drop-hover");

  pendingDropItem = el;

  ghost.classList.add("hidden"); // cache l'original

  // Si on drop sur la planche, pas d'animation de chute
  if (target === "board") {
    dropCallbacks.forEach((cb) => cb(id, target));
  } else {
    // Lance l'animation de chute AVANT de notifier script.js
    const ghostLeft = ghost.style.left;
    const ghostTop = ghost.style.top;
    const ghostColor = ghostCircle.style.background;

    animatePhysicsDrop(ghostLeft, ghostTop, ghostColor, () => {
      // Une fois la chute terminée, notifie script.js
      dropCallbacks.forEach((cb) => cb(id, target));
    });
  }
}

// Nouvelle fonction — chute avec rebond
function animatePhysicsDrop(leftPx, topPx, color, onLanded) {
  const drop = document.createElement("div");
  const bowlRect = bowl.getBoundingClientRect();
  const targetX = bowlRect.left + bowlRect.width / 2;
  const targetY = bowlRect.top + bowlRect.height * 0.7; // atterrit dans le fond du bol

  // Extraire les valeurs numériques
  const startX = parseFloat(leftPx);
  const startY = parseFloat(topPx);

  drop.style.cssText = `
    position: fixed;
    left: ${startX}px;
    top: ${startY}px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${color};
    border: 2px solid rgba(255,255,255,0.6);
    opacity: 0.9;
    pointer-events: none;
    z-index: 998;
    transform: translate(-50%, -50%) scale(1);
    transition: none;
  `;
  document.body.appendChild(drop);

  const duration = 380; // ms pour tomber
  const startTime = performance.now();

  function fall(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);

    // Easing : accélération vers le bas (gravité)
    const eased = t * t;

    // Position interpolée
    const x = startX + (targetX - startX) * t; // horizontal : linéaire
    const y = startY + (targetY - startY) * eased; // vertical : accéléré

    // Légère rotation pendant la chute
    const rotation = t * 180;

    // Rétrécissement à l'impact
    const scale = t < 0.85 ? 1 : 1 - ((t - 0.85) / 0.15) * 0.4;

    drop.style.left = x + "px";
    drop.style.top = y + "px";
    drop.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
    drop.style.opacity = t < 0.8 ? "0.9" : String(0.9 * (1 - (t - 0.8) / 0.2));

    if (t < 1) {
      requestAnimationFrame(fall);
    } else {
      drop.remove();
      splashEffect(targetX, targetY, color); // petite éclaboussure
      onLanded();
    }
  }

  requestAnimationFrame(fall);
}
// Effet d'éclaboussure au moment de l'impact
function splashEffect(cx, cy, color) {
  const COUNT = 6;
  for (let i = 0; i < COUNT; i++) {
    const particle = document.createElement("div");
    const angle = (i / COUNT) * Math.PI * 2;
    const speed = 30 + Math.random() * 20;

    particle.style.cssText = `
      position: fixed;
      left: ${cx}px;
      top: ${cy}px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${color};
      opacity: 0.8;
      pointer-events: none;
      z-index: 997;
      transform: translate(-50%, -50%);
      transition:
        left 0.3s ease-out,
        top 0.3s ease-out,
        opacity 0.3s ease-out,
        transform 0.3s ease-out;
    `;
    document.body.appendChild(particle);

    // Force reflow
    particle.getBoundingClientRect();

    particle.style.left = cx + Math.cos(angle) * speed + "px";
    particle.style.top = cy + Math.sin(angle) * speed + "px";
    particle.style.opacity = "0";
    particle.style.transform = "translate(-50%, -50%) scale(0.2)";

    setTimeout(() => particle.remove(), 350);
  }
}

function updateBowl(id) {
  const maxH = 78; // hauteur max du bol
  const iceHeight = 22;
  if (id === "matcha") {
    // Ajouter du matcha : remplit la couche de matcha
    matchaHeight = Math.min(maxH, matchaHeight + 12);
    bowlMatchaLayer.style.height = matchaHeight + "px";
    bowlMatchaLayer.style.background = LIQUID_COLORS.matcha;
  } else if (id === "water") {
    // Ajouter de l'eau : remplit la couche d'eau au-dessus du matcha
    waterHeight = Math.min(maxH - matchaHeight, waterHeight + 12);
    bowlWaterLayer.style.height = waterHeight + "px";
    bowlWaterLayer.style.bottom = matchaHeight + "px";
  } else if (id === "ice") {
    // Ajouter des glaçons : remplir la couche de glace et créer les cubes

    matchaHeight = Math.min(maxH, matchaHeight + iceHeight);
    bowlMatchaLayer.style.height = matchaHeight + "px";
    bowlIceLayer.style.bottom = matchaHeight - iceHeight + "px";
    bowlIceLayer.style.background = LIQUID_COLORS.ice;

    // Créer 3 cubes de glaçons dans le bol
    bowlIceLayer.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const cube = document.createElement("div");
      cube.className = "ice-cube";
      bowlIceLayer.appendChild(cube);
    }

    // Créer les mêmes 3 cubes de glaçons dans le verre
    glassIce.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const cube = document.createElement("div");
      cube.className = "ice-cube";
      glassIce.appendChild(cube);
    }

    lastIngredient = id;
  } else if (id === "milk") {
    const milkHeight = 22;
    matchaHeight = Math.min(maxH, matchaHeight + milkHeight);
    bowlMatchaLayer.style.height = matchaHeight + "px";
    bowlMatchaLayer.style.background = LIQUID_COLORS.milk;
    bowlIceLayer.style.marginBottom = matchaHeight - iceHeight + "px";
  } else if (id !== "chocolate") {
    // Autres ingrédients (lait, etc.)
    lastIngredient = id;
    totalHeight = Math.min(maxH, totalHeight + 22);
    bowlMatchaLayer.style.height = totalHeight + "px";

    // Changer la couleur selon l'ingrédient
    const color = LIQUID_COLORS[id];
    if (color) {
      bowlMatchaLayer.style.background = color;
    }
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

function isOverCuttingBoard(x, y) {
  if (!cuttingBoard) return false;
  const r = cuttingBoard.getBoundingClientRect();

  // Si le container est caché, getBoundingClientRect retourne des zéros
  if (r.width === 0 || r.height === 0) return false;

  console.log(
    "Board rect:",
    r.left,
    r.top,
    r.right,
    r.bottom,
    "| cursor:",
    x,
    y,
  );

  const margin = 40;
  return (
    x > r.left - margin &&
    x < r.right + margin &&
    y > r.top - margin &&
    y < r.bottom + margin
  );
}
