let seconds = 0, timerInterval = null, activeGameId = null;
let allSessions = []; 
let roundHistory = []; 
let startTime = null;

// --- TIMER LOGIK ---
window.toggleTimer = function() {
    const btn = document.getElementById('startBtn');
    if (timerInterval) { 
        clearInterval(timerInterval); 
        timerInterval = null; 
        btn.innerText = "Weiter"; 
        btn.classList.replace('btn-warning', 'btn-success'); 
        saveTimerState(false);
    } else { 
        if (seconds === 0) {
            startTime = new Date().toISOString(); // Merkt sich den echten Startmoment
        }
        timerInterval = setInterval(() => { 
            seconds++; 
            updateTimerDisplay(); 
            if (seconds % 5 === 0) saveTimerState(true);
        }, 1000); 
        btn.innerText = "Pause"; 
        btn.classList.replace('btn-success', 'btn-warning'); 
        saveTimerState(true);
    }
};

function updateTimerDisplay() {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    document.getElementById('timer').innerText = `${h}:${m}:${s}`;
}

window.resetTimer = function() { 
    clearInterval(timerInterval); 
    timerInterval = null; 
    seconds = 0; 
    startTime = null;
    updateTimerDisplay(); 
    document.getElementById('startBtn').innerText = "Start"; 
    localStorage.removeItem('activeTimer'); 
};

function saveTimerState(isRunning) {
    const state = {
        seconds: seconds,
        isRunning: isRunning,
        startTime: startTime,
        lastUpdate: Date.now(),
        activeGameId: activeGameId,
        activeGameName: document.getElementById('activeGameName').innerText,
        roundHistory: roundHistory
    };
    localStorage.setItem('activeTimer', JSON.stringify(state));
}

function restoreTimerState() {
    const saved = localStorage.getItem('activeTimer');
    if (!saved) return;
    const state = JSON.parse(saved);
    seconds = state.seconds;
    startTime = state.startTime;
    activeGameId = state.activeGameId;
    roundHistory = state.roundHistory || [];
    if (state.isRunning) {
        const passedTime = Math.floor((Date.now() - state.lastUpdate) / 1000);
        seconds += passedTime;
        toggleTimer();
    }
    updateTimerDisplay();
    if (activeGameId) {
        document.getElementById('activeGameName').innerText = state.activeGameName;
        document.getElementById('logSection').classList.remove('d-none');
        updateTotals();
        const preview = document.getElementById('roundPreview');
        preview.innerHTML = roundHistory.map(r => `<span class="badge bg-light text-dark border me-1 mb-1">R${r.round}: A ${r.adrian} | L ${r.lea}</span>`).reverse().join('');
    }
}

// --- RUNDEN LOGIK ---
window.nextRound = function() {
    const aInput = document.getElementById('score_adrian');
    const lInput = document.getElementById('score_lea');
    const aVal = parseInt(aInput.value) || 0;
    const lVal = parseInt(lInput.value) || 0;
    if (aInput.value === "" && lInput.value === "") return;
    roundHistory.push({ round: roundHistory.length + 1, adrian: aVal, lea: lVal });
    updateTotals();
    const preview = document.getElementById('roundPreview');
    preview.innerHTML = `<span class="badge bg-light text-dark border me-1 mb-1">R${roundHistory.length}: A ${aVal} | L ${lVal}</span>` + preview.innerHTML;
    aInput.value = ""; lInput.value = ""; aInput.focus();
    saveTimerState(timerInterval !== null);
};

function updateTotals() {
    const totalA = roundHistory.reduce((sum, r) => sum + r.adrian, 0);
    const totalL = roundHistory.reduce((sum, r) => sum + r.lea, 0);
    document.getElementById('sum_adrian').innerText = totalA;
    document.getElementById('sum_lea').innerText = totalL;
}

window.resetPoints = function() {
    roundHistory = [];
    document.getElementById('sum_adrian').innerText = "0";
    document.getElementById('sum_lea').innerText = "0";
    document.getElementById('roundPreview').innerHTML = "";
    saveTimerState(timerInterval !== null);
};

