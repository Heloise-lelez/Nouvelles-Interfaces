//script.js
import {
  processDrag,
  onDrop,
  confirmDrop,
  confirmDropChocolate,
  rejectDrop,
  resetDrop,
  setBowlGrabEnabled,
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
  resetSpeechRecognition,
} from "./speech-recognition.js";

import {
  processPour,
  onPourComplete,
  resetPour,
  setPourActive,
  setCurrentStepId,
} from "./pour.js";

import {
  processChop,
  onChopComplete,
  resetChop,
  setChopActive,
  showChocolateOnBoard,
  hideChocolateOnBoard,
} from "./chop.js";

// ── Éléments DOM ─────────────────────────────────────────
const cursor = document.getElementById("cursor");
const getSteps = () => document.querySelectorAll(".step");
const finishOverlay = document.getElementById("finish-overlay");
const finishReset = document.getElementById("finish-reset");
const whiskZone = document.getElementById("whisk-zone");
const glassContainer = document.getElementById("glass-container");
const ovenContainer = document.getElementById("oven-container");
const cuttingBoardContainer = document.getElementById(
  "cutting-board-container",
);

let nextIdx = 0;
let stepIdx = 0;
let chocolateIsCut = false;

getSteps().forEach((s) => s.classList.remove("active"));
if (getSteps()[stepIdx]) getSteps()[stepIdx].classList.add("active");
setWhiskActive(false); // désactive la détection du fouettage au démarrage
setCurrentStepId(null); // initialise l'étape courante pour le versement

// ── Écouter la fin du versement (une seule fois) ─────────
onPourComplete(() => {
  completeStep(stepIdx);
  setTimeout(showFinish, 700);
});

window.onHandUpdate((hand) => {
  const x = (1 - hand.x) * window.innerWidth; // Flip X to match mirrored camera
  const y = hand.y * window.innerHeight;

  // Curseur
  cursor.style.left = x + "px";
  cursor.style.top = y + "px";
  cursor.classList.toggle("pinching", hand.isPinching);

  // Pour verser
  processDrag({ ...hand, x: 1 - hand.x, y: hand.y });
  processWhisk(hand);
  processPour(hand, hand.landmarks);
  processChop({ ...hand, x: 1 - hand.x, y: hand.y });
});

// ── Drop d'un ingrédient ─────────────────────────────────
onDrop((id, target) => {
  const recipe = getCurrentRecipe();
  if (!recipe) return;

  const currentStep = recipe.steps[stepIdx];
  const expectedAtStep = currentStep?.id;

  console.log(`Drop: "${id}" sur "${target}" | attendu: "${expectedAtStep}"`);

  // Étape 1: chocolate → board
  if (expectedAtStep === "chocolate" && target === "board") {
    confirmDropChocolate(); // pas d'animation vers le bol, juste marquer comme utilisé
    showChocolateOnBoard(); // affiche le bloc à découper
    completeStep(stepIdx);
    updateStepIndex(stepIdx + 1); // → étape "chop"
    return;
  }

  // Étape 3: chopped-chocolate → bowl (SEULEMENT après chop)
  if (
    expectedAtStep === "chopped-chocolate" &&
    target === "bowl" &&
    chocolateIsCut
  ) {
    confirmDrop();
    hideChocolateOnBoard(); // cache les morceaux utilisés
    completeStep(stepIdx);
    updateStepIndex(stepIdx + 1); // → étape "whisk"
    return;
  }

  // Ignorer le drop de chopped-chocolate sur la planche (pas d'erreur, juste le rejeter)
  if (
    expectedAtStep === "chopped-chocolate" &&
    id === "chopped-chocolate" &&
    target === "board"
  ) {
    rejectDrop();
    return;
  }

  // Autres drops normaux
  const expectedTarget = expectedAtStep === "chocolate" ? "board" : "bowl";
  if (id === expectedAtStep && target === expectedTarget) {
    confirmDrop();
    completeStep(stepIdx);
    updateStepIndex(stepIdx + 1);
  } else {
    rejectDrop();
    handleError();
  }
});

// ── Fouettage terminé ────────────────────────────────────
onWhiskComplete(() => {
  completeStep(stepIdx); // coche "fouetter"
  resetWhisk(); // réinitialise la jauge pour le prochain whisk
  updateStepIndex(stepIdx + 1); // avance à l'étape suivante
  if (getSteps()[stepIdx]) getSteps()[stepIdx].classList.add("active");

  // Vérifier si on a terminé la recette
  const recipe = getCurrentRecipe();
  if (stepIdx >= recipe.steps.length) {
    setTimeout(showFinish, 700);
  }
});

