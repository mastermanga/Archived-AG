// ========== DARK/LIGHT MODE + MENU ==========
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
  if (savedTheme === "light") {
    document.body.classList.add("light");
  }
});

// ========= DAILY SEEDING LOGIC (simpleHash + GAME_ID) ==========
const GAME_ID = "anidle"; // CHANGE CE NOM si tu clones pour un autre jeu !
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & 0xFFFFFFFF;
  }
  return Math.abs(hash);
}
function getDailyIndex(len) {
  const d = new Date();
  const dateStr = d.getFullYear() + "-" + (d.getMonth()+1).toString().padStart(2,"0") + "-" + d.getDate().toString().padStart(2,"0");
  const hash = simpleHash(dateStr + "|" + GAME_ID);
  return hash % len;
}
function seededRandom(seed) {
  return function() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// ========== ANIMEDLE GAME (MODE DAILY/CLASSIC/PARCOURS) ==========
let animeData = [];
let targetAnime = null;
let attemptCount = 0;
let gameOver = false;
let indiceStep = 0;

// -- Mode switch --
let isDaily = true;
const DAILY_BANNER = document.getElementById("daily-banner");
const DAILY_STATUS = document.getElementById("daily-status");
const DAILY_SCORE = document.getElementById("daily-score");
const SWITCH_MODE_BTN = document.getElementById("switch-mode-btn");

const today = new Date();
const todayString = today.toISOString().split('T')[0];
const SCORE_KEY = `dailyScore_${GAME_ID}_${todayString}`;
const STARTED_KEY = `dailyStarted_${GAME_ID}_${todayString}`;

let dailyPlayed = false;
let dailyScore = null;

// ======== MODE PARCOURS (iframe) ========
const urlParams = new URLSearchParams(window.location.search);
const isParcours = urlParams.get("parcours") === "1";
const parcoursCount = parseInt(urlParams.get("count") || "1", 10);
let parcoursIndex = 0;
let parcoursTotalScore = 0;

// ========== DATA LOAD ================
fetch('../data/animes.json')
  .then(response => response.json())
  .then(data => {
    animeData = data;
    if (isParcours) {
      document.getElementById("back-to-menu").style.display = "none";
      isDaily = false;
      parcoursIndex = 0;
      parcoursTotalScore = 0;
      if (DAILY_BANNER) DAILY_BANNER.style.display = "none";
      launchParcoursRound();
    } else {
      setupGame();
    }
  });

function setupGame() {
  dailyScore = localStorage.getItem(SCORE_KEY);
  dailyPlayed = !!dailyScore;

  // Si le daily a déjà été commencé mais pas fini, c'est perdu : score 0 et bloqué
  if (isDaily && localStorage.getItem(STARTED_KEY) && !localStorage.getItem(SCORE_KEY)) {
    dailyPlayed = true;
    dailyScore = 0;
    showDailyBanner();
    lockDailyInputs();
    gameOver = true;
    return;
  }

  if (isDaily) {
    let animeIdx = getDailyIndex(animeData.length);
    targetAnime = animeData[animeIdx];
    showDailyBanner();
    if (dailyPlayed) {
      lockDailyInputs();
      gameOver = true;
      return;
    }
    // Marque le daily comme démarré (dès l'affichage du daily)
    localStorage.setItem(STARTED_KEY, "1");
  } else {
    targetAnime = animeData[Math.floor(Math.random() * animeData.length)];
    if (DAILY_BANNER) DAILY_BANNER.style.display = "none";
    unlockClassicInputs();
  }

  attemptCount = 0;
  gameOver = false;
  indiceStep = 0;
  document.getElementById("animeInput").value = "";
  document.getElementById("suggestions").innerHTML = "";
  document.getElementById("results").innerHTML = "";
  document.getElementById("counter").textContent = "Tentatives : 0";
  document.getElementById("indicesContainer").style.display = "none";
  document.getElementById("indiceBtn").style.display = "inline-block";
  document.getElementById("successContainer").style.display = "none";
}

// --- BANDEAU DAILY ---
function showDailyBanner() {
  if (!DAILY_BANNER) return;
  DAILY_BANNER.style.display = "block";
  updateSwitchModeBtn();
  if (dailyPlayed) {
    const saved = localStorage.getItem(SCORE_KEY);
    DAILY_STATUS.textContent = "✅ Daily du jour déjà jouée !";
    DAILY_SCORE.textContent = saved ? `Score : ${saved} pts` : "Score : 0 pts";
  } else {
    DAILY_STATUS.textContent = "🎲 Daily du jour :";
    DAILY_SCORE.textContent = "";
  }
}

function updateSwitchModeBtn() {
  if (!SWITCH_MODE_BTN) return;
  if (isDaily) {
    SWITCH_MODE_BTN.textContent = "Passer en mode Classique";
    SWITCH_MODE_BTN.style.backgroundColor = "#42a5f5";
  } else {
    SWITCH_MODE_BTN.textContent = "Revenir au Daily";
    SWITCH_MODE_BTN.style.backgroundColor = "#00bcd4";
  }
}
if (SWITCH_MODE_BTN) {
  SWITCH_MODE_BTN.onclick = () => {
    isDaily = !isDaily;
    setupGame();
  };
}

function lockDailyInputs() {
  document.getElementById("animeInput").disabled = true;
  document.getElementById("indiceBtn").disabled = true;
  if (DAILY_BANNER) {
    DAILY_BANNER.style.display = "block";
    showDailyBanner();
  }
}
function unlockClassicInputs() {
  document.getElementById("animeInput").disabled = false;
  document.getElementById("indiceBtn").disabled = false;
}

// ========== SUGGESTIONS AUTO-COMPLETE ==========
document.getElementById("animeInput").addEventListener("input", function() {
  if (isDaily && dailyPlayed) return;
  const input = this.value.toLowerCase();
  const matches = animeData.filter(a => a.title.toLowerCase().includes(input)).slice(0, 5);
  const suggestions = document.getElementById("suggestions");
  suggestions.innerHTML = "";
  matches.forEach(anime => {
    const div = document.createElement("div");
    div.textContent = anime.title;
    div.onclick = () => {
      document.getElementById("animeInput").value = anime.title;
      suggestions.innerHTML = "";
      guessAnime();
    };
    suggestions.appendChild(div);
  });
});

// ========== INDICES ==========
document.getElementById("indiceBtn").addEventListener("click", () => {
  if (!targetAnime) return;
  if (isDaily && dailyPlayed) return;
  indiceStep++;
  if (indiceStep > 5) indiceStep = 5;
  document.getElementById("indicesContainer").style.display = "block";
  if (indiceStep >= 1) document.getElementById("indice1").textContent = targetAnime.genres[0] || "N/A";
  if (indiceStep >= 2) document.getElementById("indice2").textContent = targetAnime.studio || "N/A";
  if (indiceStep >= 3) document.getElementById("indice3").textContent = targetAnime.season || "N/A";
  if (indiceStep >= 4) document.getElementById("indice4").textContent = targetAnime.title.charAt(0) || "N/A";
  if (indiceStep >= 5) {
    const img = document.getElementById("indice5");
    img.src = targetAnime.image;
    img.style.filter = "blur(8px)";
  }
});

// ========== FONCTION PRINCIPALE DE JEU ==========
function guessAnime() {
  if (gameOver || (isDaily && dailyPlayed)) return;

  const input = document.getElementById("animeInput").value.trim();
  const guessedAnime = animeData.find(a => a.title.toLowerCase() === input.toLowerCase());
  if (!guessedAnime) {
    alert("Anime non trouvé !");
    return;
  }

  attemptCount++;
  document.getElementById("counter").textContent = "Tentatives : " + attemptCount;
  updateAideList();

  const results = document.getElementById("results");
  const keyToClass = {
    image: "cell-image",
    title: "cell-title",
    season: "cell-season",
    studio: "cell-studio",
    genresThemes: "cell-genre",
    score: "cell-score"
  };

  if (attemptCount === 1) {
    const header = document.createElement("div");
    header.classList.add("row");
    ["Image", "Titre", "Saison", "Studio", "Genres / Thèmes", "Score"].forEach((label, i) => {
      const cell = document.createElement("div");
      cell.classList.add("cell", Object.values(keyToClass)[i]);
      cell.style.fontWeight = "bold";
      cell.textContent = label;
      header.appendChild(cell);
    });
    results.insertBefore(header, results.firstChild);
  }

  const row = document.createElement("div");
  row.classList.add("row");

  const cellImage = document.createElement("div");
  cellImage.classList.add("cell", keyToClass.image);
  const img = document.createElement("img");
  img.src = guessedAnime.image;
  img.alt = guessedAnime.title;
  img.style.width = "100px";
  cellImage.appendChild(img);
  row.appendChild(cellImage);

  const cellTitle = document.createElement("div");
  cellTitle.classList.add("cell", keyToClass.title);
  const isTitleMatch = guessedAnime.title === targetAnime.title;
  cellTitle.classList.add(isTitleMatch ? "green" : "red");
  cellTitle.textContent = guessedAnime.title;
  row.appendChild(cellTitle);

  const cellSeason = document.createElement("div");
  cellSeason.classList.add("cell", keyToClass.season);
  const [gs, gy] = guessedAnime.season.split(" ");
  const [ts, ty] = targetAnime.season.split(" ");
  if (gs === ts && gy === ty) {
    cellSeason.classList.add("green");
    cellSeason.textContent = `✅ ${guessedAnime.season}`;
  } else if (gy === ty) {
    cellSeason.classList.add("orange");
    cellSeason.textContent = `🟧 ${guessedAnime.season}`;
  } else {
    cellSeason.classList.add("red");
    cellSeason.textContent = parseInt(gy) < parseInt(ty)
      ? `🔼 ${guessedAnime.season}`
      : `${guessedAnime.season} 🔽`;
  }
  row.appendChild(cellSeason);

  const cellStudio = document.createElement("div");
  cellStudio.classList.add("cell", keyToClass.studio);
  const isStudioMatch = guessedAnime.studio === targetAnime.studio;
  cellStudio.classList.add(isStudioMatch ? "green" : "red");
  cellStudio.textContent = guessedAnime.studio;
  row.appendChild(cellStudio);

  const cellGenresThemes = document.createElement("div");
  cellGenresThemes.classList.add("cell", keyToClass.genresThemes);
  const allGuessed = [...guessedAnime.genres, ...guessedAnime.themes];
  const allTarget = [...targetAnime.genres, ...targetAnime.themes];
  const matches = allGuessed.filter(x => allTarget.includes(x));
  if (matches.length === allGuessed.length && matches.length === allTarget.length) {
    cellGenresThemes.classList.add("green");
  } else if (matches.length > 0) {
    cellGenresThemes.classList.add("orange");
  } else {
    cellGenresThemes.classList.add("red");
  }
  cellGenresThemes.innerHTML = allGuessed.join("<br>");
  row.appendChild(cellGenresThemes);

  const cellScore = document.createElement("div");
  cellScore.classList.add("cell", keyToClass.score);
  const g = parseFloat(guessedAnime.score);
  const t = parseFloat(targetAnime.score);
  if (g === t) {
    cellScore.classList.add("green");
    cellScore.textContent = `✅ ${g}`;
  } else {
    cellScore.classList.add("red");
    cellScore.textContent = g < t ? `🔼 ${g}` : `${g} 🔽`;
  }
  row.appendChild(cellScore);

  const header = results.querySelector(".row");
  results.insertBefore(row, header.nextSibling);

  document.getElementById("animeInput").value = "";
  document.getElementById("suggestions").innerHTML = "";

  if (isTitleMatch) {
    gameOver = true;
    document.getElementById("animeInput").disabled = true;
    document.getElementById("indiceBtn").disabled = true;
    document.getElementById("indicesContainer").style.display = "none";
    document.getElementById("indiceBtn").style.display = "none";
    showSuccessMessage();

    if (isDaily && !dailyPlayed) {
      let score = 3000;
      score -= (attemptCount - 1) * 100;
      score -= (indiceStep) * 1000;
      if (score < 0) score = 0;
      localStorage.setItem(SCORE_KEY, score);
      dailyPlayed = true;
      dailyScore = score;
      showDailyBanner();
    }
    launchFireworks();
  }
}

// ========== Suggestions Aide ==========
function updateAideList() {
  const aideDiv = document.getElementById("aideContainer");
  if (attemptCount < 5) {
    aideDiv.innerHTML = "";
    return;
  }

  let filtered = animeData;
  const [season, yearStr] = targetAnime.season.split(" ");
  const targetYear = parseInt(yearStr);

  if (attemptCount >= 25) {
    filtered = filtered.filter(a => a.season === targetAnime.season);
  } else if (attemptCount >= 20) {
    filtered = filtered.filter(a => parseInt(a.season.split(" ")[1]) === targetYear);
  } else if (attemptCount >= 15) {
    filtered = filtered.filter(a => Math.abs(parseInt(a.season.split(" ")[1]) - targetYear) <= 2);
  } else if (attemptCount >= 10) {
    filtered = filtered.filter(a => Math.abs(parseInt(a.season.split(" ")[1]) - targetYear) <= 5);
  }

  aideDiv.innerHTML = `<h3>🔍 Suggestions</h3><ul>` +
    filtered.map(a => `<li onclick="selectFromAide('${a.title.replace(/'/g, "\\'")}')">${a.title}</li>`).join("") +
    `</ul>`;
}

function selectFromAide(title) {
  document.getElementById("animeInput").value = title;
  guessAnime();
}

// ========== Confettis ==========
function launchFireworks() {
  const canvas = document.getElementById("fireworks");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = [];

  function createParticle(x, y) {
    const angle = Math.random() * 2 * Math.PI;
    const speed = Math.random() * 5 + 2;
    return { x, y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, life: 60 };
  }

  for (let i = 0; i < 100; i++) {
    particles.push(createParticle(canvas.width / 2, canvas.height / 2));
  }

  function animate() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 50%)`;
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.05;
      p.life--;
    });
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 0) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  animate();
}

// ========== Message de victoire ==========

function showSuccessMessageClassic() {
  const container = document.getElementById("successContainer");
  container.innerHTML = `
    <div id="winMessage" style="margin-bottom: 18px; font-size: 2rem; font-weight: bold; text-align: center;">
      🎇 <span style="font-size:2.3rem;">🥳</span>
      Bravo ! C'était <u>${targetAnime.title}</u> en ${attemptCount} tentative${attemptCount > 1 ? 's' : ''}.
      <span style="font-size:2.3rem;">🎉</span>
    </div>
    <div style="text-align:center;">
      <button id="nextBtn" style="font-size:1.1rem; margin: 0 auto 1rem auto;">${isDaily ? "Retour menu" : "Rejouer"}</button>
    </div>
  `;
  container.style.display = "block";
  container.scrollIntoView({behavior: "smooth", block: "start"});

  document.getElementById("nextBtn").onclick = () => {
    if (isDaily) {
      window.location.href = "../index.html";
    } else {
      setupGame();
    }
  };
}

// --- Mode Parcours ---
function launchParcoursRound() {
  attemptCount = 0;
  gameOver = false;
  indiceStep = 0;
  document.getElementById("animeInput").value = "";
  document.getElementById("suggestions").innerHTML = "";
  document.getElementById("results").innerHTML = "";
  document.getElementById("counter").textContent = "Tentatives : 0";
  document.getElementById("indicesContainer").style.display = "none";
  document.getElementById("indiceBtn").style.display = "inline-block";
  document.getElementById("successContainer").style.display = "none";
  document.getElementById("animeInput").disabled = false;
  document.getElementById("indiceBtn").disabled = false;
  // PATCH random : random avec parcoursIndex
  const random = seededRandom(Date.now() + parcoursIndex * 37)();
  targetAnime = animeData[Math.floor(random * animeData.length)];
}

function showSuccessMessageParcours(roundScore) {
  document.getElementById("indicesContainer").style.display = "none";
  document.getElementById("indiceBtn").style.display = "none";
  const container = document.getElementById("successContainer");
  container.innerHTML = `
    <div id="winMessage" style="margin-bottom: 18px; font-size: 2rem; font-weight: bold; text-align: center;">
      🎇 <span style="font-size:2.3rem;">🥳</span>
      Bravo ! C'était <u>${targetAnime.title}</u> en ${attemptCount} tentative${attemptCount > 1 ? 's' : ''}.
      <span style="font-size:2.3rem;">🎉</span>
    </div>
    <div style="text-align:center;">
      <button id="nextParcoursBtn" style="font-size:1.1rem; margin: 0 auto 1rem auto;">${parcoursIndex+1 < parcoursCount ? "Suivant" : "Terminer"}</button>
    </div>
  `;
  container.style.display = "block";
  container.scrollIntoView({behavior: "smooth", block: "start"});

  document.getElementById("nextParcoursBtn").onclick = () => {
    parcoursIndex++;
    if (parcoursIndex < parcoursCount) {
      launchParcoursRound();
    } else {
      setTimeout(() => {
        parent.postMessage({
          parcoursScore: {
            label: "Anidle",
            score: parcoursTotalScore,
            total: parcoursCount * 3000
          }
        }, "*");
      }, 400);
      container.innerHTML = `<div style="font-size:1.6rem;text-align:center;">🏆 Parcours terminé !<br>Score : <b>${parcoursTotalScore}</b> / ${parcoursCount*3000}</div>`;
    }
  };
}

// --- Choix du message selon le mode
function showSuccessMessage() {
  let roundScore = 3000 - (attemptCount - 1) * 100 - (indiceStep) * 1000;
  if (roundScore < 0) roundScore = 0;
  if (isParcours) {
    parcoursTotalScore += roundScore;
    showSuccessMessageParcours(roundScore);
    launchFireworks();
  } else {
    showSuccessMessageClassic();
    launchFireworks();
  }
}
