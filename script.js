// Placeholder — sera complété avec voice.js, recipes.js, drag.js, whisk.js

// Curseur gestuel (repris de la base prof)
const cursor = document.getElementById("cursor");

window.onHandUpdate((hand) => {
  const x = hand.x * window.innerWidth;
  const y = hand.y * window.innerHeight;
  cursor.style.left = x + "px";
  cursor.style.top = y + "px";
  cursor.classList.toggle("pinching", hand.isPinching);
});
