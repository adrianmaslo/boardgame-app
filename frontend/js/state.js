// ─── Globaler State ────────────────────────────────────────────────────────────
let seconds = 0, timerInterval = null, activeGameId = null, activeGameImg = '';
let isPaused = false;
let allSessions = [];
let roundHistory = [];
let startTime = null;

// Spielernamen — werden dynamisch aus der Gruppe geladen (initApp)
let player1Name = "Spieler 1";
let player2Name = "Spieler 2";
let allPlayers = []; // [{id, name, avatar_color}]

// ─── Timer State Persistence ──────────────────────────────────────────────────

function saveTimerState() {
    if (!activeGameId) return;
    localStorage.setItem('activeTimer', JSON.stringify({
        seconds, startTime, activeGameId, activeGameImg, isPaused,
        name: document.getElementById('miniPlayerGameName')?.innerText || '',
        rounds: roundHistory,
        last: Date.now()
    }));
}

function restoreTimerState() {
    const saved = localStorage.getItem('activeTimer');
    if (!saved) return;
    const s = JSON.parse(saved);
    activeGameId = s.activeGameId;
    activeGameImg = s.activeGameImg || '';
    seconds = s.seconds;
    startTime = s.startTime;
    roundHistory = s.rounds || [];
    isPaused = s.isPaused || false;

    if (!isPaused) {
        seconds += Math.floor((Date.now() - s.last) / 1000);
    }

    const nameEl = document.getElementById('activeGameNameDisplay');
    const miniNameEl = document.getElementById('miniPlayerGameName');
    const miniImgEl = document.getElementById('miniPlayerImg');
    const miniPlayerEl = document.getElementById('miniPlayer');

    if (nameEl) nameEl.innerText = s.name;
    if (miniNameEl) miniNameEl.innerText = s.name;
    if (miniImgEl) miniImgEl.src = activeGameImg || 'https://via.placeholder.com/42?text=🎲';
    if (miniPlayerEl) miniPlayerEl.classList.remove('d-none');

    if (typeof updateTotals === 'function') updateTotals();
    if (typeof renderRoundPreview === 'function') renderRoundPreview();
    if (typeof startInternalTimer === 'function') startInternalTimer();
}

// ─── Spieler für Session laden ────────────────────────────────────────────────

window.loadPlayersForSession = async function() {
    try {
        const res = await authFetch('/players');
        if (!res) return;
        const data = await res.json();
        allPlayers = data.players || [];

        if (allPlayers.length >= 1) player1Name = allPlayers[0].name;
        if (allPlayers.length >= 2) player2Name = allPlayers[1].name;

        // Score-Inputs mit echten Namen beschriften
        const p1Label = document.getElementById('scoreLabel1');
        const p2Label = document.getElementById('scoreLabel2');
        if (p1Label) p1Label.textContent = player1Name;
        if (p2Label) p2Label.textContent = player2Name;

        // Gewinner-Auswahl aktualisieren
        if (typeof renderWinnerSelect === 'function') renderWinnerSelect(allPlayers);
    } catch(e) {
        console.error('Fehler beim Laden der Spieler:', e);
    }
};