// --- BGG & SAMMLUNG ---
window.searchBGG = async function() {
    const q = document.getElementById('searchInput').value;
    if (!q) return;
    const res = await fetch(`/search?name=${q}`);
    const data = await res.json();
    document.getElementById('searchResults').innerHTML = data.results.map(g => `<div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded bg-white shadow-sm"><span>${g.name}</span><button class="btn btn-sm btn-success" onclick="addGame('${g.name}', ${g.id})">+</button></div>`).join('');
};

window.addGame = async function(name, id) {
    await fetch(`/add?name=${encodeURIComponent(name)}&bgg_id=${id}`);
    loadCollection();
};

window.loadCollection = async function() {
    const res = await fetch('/collection');
    const data = await res.json();
    document.getElementById('collectionList').innerHTML = data.collection.map(g => `<button class="list-group-item list-group-item-action border-0 mb-1 shadow-sm rounded d-flex justify-content-between align-items-center" onclick="showGameStats(${g.id})"><strong>${g.name}</strong><span class="badge bg-light text-muted small">Stats ></span></button>`).join('');
};

window.showGameStats = async function(gameId) {
    const res = await fetch(`/stats/game/${gameId}`);
    const data = await res.json();
    const modal = new bootstrap.Modal(document.getElementById('gameStatsModal'));
    document.getElementById('statsGameName').innerText = data.game_name;
    document.getElementById('statsWinScore').innerText = `${data.wins["Adrian"] || 0} : ${data.wins["Lea"] || 0}`;
    document.getElementById('statsTotalPlays').innerText = data.total_plays;
    document.getElementById('statsHighscores').innerHTML = `<div class="text-center"><small class="d-block">Adrian</small><strong>${data.highscores["Adrian"] || '-'}</strong></div><div class="text-center"><small class="d-block">Lea</small><strong>${data.highscores["Lea"] || '-'}</strong></div>`;
    document.getElementById('statsHistoryList').innerHTML = data.history.slice(0, 5).map(s => {
        const winner = s.scores.find(sc => sc.is_winner === 1);
        return `<div class="list-group-item px-0 py-2 bg-transparent d-flex justify-content-between align-items-center small"><span>${new Date(s.play_date).toLocaleDateString('de-DE')}</span><span class="fw-bold ${winner ? 'text-success' : 'text-muted'}">${winner ? winner.name : 'Remis'}</span></div>`;
    }).join('');
    document.getElementById('startGameBtn').onclick = () => { modal.hide(); selectGame(gameId, data.game_name); };
    modal.show();
};

function selectGame(id, name) {
    activeGameId = id;
    resetPoints();
    document.getElementById('activeGameName').innerText = name;
    document.getElementById('logSection').classList.remove('d-none');
    document.getElementById('logSection').scrollIntoView({ behavior: 'smooth' });
    saveTimerState(timerInterval !== null);
}

// --- SPEICHERN ---
window.saveSession = async function() {
    if (!activeGameId) return;
    const aVal = parseInt(document.getElementById('score_adrian').value) || 0;
    const lVal = parseInt(document.getElementById('score_lea').value) || 0;
    if (document.getElementById('score_adrian').value !== "" || document.getElementById('score_lea').value !== "") {
        roundHistory.push({ round: roundHistory.length + 1, adrian: aVal, lea: lVal });
    }
    const formData = new FormData();
    formData.append('game_id', activeGameId);
    formData.append('duration', seconds);
    formData.append('start_time', startTime); // Hier schicken wir den gemerkten Startmoment
    formData.append('score_adrian', roundHistory.reduce((s, r) => s + r.adrian, 0));
    formData.append('score_lea', roundHistory.reduce((s, r) => s + r.lea, 0));
    formData.append('winner_id', document.getElementById('winner_id').value);
    formData.append('comment', document.getElementById('comment').value);
    formData.append('rounds_json', JSON.stringify(roundHistory));
    const photo = document.getElementById('photo').files[0];
    if (photo) formData.append('photo', photo);
    await fetch('/record_session', { method: 'POST', body: formData });
    localStorage.removeItem('activeTimer'); 
    location.reload();
};

