const TARGET_KEYWORD = "japon";
const TARGET_URL = "/cooking";

const statusElement = document.createElement('div');
statusElement.style.position = 'fixed';
statusElement.style.bottom = '80px';
statusElement.style.left = '50%';
statusElement.style.transform = 'translateX(-50%)';
statusElement.style.background = 'rgba(92, 138, 74, 0.9)';
statusElement.style.color = '#fff';
statusElement.style.padding = '8px 16px';
statusElement.style.borderRadius = '20px';
statusElement.style.fontSize = '12px';
statusElement.style.fontFamily = '"DM Sans", sans-serif';
statusElement.style.letterSpacing = '0.05em';
statusElement.style.opacity = '0';
statusElement.style.transition = 'opacity 0.3s';
statusElement.style.zIndex = '1000';
statusElement.textContent = "Écoute active : dites 'Pâtissez'";
document.body.appendChild(statusElement);

setTimeout(() => { statusElement.style.opacity = '1'; }, 1000);

let fallbackTimer = setTimeout(() => {
  const btn = document.createElement('button');
  btn.textContent = "🎙️ Problème micro ? Cliquez ici pour entrer";
  btn.style.position = 'fixed';
  btn.style.bottom = '30px';
  btn.style.left = '50%';
  btn.style.transform = 'translateX(-50%)';
  btn.style.padding = '12px 24px';
  btn.style.background = '#fff';
  btn.style.border = '1px solid #5c8a4a';
  btn.style.color = '#5c8a4a';
  btn.style.borderRadius = '30px';
  btn.style.cursor = 'pointer';
  btn.style.fontFamily = '"DM Sans", sans-serif';
  btn.style.fontWeight = '600';
  btn.style.zIndex = '1000';
  btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
  btn.onclick = () => window.location.href = TARGET_URL;
  document.body.appendChild(btn);

  btn.style.opacity = '0';
  btn.style.transform = 'translateX(-50%) translateY(20px)';
  setTimeout(() => {
    btn.style.transition = 'all 0.4s ease';
    btn.style.opacity = '1';
    btn.style.transform = 'translateX(-50%) translateY(0)';
  }, 50);
}, 6000);

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  console.warn("Reconnaissance vocale non supportée par ce navigateur.");
  statusElement.textContent = "Navigateur non compatible. Utilisez Chrome ou Edge.";
  statusElement.style.background = "#d32f2f";
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.continuous = true;
  recognition.interimResults = true;

  let isListening = true;

  recognition.onstart = () => {
    console.log("Reconnaissance vocale démarrée.");
    statusElement.textContent = "🎤 Écoute active...";
  };

  recognition.onresult = (event) => {
    const lastResultIndex = event.results.length - 1;
    const transcript = event.results[lastResultIndex][0].transcript.toLowerCase().trim();

    const cleanTranscript = transcript.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");

    console.log("Entendu :", cleanTranscript);

    if (cleanTranscript.includes(TARGET_KEYWORD)) {
      console.log("Mot clé détecté ! Redirection...");
      statusElement.textContent = "✨ C'est parti !";
      statusElement.style.background = "#5c8a4a";

      clearTimeout(fallbackTimer);

      setTimeout(() => {
        window.location.href = TARGET_URL;
      }, 600);
    }
  };

  recognition.onerror = (event) => {
    console.error("Erreur de reconnaissance :", event.error);
    if (event.error === 'no-speech') {
      return;
    }

    if (event.error === 'not-allowed') {
      statusElement.textContent = "❌ Microphone bloqué. Veuillez l'autoriser.";
      statusElement.style.background = "#d32f2f";
      isListening = false;
    } else {
      statusElement.textContent = "⚠️ Erreur réseau. Réécoute...";
      setTimeout(() => {
        if(isListening) {
          try { recognition.start(); } catch(e) {}
        }
      }, 1000);
    }
  };

  recognition.onend = () => {
    if (isListening) {
      console.log("La reconnaissance s'est arrêtée. Tentative de redémarrage...");
      setTimeout(() => {
        try { recognition.start(); } catch(e) {}
      }, 500);
    }
  };

  try {
    recognition.start();
  } catch (e) {
    console.error("Impossible de démarrer la reconnaissance :", e);
    statusElement.textContent = "Erreur de démarrage.";
  }
}