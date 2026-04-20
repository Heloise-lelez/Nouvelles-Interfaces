import {
  processDrag,
  onDrop,
  confirmDrop,
  rejectDrop,
  resetDrop,
} from "./drag.js";
import {
  processWhisk,
  onWhiskComplete,
  resetWhisk,
  setWhiskActive,
} from "./whisk.js";
import {
  initLoadRecipes,
  getCurrentRecipe,
  initFinishRecognition,
} from "./speech-recognition.js";


// ── Éléments DOM ─────────────────────────────────────────
const cursor = document.getElementById("cursor");
const getSteps = () => document.querySelectorAll(".step");
const finishOverlay = document.getElementById("finish-overlay");
const finishReset = document.getElementById("finish-reset");
const whiskZone = document.getElementById("whisk-zone");

const RECIPE_ORDER = ["water", "ice", "milk"];
let nextIdx = 0; // index dans RECIPE_ORDER
let stepIdx = 0; // étape DOM active (0-indexed) — on commence à "Tamiser 2g de matcha"

getSteps().forEach((s) => s.classList.remove("active"));
if (getSteps()[stepIdx]) getSteps()[stepIdx].classList.add("active");
setWhiskActive(false); // désactive la détection du fouettage au démarrage

window.onHandUpdate((hand) => {
  const x = (1 - hand.x) * window.innerWidth; // Flip X to match mirrored camera
  const y = hand.y * window.innerHeight;

  // Curseur
  cursor.style.left = x + "px";
  cursor.style.top = y + "px";
  cursor.classList.toggle("pinching", hand.isPinching);

  // Modules (passer les coordonnées transformées)
  processDrag({ ...hand, x: 1 - hand.x, y: hand.y });
  processWhisk(hand);
});

// ── Drop d'un ingrédient ─────────────────────────────────
onDrop((id) => {
  const recipe = getCurrentRecipe();
  if (!recipe) return;

  const expectedIngredients = recipe.ingredients.map((ing) => ing.id);
  const expectedAtStep = expectedIngredients[stepIdx];

  console.log(
    `Tentative de drop de "${id}" à l'étape ${stepIdx}, attendu "${expectedAtStep}"`,
  );

  if (id === expectedAtStep || expectedIngredients.includes(id)) {
    confirmDrop();
    completeStep(stepIdx);
    updateStepIndex(stepIdx + 1);

    if (stepIdx >= recipe.steps.length) {
      setTimeout(showFinish, 700);
    } else {
      if (getSteps()[stepIdx]) getSteps()[stepIdx].classList.add("active");
    }
  } else {
    console.log(
      `❌ Erreur étape ${stepIdx} : attendu "${expectedAtStep}", reçu "${id}"`,
    );
    rejectDrop();
    spill();
  }
});

// ── Fouettage terminé ────────────────────────────────────
onWhiskComplete(() => {
  completeStep(stepIdx); // coche "fouetter"
  nextIdx = 1; // reprend à l'index 1 (ice) dans RECIPE_ORDER
  updateStepIndex(3); // utilise la fonction helper (passe à "Ajouter les glaçons")
  if (getSteps()[stepIdx]) getSteps()[stepIdx].classList.add("active");
  // N'affiche pas le finish-overlay, on attend les ingrédients suivants
});

// ── Helpers étapes ───────────────────────────────────────
function completeStep(idx) {
  console.log("completed step", idx);
  const steps = getSteps();
  if (!steps[idx]) return;

  steps[idx].classList.remove("active");
  steps[idx].classList.add("done");
}

function updateStepIndex(newIdx) {
  stepIdx = newIdx;
  // Gère l'activation/désactivation du fouettage selon l'étape
  if (stepIdx === 2) {
    setWhiskActive(true); // active le fouettage pour "Fouetter en W"
    whiskZone.classList.add("whisk-ready"); // affiche la whisk zone
  } else {
    setWhiskActive(false); // désactive pour les autres étapes
    whiskZone.classList.remove("whisk-ready"); // cache la whisk zone
  }
}

function activateWhiskStep() {
  // stepIdx pointe maintenant sur l'étape "Fouetter en W"
  // Dans le HTML, c'est l'index 2
  updateStepIndex(2);
  if (getSteps()[stepIdx]) getSteps()[stepIdx].classList.add("active");
  whiskZone.classList.add("whisk-ready");
}

