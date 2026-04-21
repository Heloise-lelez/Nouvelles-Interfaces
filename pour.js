// pour.js — détection du basculement du bol vers le verre

import { isBowlGrabbed, getBowlOffset } from "./drag.js";

const bowl = document.getElementById("bowl");
const glass = document.getElementById("glass");
const glassLiquid = document.getElementById("glass-liquid");
const bowlMatchaLayer = document.getElementById("bowl-matcha-layer");
const bowlWaterLayer = document.getElementById("bowl-water-layer");

let isActive = false;
let tiltAngle = 0; // angle de basculement détecté
let startHeight = 0; // hauteur initiale du bol
let pourProgress = 0; // 0..100
let completeCbs = [];
let tiltHistory = []; // buffer des angles récents
let autoPourStarted = false; // versement automatique lancé?
let currentStepId = null; // id de l'étape courante

const TILT_THRESHOLD = 25; // degrés avant de commencer le versement
const POUR_COMPLETE_ANGLE = 60; // degrés pour terminer
const AUTO_POUR_RATE = 1.5; // vitesse de versement automatique (%/frame)

export function setPourActive(active) {
  isActive = active;
  if (active) {
    pourProgress = 0;
    tiltHistory = [];
    // Mémoriser la hauteur actuelle
    startHeight = Math.max(
      parseFloat(bowlMatchaLayer.style.height || 0),
      parseFloat(bowlWaterLayer.style.height || 0),
    );
  }
}

export function setCurrentStepId(stepId) {
  currentStepId = stepId;
}

export function onPourComplete(cb) {
  completeCbs.push(cb);
}

export function resetPour() {
  isActive = false;
  pourProgress = 0;
  tiltAngle = 0;
  tiltHistory = [];
  autoPourStarted = false;
  glass.classList.remove("pour-ready");
  glassLiquid.style.height = "0px";
}

// Appelée à chaque frame depuis script.js
export function processPour(hand, landmarks) {
  const bowlGrabbed = isBowlGrabbed();
  const bowlOverGlass = isOverGlass(hand);

  // Appliquer le tilt visuel si le bol est au-dessus du verre ET on est à l'étape "pour"
  if (bowlGrabbed && bowlOverGlass && currentStepId === "pour") {
    bowl.classList.add("tilting");
  } else {
    bowl.classList.remove("tilting");
  }

  // Si le bol est attrapé et au-dessus du verre, lancer le versement automatique
  // SEULEMENT si on est à l'étape "pour"
  if (
    bowlGrabbed &&
    bowlOverGlass &&
    currentStepId === "pour" &&
    !autoPourStarted
  ) {
    autoPourStarted = true;
    isActive = true;
    pourProgress = 0;
    tiltHistory = [];
    startHeight = Math.max(
      parseFloat(bowlMatchaLayer.style.height || 0),
      parseFloat(bowlWaterLayer.style.height || 0),
    );
    glass.classList.add("pour-ready");
  }

  // Si le bol n'est plus attrapé ou hors du verre, arrêter le versement automatique
  if (!bowlGrabbed || !bowlOverGlass) {
    autoPourStarted = false;
    // Ne pas réinitialiser isActive immédiatement, laisser le versement se terminer si en cours
  }

  // Versement automatique
  if (autoPourStarted && isActive && pourProgress < 100) {
    pourProgress = Math.min(100, pourProgress + AUTO_POUR_RATE);
    animatePour(pourProgress);

    if (pourProgress >= 100) {
      finishPour();
    }
    return;
  }

  // Versement manuel (mode tilt-based) — seulement si isActive mais pas autoPourStarted
  if (!isActive) return;
  if (pourProgress >= 100) return;

  // Calculer l'angle de basculement du poignet
  if (landmarks && landmarks.length > 0) {
    tiltAngle = calculateTiltAngle(landmarks);
    tiltHistory.push(tiltAngle);
    if (tiltHistory.length > 10) tiltHistory.shift();
  }

  // Si la main n'est pas au-dessus du verre, ignorer
  if (!isOverGlass(hand)) return;

  // Moyenne lissée de l'angle
  const smoothTilt =
    tiltHistory.length > 0
      ? tiltHistory.reduce((a, b) => a + b) / tiltHistory.length
      : 0;

  // Si le basculement est suffisant
  if (smoothTilt > TILT_THRESHOLD) {
    // Progression du versement
    pourProgress = Math.min(
      100,
      ((smoothTilt - TILT_THRESHOLD) / (POUR_COMPLETE_ANGLE - TILT_THRESHOLD)) *
        100,
    );

    animatePour(pourProgress);

    if (smoothTilt >= POUR_COMPLETE_ANGLE) {
      finishPour();
    }
  }
}

// Calcule l'angle de basculement à partir des landmarks MediaPipe
// Plus l'angle est grand, plus le bol est incliné vers l'avant
function calculateTiltAngle(landmarks) {
  const wrist = landmarks[0];
  const palmBase = landmarks[9]; // base du majeur

  // Vecteur paume
  const palmX = palmBase.x - wrist.x;
  const palmY = palmBase.y - wrist.y;

  // Angle par rapport à la verticale (en degrés)
  // 0° = paume vers le bas, 90° = paume vers l'avant
  const radians = Math.atan2(palmX, palmY);
  const degrees = (radians * 180) / Math.PI;

  return Math.abs(degrees);
}

function isOverGlass(hand) {
  // Quand le bol est attrapé, on regarde sa position actuelle
  // Sinon, on regarde la position de la main
  const bowlRect = bowl.getBoundingClientRect();
  const glassRect = glass.getBoundingClientRect();
  const margin = 50;

  // Position du centre du bol
  const bowlCenterX = bowlRect.left + bowlRect.width / 2;
  const bowlCenterY = bowlRect.top + bowlRect.height / 2;

  return (
    bowlCenterX > glassRect.left - margin &&
    bowlCenterX < glassRect.right + margin &&
    bowlCenterY > glassRect.top - margin &&
    bowlCenterY < glassRect.bottom + margin
  );
}

function animatePour(progress) {
  // Vider le bol progressivement
  const emptyHeight = (startHeight * (100 - progress)) / 100;
  bowlMatchaLayer.style.height = emptyHeight + "px";
  bowlWaterLayer.style.height = emptyHeight * 0.3 + "px"; // garder ratio

  // Remplir le verre
  const glassHeight = (60 * progress) / 100; // 60px = hauteur max du verre
  glassLiquid.style.height = glassHeight + "px";
}

function finishPour() {
  pourProgress = 100;
  glass.classList.add("pour-complete");
  completeCbs.forEach((cb) => cb());
}