// ── Coupage terminé ────────────────────────────────────
onChopComplete(() => {
  chocolateIsCut = true;
  completeStep(stepIdx); // coche "couper"
  resetChop();
  updateStepIndex(stepIdx + 1); // avance à l'étape suivante
  if (getSteps()[stepIdx]) getSteps()[stepIdx].classList.add("active");

  // Vérifier si on a terminé la recette
  const recipe = getCurrentRecipe();
  if (stepIdx >= recipe.steps.length) {
    setTimeout(showFinish, 700);
  }
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
  const recipe = getCurrentRecipe();
  stepIdx = newIdx;
  console.log("recipe", recipe);

  // Vérifier si l'étape actuelle existe
  const currentStep = recipe.steps[stepIdx];

  // Gère l'activation/désactivation du fouettage selon l'étape
  if (currentStep?.id === "whisk") {
    setWhiskActive(true); // active le fouettage pour "Fouetter en W"
    whiskZone.classList.add("whisk-ready"); // affiche la whisk zone
  } else {
    setWhiskActive(false); // désactive pour les autres étapes
    whiskZone.classList.remove("whisk-ready"); // cache la whisk zone
  }

  if (currentStep?.id === "chop") {
    setChopActive(true);
  } else {
    setChopActive(false);
  }

  // Gère l'activation/désactivation du grab du bol selon l'étape
  setBowlGrabEnabled(currentStep?.id === "pour");

  // Transmet l'id de l'étape courante au module versement
  setCurrentStepId(currentStep?.id);

  // Mettre à jour l'affichage du matériel selon le type de recette
  updateRecipeUI();
}

function updateRecipeUI() {
  const recipe = getCurrentRecipe();
  if (!recipe) return;

  // Afficher le verre pour les boissons (drinks)
  if (recipe.type === "drink") {
    glassContainer.style.display = "flex";
    ovenContainer.style.display = "none";
    cuttingBoardContainer.style.display = "none";
  }
  // Afficher le four pour les gâteaux (baking)
  else if (recipe.type === "baking") {
    glassContainer.style.display = "none";
    ovenContainer.style.display = "flex";
    cuttingBoardContainer.style.display = "flex";
  }
  // Par défaut: verre
  else {
    glassContainer.style.display = "flex";
    ovenContainer.style.display = "none";
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

// ── Gestion centralisée des erreurs ──────────────────────
function handleError() {
  console.log("Handling error: showing feedback and resetting recipe...");
  // 1. Afficher la croix d'erreur
  showErrorCross();

  // 2. Jouer le son d'erreur
  playErrorSound();

  // 3. Réinitialiser la recette après les animations
  setTimeout(() => {
    resetRecipe();
    hideChocolateOnBoard();
  }, 700);
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
  console.log("Resetting recipe state...");

  // Mettre à jour l'affichage verre/four selon la recette
  updateRecipeUI();
  chocolateIsCut = false;
  hideChocolateOnBoard();

  const bowl = document.getElementById("bowl");
  const glassIce = document.getElementById("glass-ice");

  // Vider tous les layers du bol
  if (bowl) {
    const layers = bowl.querySelectorAll("[id$='-layer']");
    layers.forEach((layer) => {
      layer.style.height = "0";
      layer.innerHTML = ""; // Vider aussi le contenu (glaçons)
    });
  }

  // Vider les glaçons du verre
  if (glassIce) {
    glassIce.innerHTML = "";
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

  setPourActive(false);
  glassContainer.classList.remove("pour-ready");
  resetPour();

  // Réinitialiser le drag
  resetDrop();

  // Réinitialiser la découpe du chocolat
  resetChop();
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
  console.log("Page loaded, initializing recipes and speech recognition...");

  // Attendre le chargement des recettes puis mettre à jour l'affichage
  setTimeout(() => {
    updateRecipeUI();
  }, 500);

  // Écouter les changements de recette
  let lastRecipeId = null;
  const observeRecipeChange = setInterval(() => {
    const recipe = getCurrentRecipe();
    const currentRecipeId = recipe?.id;

    if (currentRecipeId && currentRecipeId !== lastRecipeId) {
      lastRecipeId = currentRecipeId;
      updateRecipeUI();
      resetRecipe();
    }
  }, 100);
};

// Listener pour réinitialiser le jeu quand on change de recette depuis l'écran de fin
window.addEventListener("recipeReset", () => {
  resetRecipe();
});

// Listener pour réinitialiser la reconnaissance vocale
const micResetBtn = document.getElementById("mic-reset");
if (micResetBtn) {
  micResetBtn.addEventListener("click", () => {
    resetSpeechRecognition();
  });
}
