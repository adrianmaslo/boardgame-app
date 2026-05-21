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
        sessionPlayers: window.sessionPlayers || [],
        sessionTeams: window.sessionTeams || {},
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

    // Fetch win condition dynamically for restored game
    if (activeGameId) {
        authFetch(`/stats/game/${activeGameId}`).then(res => res && res.json()).then(data => {
            window.activeGameWinCondition = data.win_condition;
        }).catch(() => {
            window.activeGameWinCondition = 0;
        });
    }

    const nameEl = document.getElementById('activeGameNameDisplay');
    const miniNameEl = document.getElementById('miniPlayerGameName');
    const miniImgEl = document.getElementById('miniPlayerImg');
    const miniPlayerEl = document.getElementById('miniPlayer');

    if (nameEl) nameEl.innerText = s.name;
    if (miniNameEl) miniNameEl.innerText = s.name;
    if (miniImgEl) miniImgEl.src = activeGameImg || 'https://via.placeholder.com/42?text=🎲';
    if (miniPlayerEl) miniPlayerEl.classList.remove('d-none');

    if (s.sessionPlayers && s.sessionPlayers.length > 0) {
        window.sessionPlayers = s.sessionPlayers;
        window.sessionTeams = s.sessionTeams || {};
        if (typeof renderActiveScoreboard === 'function') renderActiveScoreboard();
        if (typeof renderWinnerSelect === 'function') renderWinnerSelect(window.sessionPlayers);
    }

    if (typeof updateTotals === 'function') updateTotals();
    if (typeof renderRoundPreview === 'function') renderRoundPreview();
    if (typeof startInternalTimer === 'function') startInternalTimer();
}

// Spieler laden (entfernt: wird nun komplett dynamisch in timer.js via selectGame und renderActiveScoreboard abgewickelt)
