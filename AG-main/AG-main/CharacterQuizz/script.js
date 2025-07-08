// === MENU & THEME ===
document.getElementById("back-to-menu").addEventListener("click", function() {
  window.location.href = "../index.html";
});
document.getElementById("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
});
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") document.body.classList.add("light");
});

// === MODE PARCOURS ? ===
const urlParams = new URLSearchParams(window.location.search);
const isParcours = urlParams.get("parcours") === "1";
const parcoursCount = parseInt(urlParams.get("count") || "1", 10);
let parcoursIndex = 0;
let parcoursTotalScore = 0;

// === DAILY SYSTEME ===
let isDaily = !isParcours; // force le mode classic en parcours
const DAILY_BANNER = document.getElementById("daily-banner");
const DAILY_STATUS = document.getElementById("daily-status");
const DAILY_SCORE = document.getElementById("daily-score");
const SWITCH_MODE_BTN = document.getElementById("switch-mode-btn");

function getGameSeed(gameName, year, month, day) {
  let str = `${gameName}_${year}_${month}_${day}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
  return Math.abs(hash) >>> 0;
}
function seededRandom(seed) {
  return function() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;
}
const SCORE_KEY = `dailyScore_characterquizz_${todayKey()}`;
const CHARACTER_KEY = `daily_characterquizz_id_${todayKey()}`;
const STARTED_KEY = `dailyStarted_characterquizz_${todayKey()}`;

let dailyPlayed = false;
let dailyScore = null;

// === VARIABLES & DOM ===
const container = document.getElementById("character-container");
const feedback = document.getElementById("feedback");
const timerDisplay = document.getElementById("timer");
const input = document.getElementById("characterInput");
const submitBtn = document.getElementById("submit-btn");
const restartBtn = document.getElementById("restart-btn");
const suggestions = document.getElementById("suggestions");

let allAnimes = [];
let currentAnime = null;
let revealedCount = 0;
let gameEnded = false;
let countdown = 5;
let countdownInterval = null;

// === PARCOURS STATE ===
let parcoursPool = []; // Liste d'animes restants (pour éviter doublons en parcours)

// ---- DAILY LOGIC / MODE SWITCH ----
if (SWITCH_MODE_BTN) {
  SWITCH_MODE_BTN.onclick = () => {
    isDaily = !isDaily;
    startNewGame();
  };
}
function updateSwitchModeBtn() {
  if (!SWITCH_MODE_BTN) return;
  if (isDaily) {
    SWITCH_MODE_BTN.textContent = "Passer en mode Classic";
    SWITCH_MODE_BTN.style.backgroundColor = "#42a5f5";
  } else {
    SWITCH_MODE_BTN.textContent = "Revenir au Daily";
    SWITCH_MODE_BTN.style.backgroundColor = "#00bcd4";
  }
}
function showDailyBanner() {
  if (!DAILY_BANNER) return;
  DAILY_BANNER.style.display = "flex";
  updateSwitchModeBtn();
  if (dailyPlayed) {
    DAILY_STATUS.innerHTML = `<input type='checkbox' checked disabled style='accent-color:#38d430; margin-right:6px;vertical-align:-3px;'> <b>Daily du jour déjà jouée !</b>`;
    DAILY_SCORE.innerHTML = `Score : <b>${dailyScore} pts</b>`;
  } else {
    DAILY_STATUS.innerHTML = `<span style="font-size:1.25em;vertical-align:-2px;">🎲</span> <b>Daily du jour :</b>`;
    DAILY_SCORE.innerHTML = "";
  }
}

// ---- CHARGEMENT DATA ----
async function loadAnimes() {
  try {
    const response = await fetch('../data/animes.json');
    allAnimes = await response.json();
    if (isParcours) {
      parcoursIndex = 0;
      parcoursTotalScore = 0;
      parcoursPool = [...allAnimes];
      startNewParcoursRound();
    } else {
      startNewGame();
    }
  } catch (error) {
    timerDisplay.textContent = "Erreur de chargement des données.";
    console.error(error);
  }
}

// --- START/RESET/CLASSIC/DAILY ---
function startNewGame() {
  dailyScore = localStorage.getItem(SCORE_KEY);
  dailyPlayed = !!dailyScore;

  if (isDaily && allAnimes.length > 0) {
    if (localStorage.getItem(STARTED_KEY) && !localStorage.getItem(SCORE_KEY)) {
      dailyPlayed = true;
      dailyScore = 0;
      showDailyBanner();
      showSuccessDailyMsg();
      blockInputs();
      return;
    }

    let animeIdx;
    if (!localStorage.getItem(CHARACTER_KEY)) {
      const d = new Date();
      const seed = getGameSeed("characterquizz", d.getFullYear(), d.getMonth()+1, d.getDate());
      const rand = seededRandom(seed)();
      animeIdx = Math.floor(rand * allAnimes.length);
      localStorage.setItem(CHARACTER_KEY, animeIdx);
    } else {
      animeIdx = parseInt(localStorage.getItem(CHARACTER_KEY));
    }
    currentAnime = allAnimes[animeIdx];
    localStorage.setItem(STARTED_KEY, "1");
    showDailyBanner();
    if (dailyPlayed) {
      showSuccessDailyMsg();
      blockInputs();
      return;
    }
  } else if (allAnimes.length > 0) {
    currentAnime = allAnimes[Math.floor(Math.random() * allAnimes.length)];
    if (DAILY_BANNER) DAILY_BANNER.style.display = "none";
    unlockClassicInputs();
  }

  // Reset de tout
  container.innerHTML = '';
  feedback.textContent = '';
  feedback.className = "";
  revealedCount = 0;
  gameEnded = false;
  restartBtn.style.display = 'none';

  // Affiche tous les persos mais masqués
  currentAnime.characters.forEach((char, i) => {
    const img = document.createElement("img");
    img.src = char.image;
    img.alt = char.name;
    img.className = "character-img";
    img.id = "char-" + i;
    img.style.display = "none";
    container.appendChild(img);
  });

  revealNextCharacter();

  input.disabled = false;
  input.value = '';
  submitBtn.disabled = true;
  input.focus();

  suggestions.innerHTML = '';
  timerDisplay.textContent = '';
  clearInterval(countdownInterval);
  resetTimer();
}

// === MODE PARCOURS : round par round ===
function startNewParcoursRound() {
  // Masque le header "menu" en mode parcours (optionnel)
  document.getElementById("back-to-menu").style.display = "none";
  if (DAILY_BANNER) DAILY_BANNER.style.display = "none";

  // Choix sans doublon pour chaque round (prend au hasard dans le pool)
  if (parcoursPool.length === 0 || parcoursIndex >= parcoursCount) {
    showFinalRecapParcours();
    return;
  }
  currentAnime = parcoursPool.splice(Math.floor(Math.random() * parcoursPool.length), 1)[0];

  // Reset
  container.innerHTML = '';
  feedback.textContent = '';
  feedback.className = "";
  revealedCount = 0;
  gameEnded = false;
  restartBtn.style.display = 'none';

  currentAnime.characters.forEach((char, i) => {
    const img = document.createElement("img");
    img.src = char.image;
    img.alt = char.name;
    img.className = "character-img";
    img.id = "char-" + i;
    img.style.display = "none";
    container.appendChild(img);
  });

  revealNextCharacter();

  input.disabled = false;
  input.value = '';
  submitBtn.disabled = true;
  input.focus();

  suggestions.innerHTML = '';
  timerDisplay.textContent = '';
  clearInterval(countdownInterval);
  resetTimer();
}

// --- VICTOIRE (Daily) ---
function showSuccessDailyMsg() {
  feedback.innerHTML = `<input type='checkbox' checked disabled style='accent-color:#38d430; margin-right:6px;vertical-align:-2px;'> <b>Daily du jour déjà jouée !</b> Score : <b>${dailyScore} pts</b>`;
  feedback.className = "success";
  restartBtn.textContent = "Retour menu";
  restartBtn.style.display = 'inline-block';
  timerDisplay.textContent = "";
}

// --- BLOQUER LES ENTRÉES ---
function blockInputs() {
  input.disabled = true;
  submitBtn.disabled = true;
  suggestions.innerHTML = '';
  restartBtn.textContent = "Retour menu";
  restartBtn.style.display = 'inline-block';
}

// --- DÉBLOQUER EN CLASSIC ---
function unlockClassicInputs() {
  input.disabled = false;
  submitBtn.disabled = true;
  restartBtn.textContent = "Rejouer";
  restartBtn.style.display = "none";
}

// --- SUGGESTIONS ---
input.addEventListener("input", function() {
  if (gameEnded || (isDaily && dailyPlayed)) return;
  const val = this.value.toLowerCase();
  suggestions.innerHTML = '';
  feedback.textContent = '';
  submitBtn.disabled = true;
  if (!val) return;
  const found = [...new Set(allAnimes.map(a => a.title))]
    .filter(title => title.toLowerCase().includes(val))
    .slice(0, 7);

  found.forEach(title => {
    const div = document.createElement("div");
    div.innerHTML = `<span>${title.replace(new RegExp(val, 'i'), match => `<b>${match}</b>`)}</span>`;
    div.addEventListener("mousedown", function(e) {
      e.preventDefault();
      input.value = title;
      suggestions.innerHTML = "";
      submitBtn.disabled = false;
      input.focus();
    });
    suggestions.appendChild(div);
  });

  const titles = allAnimes.map(a => a.title.toLowerCase());
  submitBtn.disabled = !titles.includes(val) || (isDaily && dailyPlayed);
});
input.addEventListener("keydown", function(e) {
  if (e.key === "Enter" && !submitBtn.disabled && !gameEnded && !(isDaily && dailyPlayed)) {
    if (isParcours) {
      checkGuessParcours();
    } else {
      checkGuess();
    }
  }
});
submitBtn.addEventListener("click", () => {
  if (isParcours) checkGuessParcours();
  else checkGuess();
});
restartBtn.addEventListener("click", function() {
  if (isParcours) {
    // En mode parcours, ce bouton sert à "Suivant" ou "Terminer"
    if (parcoursIndex < parcoursCount - 1) {
      parcoursIndex++;
      startNewParcoursRound();
    } else {
      showFinalRecapParcours();
    }
  } else if (isDaily && dailyPlayed) {
    window.location.href = "../index.html";
  } else {
    startNewGame();
  }
});

// --- REVEAL UN PERSO ---
function revealNextCharacter() {
  if (revealedCount < currentAnime.characters.length) {
    const img = document.getElementById("char-" + revealedCount);
    if (img) img.style.display = "block";
    revealedCount++;
    resetTimer();
  }
}

// --- TIMER ---
function resetTimer() {
  countdown = 5;
  timerDisplay.textContent = `Temps restant : ${countdown} s`;
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      if (!gameEnded) {
        if (revealedCount === currentAnime.characters.length) {
          if (isParcours) {
            showFeedbackParcours(false);
          } else if (isDaily && !dailyPlayed) {
            localStorage.setItem(SCORE_KEY, 0);
            dailyPlayed = true;
            dailyScore = 0;
            showDailyBanner();
            feedback.textContent = `⏰ Temps écoulé ! Tu as perdu. C'était "${currentAnime.title}".`;
            feedback.className = "error";
            endGame();
          } else {
            feedback.textContent = `⏰ Temps écoulé ! Tu as perdu. C'était "${currentAnime.title}".`;
            feedback.className = "error";
            endGame();
          }
        } else {
          revealNextCharacter();
        }
      }
    } else {
      timerDisplay.textContent = `Temps restant : ${countdown} s`;
    }
  }, 1000);
}