// ── Fin de recette ───────────────────────────────────────
function showFinish() {
  finishOverlay.classList.remove("hidden");
  launchConfetti();
  playSuccessSound();
  initFinishRecognition();
}

finishReset.addEventListener("click", () => {
  location.reload();
});
// ── Animation de renversement ───────────────────────────
function spill() {
  // Afficher la croix d'erreur
  showErrorCross();

  // Jouer le son d'erreur
  playErrorSound();

  // Réinitialiser après l'animation (1.2s total)
  setTimeout(() => {
    resetRecipe();
  }, 1200);
}

function showErrorCross() {
  const errorCross = document.getElementById("error-cross");
  errorCross.classList.remove("hidden");

  // Cacher la croix après l'animation
  setTimeout(() => {
    errorCross.classList.add("hidden");
  }, 600);
}

function playErrorSound() {
  try {
    const ac = new AudioContext();
    // Deux notes basses pour un son d'erreur
    const osc1 = ac.createOscillator();
    const gain1 = ac.createGain();
    osc1.connect(gain1);
    gain1.connect(ac.destination);
    osc1.type = "sine";
    osc1.frequency.value = 200; // Note basse

    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();
    osc2.connect(gain2);
    gain2.connect(ac.destination);
    osc2.type = "sine";
    osc2.frequency.value = 150; // Note plus basse

    const t = ac.currentTime;

    // Premier son
    gain1.gain.setValueAtTime(0.2, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc1.start(t);
    osc1.stop(t + 0.2);

    // Deuxième son
    gain2.gain.setValueAtTime(0.2, t + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.start(t + 0.15);
    osc2.stop(t + 0.35);
  } catch (_) {}
}

function resetRecipe() {
  const bowl = document.getElementById("bowl");
  const bowlLiquid = document.getElementById("bowl-liquid");
  const bowlMatchaLayer = document.getElementById("bowl-matcha-layer");

  // Vider le bol complètement
  if (bowlLiquid) {
    bowlLiquid.style.height = "0";
  }
  if (bowlMatchaLayer) {
    bowlMatchaLayer.style.height = "0";
  }

  // Réinitialiser les étapes
  getSteps().forEach((s) => {
    s.classList.remove("active", "done");
  });
  stepIdx = 0;
  nextIdx = 0;

  // Réactiver l'étape initiale
  if (getSteps()[stepIdx]) getSteps()[stepIdx].classList.add("active");

  // Réinitialiser le fouettage
  setWhiskActive(false);
  whiskZone.classList.remove("whisk-ready");
  resetWhisk();

  // Réinitialiser les ingrédients
  document.querySelectorAll(".ingredient").forEach((ing) => {
    ing.classList.remove("used");
  });

  // Réinitialiser le drag
  resetDrop();
}
// ── Confettis canvas ─────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = [
    "#5C8A4A",
    "#7AB060",
    "#C8DFB8",
    "#D4C9B5",
    "#A8CEDE",
    "#EDE8DE",
  ];
  const pieces = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 300,
    w: 5 + Math.random() * 8,
    h: 8 + Math.random() * 7,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.random() * Math.PI * 2,
    vx: (Math.random() - 0.5) * 3.5,
    vy: 1.5 + Math.random() * 3.5,
    vr: (Math.random() - 0.5) * 0.18,
  }));

  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy + 0.07 * p.vy;
      p.vy += 0.06;
      p.rot += p.vr;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive) requestAnimationFrame(draw);
  })();
}

// ── Son de succès (Web Audio API) ────────────────────────
function playSuccessSound() {
  try {
    const ac = new AudioContext();
    const notes = [523, 659, 784, 1047]; // Do–Mi–Sol–Do
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ac.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch (_) {}
}

// ── Initialisation des recettes et démarrage de la reconnaissance vocale ───────────────────────
window.onload = () => {
  initLoadRecipes();

  // Écouter les changements de recette
  const observeRecipeChange = setInterval(() => {
    const recipe = getCurrentRecipe();
    if (recipe) {
      updateRecipeUI(recipe);
      clearInterval(observeRecipeChange);
    }
  }, 100);
}