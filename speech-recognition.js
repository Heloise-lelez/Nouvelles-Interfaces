// Setup Web Speech API
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = "fr-FR";
recognition.continuous = true;
recognition.interimResults = true;

let allRecipes = [];
let recipes = {};
let currentRecipeId = null;

async function loadRecipes() {
  try {
    const response = await fetch("store.json");
    const data = await response.json();
    allRecipes = data.recipes || [];

    allRecipes.forEach((recipe) => {
      recipes[recipe.id] = recipe;
    });

    renderRecipeChips();

    if (allRecipes.length > 0) {
      selectRecipe(allRecipes[0].id);
    }
  } catch (error) {
    console.error("Error loading recipes:", error);
  }
}

function loadIngredients(ingredients) {
  const ingredientsGrid = document.getElementById("ingredients-grid");
  ingredientsGrid.innerHTML = "";

  ingredients.forEach((ingredient) => {
    const div = document.createElement("div");
    div.className = "ingredient";
    div.dataset.id = ingredient.id;
    div.id = `ingr-${ingredient.id}`;
    div.innerHTML = `
      <div class="ingredient-visual ${ingredient.id}-visual"></div>
      <div class="ingredient-name">${ingredient.name}</div>
      <div class="ingredient-qty">${ingredient.qty}</div>
      <div class="ingredient-used-badge">ajouté</div>
    `;
    ingredientsGrid.appendChild(div);
  });
}

recognition.onstart = () => {
  const micLabel = document.getElementById("mic-label");
  micLabel.textContent = "en écoute…";
  document.getElementById("mic-status").classList.add("listening");
};

recognition.onend = () => {
  const micLabel = document.getElementById("mic-label");
  micLabel.textContent = "prêt à écouter";
  document.getElementById("mic-status").classList.remove("listening");
};

recognition.onerror = (event) => {
  const micLabel = document.getElementById("mic-label");
  micLabel.textContent = `erreur: ${event.error}`;
  console.error("Speech recognition error:", event.error);
};

recognition.onresult = (event) => {
  let transcript = "";

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcriptPart = event.results[i][0].transcript;
    transcript += transcriptPart;
  }

  transcript = transcript.toLowerCase().trim();
  const micLabel = document.getElementById("mic-label");

  if (event.results[event.results.length - 1].isFinal) {
    micLabel.textContent = `vous avez dit: "${transcript}"`;

    let matchedRecipe = null;

    for (const recipe of allRecipes) {
      for (const keyword of recipe.keywords) {
        if (transcript.includes(keyword.toLowerCase())) {
          matchedRecipe = recipe.id;
          break;
        }
      }
      if (matchedRecipe) break;
    }

    if (matchedRecipe) {
      selectRecipe(matchedRecipe);
      micLabel.textContent = `${recipes[matchedRecipe].name} sélectionné! 🎯`;
      loadIngredients(recipes[matchedRecipe].ingredients);
    } else {
      micLabel.textContent = "recette non reconnue, réessayez";
    }
  } else {
    micLabel.textContent = `écoute: "${transcript}"`;
  }
};

function selectRecipe(recipeId) {
  if (!recipes[recipeId]) return;

  currentRecipeId = recipeId;
  const recipe = recipes[recipeId];

  document.querySelectorAll(".recipe-chips .chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.recipe === recipeId);
  });

  const recipeStepsSection = document.getElementById("recipe-steps");
  if (recipe.steps && recipe.steps.length > 0) {
    recipeStepsSection.classList.remove("hidden");

    const stepsList = document.getElementById("steps-list");
    stepsList.innerHTML = "";

    recipe.steps.forEach((step, index) => {
      const li = document.createElement("li");
      li.className = index === 0 ? "step active" : "step";
      li.innerHTML = `
        <span class="step-check"></span>
        <span class="step-text">${step.text}</span>
      `;
      stepsList.appendChild(li);
    });
  } else {
    recipeStepsSection.classList.add("hidden");
  }

  // Charger les ingrédients seulement quand on change de recette
  loadIngredients(recipe.ingredients);
}

