// Setup Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'fr-FR';
recognition.continuous = true;
recognition.interimResults = true;

let allRecipes = [];
let recipes = {};
let defaultIngredients = [];
let currentRecipe = null;

async function loadRecipes() {
  try {
    const response = await fetch('store.json');
    const data = await response.json();
    allRecipes = data.drinks || [];
    defaultIngredients = data.ingredients || [];
    
    allRecipes.forEach(recipe => {
      recipes[recipe.id] = recipe;
    });
    
    renderRecipeChips();
    loadIngredients(defaultIngredients);
    
    if (allRecipes.length > 0) {
      selectRecipe(allRecipes[0].id);
    }
  } catch (error) {
    console.error('Error loading recipes:', error);
  }
}

function loadIngredients(ingredients) {
  const ingredientsGrid = document.getElementById('ingredients-grid');
  ingredientsGrid.innerHTML = '';
  
  ingredients.forEach(ingredient => {
    const div = document.createElement('div');
    div.className = 'ingredient';
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
  const micLabel = document.getElementById('mic-label');
  micLabel.textContent = 'en écoute…';
  document.getElementById('mic-status').classList.add('listening');
};

recognition.onend = () => {
  const micLabel = document.getElementById('mic-label');
  micLabel.textContent = 'prêt à écouter';
  document.getElementById('mic-status').classList.remove('listening');
};

recognition.onerror = (event) => {
  const micLabel = document.getElementById('mic-label');
  micLabel.textContent = `erreur: ${event.error}`;
  console.error('Speech recognition error:', event.error);
};

recognition.onresult = (event) => {
  let transcript = '';
  
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcriptPart = event.results[i][0].transcript;
    transcript += transcriptPart;
  }
  
  transcript = transcript.toLowerCase().trim();
  const micLabel = document.getElementById('mic-label');
  
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
    } else {
      micLabel.textContent = 'recette non reconnue, réessayez';
    }
  } else {
    micLabel.textContent = `écoute: "${transcript}"`;
  }
};

function selectRecipe(recipeId) {
  if (!recipes[recipeId]) return;
  
  currentRecipe = recipeId;
  const recipe = recipes[recipeId];
  
  document.querySelectorAll('.recipe-chips .chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.recipe === recipeId);
  });
  
  const recipeStepsSection = document.getElementById('recipe-steps');
  if (recipe.steps && recipe.steps.length > 0) {
    recipeStepsSection.classList.remove('hidden');
    
    const stepsList = document.getElementById('steps-list');
    stepsList.innerHTML = '';
    
    recipe.steps.forEach((step, index) => {
      const li = document.createElement('li');
      li.className = 'step' + (index === 0 ? ' active' : index < 2 ? ' done' : '');
      li.innerHTML = `
        <span class="step-check"></span>
        <span class="step-text">${step.text}</span>
      `;
      stepsList.appendChild(li);
    });
  } else {
    recipeStepsSection.classList.add('hidden');
  }
  
}

function renderRecipeChips() {
  const recipeChips = document.querySelector('.recipe-chips');
  recipeChips.innerHTML = '';
  
  allRecipes.forEach((recipe, index) => {
    const button = document.createElement('button');
    button.className = 'chip' + (index === 0 ? ' active' : '');
    button.dataset.recipe = recipe.id;
    button.textContent = recipe.name;
    button.addEventListener('click', (e) => {
      selectRecipe(recipe.id);
    });
    recipeChips.appendChild(button);
  });
}

loadRecipes().then(() => {
  console.log('Recipes loaded, starting speech recognition...');
  recognition.start();
});


const cursor = document.getElementById("cursor");

window.onHandUpdate((hand) => {
  const x = hand.x * window.innerWidth;
  const y = hand.y * window.innerHeight;
  cursor.style.left = x + "px";
  cursor.style.top = y + "px";
  cursor.classList.toggle("pinching", hand.isPinching);
});
