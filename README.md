# Cooking Matcha

## Interface Gestuelle Interactive pour la Préparation de Recettes

![Matcha Bar](https://img.shields.io/badge/Type-Interface%20Gestuelle-00a86b)
![License](https://img.shields.io/badge/License-MIT-blue)

Une application web innovante qui fusionne **reconnaissance gestuelle**, **reconnaissance vocale** et **interactions intuitives** pour préparer des boissons et pâtisseries au matcha. Contrôlez l'application avec vos mains : sans clavier ni souris !

---

## Concept

Cooking Matcha transforme votre webcam en interface naturelle. Suivez les étapes visuelles, utilisez la voix pour sélectionner vos recettes, et manipulez les ingrédients avec des gestes simples et naturels.

**Technologie clé:** [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) pour le suivi des mains en temps réel + Web Speech API

---

## Recettes Disponibles

### 1. **Matcha Latte Froid**

- Matcha tamis + eau chaude + fouettage + glaçons + lait d'avoine + versement
- Parfait pour l'été

### 2. **Matcha Latte Chaud**

- Matcha tamis + eau chaude + fouettage + lait d'avoine + versement
- Classique réconfortant

### 3. **Matcha Cérémonial**

- Recette traditionnelle avec plus de matcha et plus de précision
- Expérience authentique

### 4. **Cookie Matcha**

- Recette complexe avec étapes de mélange, tamis et découpe de chocolat
- Défi complet avec découpe interactive

---

## Interactions Gestuelles

### 1. **Curseur Gestuel**

Votre index devient un curseur en temps réel, suivi par la webcam.

- **Anneau bleu** = zone de détection
- **Point blanc** = position de votre doigt
- **Couleur verte** = pincement détecté

### 2. **Sélection de Recette**

```
Commande: Dites à haute voix le nom d'une recette
Exemple: "Matcha latte froid", "Cookie Matcha", "cérémonie"
```

- L'application reconnaît votre voix en français
- Les recettes s'affichent comme des chips cliquables
- Glissez votre doigt sur la recette souhaitée

### 3. **Drag & Drop**

Manipulez les ingrédients sur l'écran :

- **Geste:** Pincer (thumb + index proches) + glisser
- **Action:** Déplacez l'ingrédient vers sa zone cible
- **Zone cible:** Bol, planche à découper, four, etc.
- **Validation:** Relâchez le pincement pour confirmer le dépôt

### 4. **Fouettage** (Whisk)

Créez la mousse de matcha :

- **Geste:** Gestes rapides en forme de **W** avec votre main
- **Zone:** Au-dessus du bol (zone blanche marquée "whisk")
- **Durée:** Généralement 45-90 secondes selon la recette
- **Feedback:** L'écran se remplit d'animation tant que vous fouettez
- **Complètement automatique:** Stop quand la mousse est parfaite

### 5. **Versement** (Pour)

Versez les liquides :

- **Geste:** Inclinez votre main comme pour verser depuis une théière
- **Position:** Au-dessus du verre (zone marquée)
- **Amplitude:** Plus vous inclinez, plus vite ça verse
- **Complètement automatique:** Stop à la fin du versement

### 6. **Découpe** (Chop)

Hachez le chocolat (Cookie Matcha uniquement) :

- **Geste:** Coups rapides de haut en bas avec votre main
- **Zone:** Au-dessus de la planche à découper (zone marquée)
- **Durée:** ~60 secondes pour tout hacher
- **Feedback:** Voyez le chocolat se découper petit à petit

---

## Flux d'Interaction Complet

```
1. L'app démarre → Caméra activée → Suivi de main actif
   ↓
2. Vous dites une recette → Reconnaissance vocale
   ↓
3. Recette sélectionnée → Étapes affichées dans le panneau gauche
   ↓
4. Pour chaque étape:
   - Lisez l'instruction
   - Performez le geste correspondant
   - L'étape se marque comme complète
   ↓
5. Dernière étape = versement final
   ↓
6. "Félicitations !" → Bouton pour recommencer
```

---

## Démarrage Rapide

### Prérequis

- Navigateur Chrome
- Webcam accessible
- Microphone (pour reconnaissance vocale)
- Connexion internet (pour charger MediaPipe)

### Installation & Lancement

```bash
# Clonez le repo
git clone <repo-url>
cd Cooking-Matcha

# Lancez un serveur local
npx serve .

# Ouvrez dans votre navigateur
# http://localhost:8000
```

### Première Utilisation

1. Acceptez la demande d'accès à la caméra
2. Acceptez la demande d'accès au microphone
3. Montrez votre main à la caméra
4. Dites une recette

---

## Structure du Projet

```
Matcha-Bar/
├── index.html              # Page principale
├── style.css              # Styles (design épuré et moderne)
├── script.js              # Orchestration principale
├── hand-tracking.js       # Suivi gestuel (MediaPipe)
├── speech-recognition.js  # Reconnaissance vocale + recettes
├── drag.js                # Gestion du drag & drop
├── whisk.js               # Détection du fouettage
├── pour.js                # Détection du versement
├── chop.js                # Détection de la découpe
├── oven.js                # Détection du four
├── store.json             # Base de recettes
└── README.md
```

---

## Détails Techniques

### Hand Tracking (MediaPipe)

```javascript
// Détecte jusqu'à 1 main avec 21 points de repère
- Index (8) = curseur
- Pouce (4) = pincement
- Distance < 0.05 = pincement détecté
```

### Gestes Détectés

- **Mouvement**: Suivi continu de l'index
- **Pincement**: Détecte quand index et pouce sont proches
- **Patterns**: W pour fouettage, angle pour versement, mouvements rapides pour découpe

### Speech Recognition

- Français uniquement
- Écoute continue en arrière-plan
- Mots-clés configurables par recette

---

## Points Forts

**Intuitive** - Les gestes miroir l'action réelle (fouetter = fouetter, verser = verser)  
 **Sans contrôle** - Pas de clavier, souris, ni boutons (sauf finish)  
 **Immersive** - Webcam intégrée pour voir ses gestes  
 **Accessible** - Reconnaissance vocale en français  
 **Modulable** - Facile d'ajouter des recettes via store.json

---

## Cas d'Usage

- Apprentissage interactif de la cuisine
- Démonstration pédagogique des gestes
- Gamification culinaire
- Expérience muséale
- Exploration des interfaces gestuelles

---

## Notes

- La reconnaissance vocale fonctionne mieux dans un environnement calme
- Assurez-vous d'une bonne illumination pour le tracking gestuel
- Les gestes doivent être fluides et naturels (l'app ne reconnaît pas les mouvements saccadés)
- Les étapes s'activent dans l'ordre – vous ne pouvez pas les sauter

---

## Licence

MIT License – Libre d'utilisation et de modification

---

**Créé avec ❤️ et beaucoup de matcha par Céline EAP et Héloïse LE LEZ**