// --- VALIDATION CLASSIC/DAILY ---
function checkGuess() {
  if (gameEnded || (isDaily && dailyPlayed)) return;
  const guess = input.value.trim();
  if (!guess) {
    feedback.textContent = "⚠️ Tu dois écrire un nom d'anime.";
    feedback.className = "error";
    return;
  }
  const normalizedGuess = guess.toLowerCase();
  const answer = currentAnime.title.toLowerCase();

  if (normalizedGuess === answer) {
    feedback.textContent = `🎉 Bonne réponse ! C'était bien "${currentAnime.title}"`;
    feedback.className = "success";
    clearInterval(countdownInterval);
    for (let i = revealedCount; i < currentAnime.characters.length; i++) {
      document.getElementById("char-" + i).style.display = "block";
    }
    if (isDaily && !dailyPlayed) {
      let malus = (revealedCount - 1) * 500;
      let score = Math.max(3000 - malus, 0);
      localStorage.setItem(SCORE_KEY, score);
      dailyPlayed = true;
      dailyScore = score;
      showDailyBanner();
      restartBtn.textContent = "Retour menu";
    } else {
      restartBtn.textContent = "Rejouer";
    }
    endGame();
  } else {
    feedback.textContent = "❌ Mauvaise réponse.";
    feedback.className = "error";
    if (revealedCount < currentAnime.characters.length) {
      clearInterval(countdownInterval);
      revealNextCharacter();
    } else {
      if (isDaily && !dailyPlayed) {
        localStorage.setItem(SCORE_KEY, 0);
        dailyPlayed = true;
        dailyScore = 0;
        showDailyBanner();
      }
      feedback.textContent += ` Tu as épuisé tous les indices. C'était "${currentAnime.title}".`;
      endGame();
    }
  }
  input.value = '';
  submitBtn.disabled = true;
  input.focus();
  suggestions.innerHTML = '';
}

