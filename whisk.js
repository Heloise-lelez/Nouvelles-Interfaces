// whisk.js — détection du tracé en W + gestion de la jauge

const gaugeFill = document.getElementById("whisk-gauge-fill");
const gaugeLabel = document.getElementById("whisk-gauge-label");
const whiskDots = document.querySelectorAll(".whisk-dot");
const bowl = document.getElementById("bowl");

// ── État interne ─────────────────────────────────────────
let gaugeValue = 0; // 0..100
let isActive = false; // true = on est au-dessus du bol
let posHistory = []; // buffer des positions X récentes
let reversals = 0; // nb de changements de direction détectés
let lastDirection = null; // 'left' | 'right'
let completeCbs = [];

const REVERSAL_THRESHOLD = 0.02; // delta X min pour compter un changement
const REVERSALS_NEEDED = 6; // 6 inversions = 3 W complets

// ── API publique ─────────────────────────────────────────
export function setWhiskActive(active) {
  isActive = active;
}

export function onWhiskComplete(cb) {
  completeCbs.push(cb);
}

export function resetWhisk() {
  gaugeValue = 0;
  reversals = 0;
  lastDirection = null;
  posHistory = [];
  bowl.classList.remove("mixing");
  bowl.classList.remove("mixed");
  updateUI();
}

// ── Boucle principale ────────────────────────────────────
export function processWhisk(hand) {
  if (gaugeValue >= 100) return; // déjà terminé
  if (!isActive) return; // zigzag actif seulement durant "Fouetter en W"
  if (!isOverBowlArea(hand)) return;

  const x = hand.x; // coordonnées normalisées 0..1

  posHistory.push(x);
  if (posHistory.length > 6) posHistory.shift(); // fenêtre glissante courte
  if (posHistory.length < 3) return;

  // Détecte la direction actuelle
  const oldest = posHistory[0];
  const newest = posHistory[posHistory.length - 1];
  const delta = newest - oldest;

  if (Math.abs(delta) < REVERSAL_THRESHOLD) return; // trop lent, on ignore

  const dir = delta > 0 ? "right" : "left";

  if (lastDirection && dir !== lastDirection) {
    // Changement de direction = une inversion comptée
    reversals++;
    updateGauge();
    highlightNextDot();

    if (reversals >= REVERSALS_NEEDED) {
      finishWhisk();
    }
  }
  lastDirection = dir;
}

// ── Fonctions internes ───────────────────────────────────
function isOverBowlArea(hand) {
  const x = hand.x * window.innerWidth;
  const y = hand.y * window.innerHeight;
  const r = bowl.getBoundingClientRect();
  const margin = 80; // zone large autour du bol
  return (
    x > r.left - margin &&
    x < r.right + margin &&
    y > r.top - margin &&
    y < r.bottom + margin
  );
}

function updateGauge() {
  gaugeValue = Math.min(100, Math.round((reversals / REVERSALS_NEEDED) * 100));
  updateUI();

  // Ajouter une classe de mélange progressif au bol
  if (gaugeValue > 0) {
    bowl.classList.add("mixing");
  }
}

function updateUI() {
  gaugeFill.style.width = gaugeValue + "%";
  gaugeLabel.textContent = gaugeValue + "%";

  // La jauge vire au vert vif quand elle approche du max
  if (gaugeValue > 70) {
    gaugeFill.style.background = "#3A7A2A";
  } else {
    gaugeFill.style.background = "#5C8A4A";
  }
}

function highlightNextDot() {
  const idx = Math.min(reversals - 1, whiskDots.length - 1);
  if (whiskDots[idx]) {
    whiskDots[idx].style.opacity = "1";
    whiskDots[idx].setAttribute("fill", "#5C8A4A");
  }
}

function finishWhisk() {
  gaugeValue = 100;
  updateUI();

  // Récupérer les éléments pour fusionner les couches
  const matchaLayer = document.getElementById("bowl-matcha-layer");
  const waterLayer = document.getElementById("bowl-water-layer");
  const butterLayer = document.getElementById("bowl-butter-layer");
  const sugarLayer = document.getElementById("bowl-sugar-layer");
  const eggLayer = document.getElementById("bowl-egg-layer");
  const flourLayer = document.getElementById("bowl-flour-layer");
  const chocolateLayer = document.getElementById("bowl-chocolate-layer");
  const bowl = document.getElementById("bowl");

  setTimeout(() => {
    const matchaHeight = parseFloat(matchaLayer.style.height) || 0;
    const waterHeight = parseFloat(waterLayer.style.height) || 0;
    const butterHeight = parseFloat(butterLayer.style.height) || 0;
    const sugarHeight = parseFloat(sugarLayer.style.height) || 0;
    const eggHeight = parseFloat(eggLayer.style.height) || 0;
    const flourHeight = parseFloat(flourLayer.style.height) || 0;
    const chocolateHeight = parseFloat(chocolateLayer.style.height) || 0;
    const totalHeight = matchaHeight + waterHeight + butterHeight + sugarHeight + eggHeight + flourHeight + chocolateHeight;

    if (eggHeight > 0 ) {
      matchaLayer.style.opacity = "0";
      butterLayer.style.opacity = "0";
      sugarLayer.style.opacity = "0";
      eggLayer.style.background = "#6a9c45";
    } else if (chocolateHeight > 0) {
      eggLayer.style.opacity = "0";
      flourLayer.style.opacity = "0";
      chocolateLayer.style.background = "#6a9c45";
    } else {
      // Augmenter la hauteur du matcha pour couvrir les deux couches
      matchaLayer.style.height = totalHeight + "px";
      matchaLayer.style.background = "#6a9c45";

      // Faire disparaître la couche d'eau
      waterLayer.style.height = "0px";
      waterLayer.style.bottom = "0px";
    }

    // Ajouter les classes
    bowl.classList.add("mixed");
    bowl.classList.remove("mixing");
  }, 500);

  completeCbs.forEach((cb) => cb());
}