// --- CHRONIK & DETAILS ---
window.loadHistory = async function() {
    const res = await fetch('/history');
    const data = await res.json();
    allSessions = data.history;
    renderHistory(allSessions);
};

function renderHistory(sessions) {
    const list = document.getElementById('historyList');
    list.innerHTML = sessions.map(s => {
        const winner = s.scores.find(sc => sc.is_winner === 1);
        return `<a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center mb-1 border-0 shadow-sm rounded" onclick="showDetails(${s.id})"><div><div class="fw-bold">${s.game_name}</div><small class="text-muted">${new Date(s.play_date).toLocaleDateString('de-DE')}</small></div><span class="badge ${winner ? 'bg-success' : 'bg-secondary'} rounded-pill">${winner ? '🏆 ' + winner.name : 'Remis'}</span></a>`;
    }).join('');
}

function filterHistory() {
    const term = document.getElementById('historyFilter').value.toLowerCase();
    renderHistory(allSessions.filter(s => s.game_name.toLowerCase().includes(term)));
}

window.showDetails = function(sessionId) {
    const s = allSessions.find(x => x.id === sessionId);
    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    document.getElementById('modalGameName').innerText = s.game_name;
    document.getElementById('modalDate').innerText = new Date(s.play_date).toLocaleDateString('de-DE');
    
    // Uhrzeit anzeigen (falls vorhanden)
    if (s.start_time) {
        const time = new Date(s.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('modalStartTime').innerText = `🕒 Start: ${time}`;
        document.getElementById('modalStartTime').style.display = 'inline-block';
    } else {
        document.getElementById('modalStartTime').style.display = 'none';
    }

    document.getElementById('modalDuration').innerText = `⏱️ ${Math.floor(s.duration_seconds/60)} Min.`;
    document.getElementById('modalComment').innerText = s.comment || "Keine Notizen.";
    const imgCont = document.getElementById('modalImageContainer');
    imgCont.innerHTML = s.photo_path ? `<img src="${s.photo_path.replace('uploads/', '/photos/')}">` : '';
    let html = '<h6 class="fw-bold mb-2">Endergebnis:</h6><div class="list-group shadow-sm mb-3">';
    html += s.scores.map(sc => `<div class="list-group-item d-flex justify-content-between ${sc.is_winner ? 'bg-success text-white fw-bold' : ''}">${sc.name}<span>${sc.score_value} Pkt.</span></div>`).join('');
    html += '</div>';
    if (s.rounds && s.rounds.length > 0) {
        html += '<h6 class="fw-bold mb-2 small">Rundenverlauf:</h6><table class="table table-sm table-striped border small"><thead><tr class="table-light"><th>R</th><th>Adrian</th><th>Lea</th></tr></thead><tbody>';
        const roundsCount = s.rounds.length / 2;
        for (let i = 1; i <= roundsCount; i++) {
            const rA = s.rounds.find(r => r.round_number === i && r.name === 'Adrian');
            const rL = s.rounds.find(r => r.round_number === i && r.name === 'Lea');
            html += `<tr><td>${i}</td><td>${rA ? rA.points : 0}</td><td>${rL ? rL.points : 0}</td></tr>`;
        }
        html += '</tbody></table>';
    }
    document.getElementById('modalScores').innerHTML = html;
    modal.show();
};

window.loadDashboard = async function() {
    const res = await fetch('/stats/dashboard');
    const data = await res.json();
    document.getElementById('winScore').innerText = `${data.wins["Adrian"] || 0} : ${data.wins["Lea"] || 0}`;
    document.getElementById('streakInfo').innerHTML = Object.entries(data.streaks).map(([p, m]) => `<div class="alert alert-warning py-1 small mb-1">${p}: ${m}</div>`).join('');
    document.getElementById('achievementList').innerHTML = data.achievements.map(a => `<span class="badge bg-info m-1">${a}</span>`).join('');
};

window.onload = () => { 
    loadCollection(); 
    loadDashboard(); 
    loadHistory(); 
    restoreTimerState(); 
};