// --- VALIDATION PARCOURS ---
function checkGuessParcours() {
  if (gameEnded) return;
  const guess = input.value.trim();
  if (!guess) {
    feedback.textContent = "⚠️ Tu dois écrire un nom d'anime.";
    feedback.className = "error";
    return;
  }
  const normalizedGuess = guess.toLowerCase();
  const answer = currentAnime.title.toLowerCase();

  if (normalizedGuess === answer) {
    showFeedbackParcours(true);
  } else {
    feedback.textContent = "❌ Mauvaise réponse.";
    feedback.className = "error";
    if (revealedCount < currentAnime.characters.length) {
      clearInterval(countdownInterval);
      revealNextCharacter();
    } else {
      showFeedbackParcours(false);
    }
  }
  input.value = '';
  submitBtn.disabled = true;
  input.focus();
  suggestions.innerHTML = '';
}

// --- FIN ROUND PARCOURS ---
function showFeedbackParcours(isWin) {
  clearInterval(countdownInterval);
  for (let i = revealedCount; i < currentAnime.characters.length; i++) {
    document.getElementById("char-" + i).style.display = "block";
  }
  let roundScore = 0;
  if (isWin) {
    let malus = (revealedCount - 1) * 500;
    roundScore = Math.max(3000 - malus, 0);
    feedback.textContent = `🎉 Bonne réponse ! "${currentAnime.title}" | Score : ${roundScore}`;
    feedback.className = "success";
  } else {
    feedback.textContent = `❌ Perdu. C'était "${currentAnime.title}". | Score : 0`;
    feedback.className = "error";
  }
  parcoursTotalScore += roundScore;
  endGameParcours();
}

