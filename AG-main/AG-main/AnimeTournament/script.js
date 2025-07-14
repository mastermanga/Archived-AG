// Bouton retour au menu
document.getElementById("back-to-menu").addEventListener("click", function() {
  window.location.href = "../index.html";
});

// Bouton changer de thème + persistance
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

(() => {
  // ==== Mode Parcours : lecture URL ====
  const urlParams = new URLSearchParams(window.location.search);
  const isParcours = urlParams.get("parcours") === "1";
  const parcoursCount = parseInt(urlParams.get("count") || "1", 10);
  // Par défaut "anime" mais dans le parcours ça peut être "opening"
  let mode = urlParams.get("mode") || "anime";

  const TOTAL_ITEMS = 16;
  const QUALIFIED_TO_BRACKET = 8;
  const SWISS_ROUNDS = 5; // 5 duels fixes

  let data = [];
  let items = [];

  // Round suisse data
  let swissStats = [];
  let swissMatches = [];
  let swissRound = 0;

  // Bracket data
  let bracketMatches = [];
  let bracketRound = 0;
  let bracketMatchIndex = 0;

  // UI Elements
  const duelContainer = document.querySelector('#duel-container');
  const classementDiv = document.getElementById('classement');
  const modeAnimeBtn = document.getElementById('mode-anime');
  const modeOpeningBtn = document.getElementById('mode-opening');
  const nextMatchBtn = document.getElementById('next-match-btn');
  const modeSelectDiv = document.getElementById('mode-select');

  // GESTION MODES
  if (isParcours) {
    if (modeSelectDiv) modeSelectDiv.style.display = "none";
    modeAnimeBtn.classList.toggle('active', mode === 'anime');
    modeAnimeBtn.setAttribute('aria-pressed', mode === 'anime');
    modeOpeningBtn.classList.toggle('active', mode === 'opening');
    modeOpeningBtn.setAttribute('aria-pressed', mode === 'opening');
  } else {
    modeAnimeBtn.onclick = () => switchMode('anime');
    modeOpeningBtn.onclick = () => switchMode('opening');
  }

  function switchMode(newMode) {
    if (mode === newMode) return;
    mode = newMode;
    modeAnimeBtn.classList.toggle('active', mode === 'anime');
    modeAnimeBtn.setAttribute('aria-pressed', mode === 'anime');
    modeOpeningBtn.classList.toggle('active', mode === 'opening');
    modeOpeningBtn.setAttribute('aria-pressed', mode === 'opening');
    reset();
    loadDataAndStart();
  }

  function reset() {
    data = [];
    items = [];
    swissStats = [];
    swissMatches = [];
    bracketMatches = [];
    bracketRound = 0;
    bracketMatchIndex = 0;
    swissRound = 0;
    duelContainer.innerHTML = '';
    duelContainer.style.display = '';
    classementDiv.innerHTML = '';
    if (nextMatchBtn) nextMatchBtn.style.display = "none";
    document.querySelectorAll('body > .rank').forEach(e => e.remove());
  }

  function shuffle(array) {
    for(let i = array.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async function loadDataAndStart() {
    const url = mode === 'anime' ? '../data/animes.json' : '../data/openings.json';
    try {
      const res = await fetch(url);
      if(!res.ok) throw new Error("Erreur chargement " + url);
      data = await res.json();

      if (mode === "opening") {
        let openingsList = [];
        data.forEach(anime => {
          if (anime.openings && Array.isArray(anime.openings)) {
            anime.openings.forEach(opening => {
              openingsList.push({
                title: anime.title,
                openingName: opening.name,
                url: opening.url
              });
            });
          }
        });
        shuffle(openingsList);
        items = openingsList.slice(0, TOTAL_ITEMS);
      } else {
        shuffle(data);
        items = data.slice(0, TOTAL_ITEMS);
      }

      swissStats = items.map(() => ({
        wins: 0,
        losses: 0,
        playedOpponents: new Set(),
        opponents: []
      }));

      swissRound = 0;
      swissMatches = generateSwissRoundMatches();

      setupUI();
      showNextMatch();
    } catch(e) {
      alert(e.message);
    }
  }

  function generateSwissRoundMatches() {
    const indices = Array.from({length: items.length}, (_, i) => i);
    indices.sort((a, b) => {
      if (swissStats[b].wins !== swissStats[a].wins) return swissStats[b].wins - swissStats[a].wins;
      return Math.random() - 0.5;
    });

    const matches = [];
    const used = new Set();

    for (let i = 0; i < indices.length; i++) {
      if (used.has(indices[i])) continue;
      let found = false;
      for (let j = i+1; j < indices.length; j++) {
        if (used.has(indices[j])) continue;
        if (!swissStats[indices[i]].playedOpponents.has(indices[j])) {
          matches.push({i1: indices[i], i2: indices[j]});
          used.add(indices[i]);
          used.add(indices[j]);
          found = true;
          break;
        }
      }
      if (!found) {
        for (let j = i+1; j < indices.length; j++) {
          if (!used.has(indices[j])) {
            matches.push({i1: indices[i], i2: indices[j]});
            used.add(indices[i]);
            used.add(indices[j]);
            break;
          }
        }
      }
    }
    return matches;
  }

  function setupUI() {
    duelContainer.innerHTML = '';
    duelContainer.style.display = 'flex';

    const div1 = document.createElement('div');
    const div2 = document.createElement('div');

    if(mode === 'anime'){
      div1.className = 'anime';
      div2.className = 'anime';
      div1.innerHTML = `<img src="" alt="" /><h3></h3>`;
      div2.innerHTML = `<img src="" alt="" /><h3></h3>`;
    } else {
      div1.className = 'opening';
      div2.className = 'opening';
      div1.innerHTML = `<iframe src="" frameborder="0" allowfullscreen></iframe><h3></h3>`;
      div2.innerHTML = `<iframe src="" frameborder="0" allowfullscreen></iframe><h3></h3>`;
    }

    duelContainer.appendChild(div1);
    duelContainer.appendChild(div2);

    div1.onclick = () => recordWin(1);
    div2.onclick = () => recordWin(2);
  }

  function getYouTubeEmbedUrl(youtubeUrl) {
    let videoId = null;
    try {
      const urlObj = new URL(youtubeUrl);
      if(urlObj.hostname.includes('youtube.com')){
        videoId = urlObj.searchParams.get('v');
      } else if(urlObj.hostname.includes('youtu.be')){
        videoId = urlObj.pathname.slice(1);
      }
    } catch {}
    if(videoId) return `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=0`;
    return null;
  }

  function showNextMatch() {
    if (nextMatchBtn) nextMatchBtn.style.display = "none";
    if (swissMatches.length === 0 && swissRound < SWISS_ROUNDS) {
      swissRound++;
      if (swissRound < SWISS_ROUNDS) {
        swissMatches = generateSwissRoundMatches();
        showNextMatch();
      } else {
        startBracket();
      }
      return;
    }

    if (swissMatches.length > 0) {
      showMatch(swissMatches.shift());
    } else if (bracketRound > 0) {
      showClassement();
    }
  }

  let currentMatch = null;

  function showMatch(match) {
    const i1 = match.i1;
    const i2 = match.i2;
    const divs = duelContainer.children;

    if(mode === 'anime'){
      divs[0].querySelector('img').src = items[i1].image;
      divs[0].querySelector('img').alt = items[i1].title;
      divs[0].querySelector('h3').textContent = items[i1].title;

      divs[1].querySelector('img').src = items[i2].image;
      divs[1].querySelector('img').alt = items[i2].title;
      divs[1].querySelector('h3').textContent = items[i2].title;
    } else {
      const url1 = getYouTubeEmbedUrl(items[i1].url || '') || '';
      const url2 = getYouTubeEmbedUrl(items[i2].url || '') || '';

      divs[0].querySelector('iframe').src = url1;
      divs[1].querySelector('iframe').src = url2;

      divs[0].querySelector('h3').textContent = items[i1].openingName || '';
      divs[1].querySelector('h3').textContent = items[i2].openingName || '';
    }
    currentMatch = match;
  }

  function recordWin(winner) {
    if(!currentMatch) return;
    if(bracketRound === 0){
      const winnerIndex = (winner === 1) ? currentMatch.i1 : currentMatch.i2;
      const loserIndex = (winner === 1) ? currentMatch.i2 : currentMatch.i1;

      swissStats[winnerIndex].wins++;
      swissStats[loserIndex].losses++;

      swissStats[winnerIndex].playedOpponents.add(loserIndex);
      swissStats[loserIndex].playedOpponents.add(winnerIndex);
      swissStats[winnerIndex].opponents.push(loserIndex);
      swissStats[loserIndex].opponents.push(winnerIndex);

      showNextMatch();
    } else {
      const winnerIndex = (winner === 1) ? bracketMatches[bracketMatchIndex].i1 : bracketMatches[bracketMatchIndex].i2;
      bracketMatches[bracketMatchIndex].winner = winnerIndex;
      bracketMatchIndex++;
      if(bracketMatchIndex >= bracketMatches.length){
        setupNextBracketRound();
      } else {
        showBracketMatch(bracketMatches[bracketMatchIndex]);
      }
    }
  }

  function startBracket() {
    for (let i = 0; i < swissStats.length; i++) {
      swissStats[i].buchholz = swissStats[i].opponents.reduce((sum, idx) => sum + swissStats[idx].wins, 0);
    }

    let classement = swissStats.map((s, i) => ({
      index: i,
      wins: s.wins,
      buchholz: s.buchholz
    })).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
      return Math.random() - 0.5;
    });

    let qualified = classement.slice(0, QUALIFIED_TO_BRACKET);

    if(qualified.length < QUALIFIED_TO_BRACKET){
      alert("Pas assez de qualifiés pour le bracket.");
      showClassement();
      return;
    }

    bracketRound = 1;
    bracketMatchIndex = 0;
    bracketMatches = [];

    for(let i=0; i<QUALIFIED_TO_BRACKET/2; i++){
      bracketMatches.push({
        i1: qualified[i].index,
        i2: qualified[QUALIFIED_TO_BRACKET - 1 - i].index,
        winner: null
      });
    }

    // Ajout brackets pour demi, petite finale et finale
    bracketMatches.push({i1: null, i2: null, winner: null});
    bracketMatches.push({i1: null, i2: null, winner: null});
    bracketMatches.push({i1: null, i2: null, winner: null});
    bracketMatches.push({i1: null, i2: null, winner: null});

    alert("Phase bracket 1v1 éliminatoire commencée !");
    duelContainer.style.display = 'flex';
    showBracketMatch(bracketMatches[bracketMatchIndex]);
  }

  function showBracketMatch(match) {
    const divs = duelContainer.children;
    let i1 = match.i1;
    let i2 = match.i2;

    if (bracketMatchIndex === 4) {
      i1 = bracketMatches[0].winner;
      i2 = bracketMatches[1].winner;
      match.i1 = i1; match.i2 = i2;
    }
    if (bracketMatchIndex === 5) {
      i1 = bracketMatches[2].winner;
      i2 = bracketMatches[3].winner;
      match.i1 = i1; match.i2 = i2;
    }
    if (bracketMatchIndex === 6) {
      const demi1Loser = bracketMatches[4].i1 === bracketMatches[4].winner ? bracketMatches[4].i2 : bracketMatches[4].i1;
      const demi2Loser = bracketMatches[5].i1 === bracketMatches[5].winner ? bracketMatches[5].i2 : bracketMatches[5].i1;
      i1 = demi1Loser;
      i2 = demi2Loser;
      match.i1 = i1; match.i2 = i2;
    }
    if (bracketMatchIndex === 7) {
      i1 = bracketMatches[4].winner;
      i2 = bracketMatches[5].winner;
      match.i1 = i1; match.i2 = i2;
    }

    if(mode === 'anime'){
      divs[0].querySelector('img').src = items[i1].image;
      divs[0].querySelector('img').alt = items[i1].title;
      divs[0].querySelector('h3').textContent = items[i1].title;

      divs[1].querySelector('img').src = items[i2].image;
      divs[1].querySelector('img').alt = items[i2].title;
      divs[1].querySelector('h3').textContent = items[i2].title;
    } else {
      const url1 = getYouTubeEmbedUrl(items[i1].url || '') || '';
      const url2 = getYouTubeEmbedUrl(items[i2].url || '') || '';

      divs[0].querySelector('iframe').src = url1;
      divs[1].querySelector('iframe').src = url2;

      divs[0].querySelector('h3').textContent = items[i1].openingName || '';
      divs[1].querySelector('h3').textContent = items[i2].openingName || '';
    }
    currentMatch = match;
  }

  function setupNextBracketRound() {
    bracketMatchIndex++;
    if (bracketMatchIndex < bracketMatches.length) {
      showBracketMatch(bracketMatches[bracketMatchIndex]);
    } else {
      showClassement();
    }
  }

  function showClassement() {
    duelContainer.style.display = 'none';
    classementDiv.innerHTML = '';

    // Affiche le bouton "Suivant"
    if (nextMatchBtn) {
      nextMatchBtn.style.display = "block";
      if (isParcours) {
        const step = parseInt(urlParams.get("step") || "1", 10);
        if (step < parcoursCount) {
          nextMatchBtn.textContent = "Suivant";
        } else {
          nextMatchBtn.textContent = "Terminer";
        }
        nextMatchBtn.onclick = function() {
          parent.postMessage({
            parcoursScore: {
              label: "Anime Tournament " + (mode === "anime" ? "Anime" : "Opening"),
              score: 0,
              total: 0
            }
          }, "*");
        };
      } else {
        nextMatchBtn.textContent = "Rejouer";
        nextMatchBtn.onclick = function() {
          nextMatchBtn.style.display = "none";
          reset();
          loadDataAndStart();
        };
      }
    }

    // Calcul du classement suisse avec tiebreak
    let classementSuisse = swissStats.map((s, i) => ({
      index: i,
      wins: s.wins,
      buchholz: s.buchholz || s.opponents.reduce((sum, idx) => sum + swissStats[idx].wins, 0)
    })).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
      return Math.random() - 0.5;
    });
    let qualifiés = classementSuisse.slice(0, QUALIFIED_TO_BRACKET).map(c => c.index);

    // Classement final (tout le monde 9e par défaut)
    let classementFinal = Array(items.length).fill(9);

    if (bracketMatches.length === 8 && bracketMatches[7].winner != null) {
      let finale = bracketMatches[7];
      let petiteFinale = bracketMatches[6];
      let winner = finale.winner;
      let runnerup = finale.i1 === finale.winner ? finale.i2 : finale.i1;
      let third = petiteFinale.winner;
      let fourth = petiteFinale.i1 === petiteFinale.winner ? petiteFinale.i2 : petiteFinale.i1;

      let qfLosers = [0,1,2,3].map(i => {
        let m = bracketMatches[i];
        return m.i1 === m.winner ? m.i2 : m.i1;
      });
      let qfSorted = qfLosers.map(idx => {
        let c = classementSuisse.find(c => c.index === idx);
        return { index: idx, wins: c ? c.wins : 0, buchholz: c ? c.buchholz : 0 };
      }).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
        return Math.random() - 0.5;
      });

      classementFinal[winner] = 1;
      classementFinal[runnerup] = 2;
      classementFinal[third] = 3;
      classementFinal[fourth] = 4;
      classementFinal[qfSorted[0].index] = 5;
      classementFinal[qfSorted[1].index] = 6;
      classementFinal[qfSorted[2].index] = 7;
      classementFinal[qfSorted[3].index] = 8;

      let nonQualifiés = classementSuisse.filter(c => !qualifiés.includes(c.index));
      nonQualifiés.forEach((c, i) => {
        classementFinal[c.index] = 9 + i;
      });

    } else {
      classementSuisse.forEach((c, i) => {
        classementFinal[c.index] = i + 1;
      });
    }

    let classementSorted = items.map((item, i) => ({
      index: i,
      rank: classementFinal[i]
    })).sort((a, b) => a.rank - b.rank);

    classementSorted.forEach(entry => displayClassementItem(entry.index, entry.rank));
  }

  function displayClassementItem(idx, rank) {
    const item = items[idx];
    const div = document.createElement('div');
    div.className = 'classement-item';
    if(rank === 1) div.classList.add('top1');
    if(rank === 2) div.classList.add('top2');
    if(rank === 3) div.classList.add('top3');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Rang ${rank} - ${item.title}`);

    const rankDiv = document.createElement('div');
    rankDiv.className = 'rank';
    rankDiv.textContent = `#${rank}`;

    const titleDiv = document.createElement('div');
    titleDiv.className = 'title';

    if (mode === "anime") {
      titleDiv.textContent = item.title;
    } else {
      titleDiv.textContent = item.openingName || '';
    }

    div.appendChild(rankDiv);

    if(mode === 'anime'){
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.title;
      div.appendChild(img);
    } else {
      const iframe = document.createElement('iframe');
      const embedUrl = getYouTubeEmbedUrl(item.url || '');
      if(embedUrl) {
        iframe.src = embedUrl;
        iframe.width = "100%";
        iframe.height = "210";
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', '');
        div.appendChild(iframe);
      } else {
        const thumb = document.createElement('img');
        thumb.src = 'default-opening.png';
        thumb.alt = item.title;
        div.appendChild(thumb);
      }
    }
    div.appendChild(titleDiv);
    classementDiv.appendChild(div);
  }

  // Init first load
  loadDataAndStart();
})();