function renderRecipeChips() {
  const recipeChips = document.querySelector(".recipe-chips");
  recipeChips.innerHTML = "";

  allRecipes.forEach((recipe, index) => {
    const button = document.createElement("button");
    button.className = "chip" + (index === 0 ? " active" : "");
    button.dataset.recipe = recipe.id;
    button.textContent = recipe.name;
    button.addEventListener("click", (e) => {
      selectRecipe(recipe.id);
    });
    recipeChips.appendChild(button);
  });
}

export const initLoadRecipes = () => {
  loadRecipes().then(() => {
    console.log("Recipes loaded, starting speech recognition...");
    recognition.start();
  });
};

export function getCurrentRecipe() {
  return currentRecipeId ? recipes[currentRecipeId] : null;
}

export function getCurrentRecipeId() {
  return currentRecipeId;
}

export function getRecipes() {
  return recipes;
}

export function resetSpeechRecognition() {
  console.log("Réinitialisation de la reconnaissance vocale...");
  try {
    recognition.stop();
    recognition.abort();
  } catch (e) {
    console.warn("Erreur lors de l'arrêt de la reconnaissance:", e);
  }

  // Réinitialiser les propriétés
  recognition.lang = "fr-FR";
  recognition.continuous = true;
  recognition.interimResults = true;

  // Redémarrer
  try {
    recognition.start();
    const micLabel = document.getElementById("mic-label");
    if (micLabel) micLabel.textContent = "en écoute…";
  } catch (e) {
    console.warn("Erreur lors du redémarrage de la reconnaissance:", e);
  }
}

export function resetAndSelectRecipe(recipeId) {
  if (!recipes[recipeId]) {
    recipeId = allRecipes[0].id;
  }

  if (finishRecognition) {
    finishRecognition.stop();
    finishRecognition = null;
  }

  const finishOverlay = document.getElementById("finish-overlay");
  if (finishOverlay) finishOverlay.classList.add("hidden");

  selectRecipe(recipeId);

  recognition.start();
  window.dispatchEvent(new Event("recipeReset"));
}

function updateFinishMessage() {
  const recipe = getCurrentRecipe();
  if (!recipe) return;

  const finishText = document.querySelector("#finish-card > p");
  if (finishText) {
    finishText.textContent = `Votre ${recipe.name} est prêt.`;
  }
}

let finishRecognition = null;

export function initFinishRecognition() {
  updateFinishMessage();

  if (finishRecognition) return;

  finishRecognition = new SpeechRecognition();
  finishRecognition.lang = "fr-FR";
  finishRecognition.continuous = true;
  finishRecognition.interimResults = true;

  const finishMicLabel = document.getElementById("finish-mic-label");

  finishRecognition.onstart = () => {
    if (finishMicLabel) finishMicLabel.textContent = "en écoute…";
  };

  finishRecognition.onend = () => {
    if (finishMicLabel) finishMicLabel.textContent = "Dites 'nouvelle recette'";
  };

  finishRecognition.onerror = (event) => {
    if (finishMicLabel) finishMicLabel.textContent = `erreur: ${event.error}`;
    console.error("Finish speech recognition error:", event.error);
  };

  finishRecognition.onresult = (event) => {
    let transcript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcriptPart = event.results[i][0].transcript;
      transcript += transcriptPart;
    }

    transcript = transcript.toLowerCase().trim();

    if (event.results[event.results.length - 1].isFinal) {
      if (finishMicLabel)
        finishMicLabel.textContent = `vous avez dit: "${transcript}"`;

      if (
        transcript.includes("nouvelle recette") ||
        transcript.includes("nouvelle")
      ) {
        if (finishMicLabel)
          finishMicLabel.textContent = "Nouvelle recette en cours…";
        const randomRecipe =
          allRecipes[Math.floor(Math.random() * allRecipes.length)];
        setTimeout(() => resetAndSelectRecipe(randomRecipe.id), 500);
        return;
      }

      for (const recipe of allRecipes) {
        if (
          transcript.includes(recipe.name.toLowerCase()) ||
          recipe.keywords.some((kw) => transcript.includes(kw.toLowerCase()))
        ) {
          if (finishMicLabel)
            finishMicLabel.textContent = `${recipe.name} en cours…`;
          setTimeout(() => resetAndSelectRecipe(recipe.id), 500);
          return;
        }
      }

      if (finishMicLabel)
        finishMicLabel.textContent =
          "Dites 'nouvelle recette' ou le nom d'une recette";
    }
  };

  finishRecognition.start();
}