// --- FIN JEU/ROUND ---
function endGame() {
  gameEnded = true;
  input.disabled = true;
  submitBtn.disabled = true;
  restartBtn.style.display = 'inline-block';
  timerDisplay.textContent = "Jeu terminé.";
  suggestions.innerHTML = '';
}
function endGameParcours() {
  gameEnded = true;
  input.disabled = true;
  submitBtn.disabled = true;
  restartBtn.style.display = 'inline-block';
  timerDisplay.textContent = "Round terminé.";
  suggestions.innerHTML = '';
  if (parcoursIndex < parcoursCount - 1) {
    restartBtn.textContent = "Suivant";
  } else {
    restartBtn.textContent = "Terminer";
  }
}

// --- RECAP FINAL PARCOURS ---
function showFinalRecapParcours() {
  container.innerHTML = '';
  feedback.innerHTML = `<div style="font-size:1.3em;">🏆 Parcours terminé !<br>Score total : <b>${parcoursTotalScore}</b> / ${parcoursCount * 3000}</div>`;
  feedback.className = "success";
  timerDisplay.textContent = "";
  restartBtn.style.display = "none";
  // Envoie le score final au parent
  setTimeout(() => {
    parent.postMessage({
      parcoursScore: {
        label: "Character Quizz",
        score: parcoursTotalScore,
        total: parcoursCount * 3000
      }
    }, "*");
  }, 300);
}

// --- LANCE LE CHARGEMENT AU DÉMARRAGE ---
loadAnimes();
