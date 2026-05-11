let seconds = 0, timerInterval = null, activeGameId = null;
let allSessions = []; 
let roundHistory = []; 
let startTime = null;

// --- NAVIGATION ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`nav-${tabName}`).classList.add('active');
    window.scrollTo(0, 0);
};

window.toggleSearch = () => bootstrap.Collapse.getOrCreateInstance(document.getElementById('searchCol')).toggle();
window.toggleComment = () => document.getElementById('comment').classList.toggle('d-none');

// --- TIMER ---
function startInternalTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { 
        seconds++; 
        document.getElementById('timer').innerText = formatSeconds(seconds);
        if (seconds % 5 === 0) saveTimerState();
    }, 1000);
}

function formatSeconds(s) {
    const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
    const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

window.confirmResetTimer = function() {
    if (activeGameId && confirm("Partie wirklich abbrechen?")) {
        clearInterval(timerInterval); timerInterval = null; seconds = 0; activeGameId = null;
        document.getElementById('timer').innerText = "00:00:00";
        document.getElementById('logSection').classList.add('d-none');
        document.getElementById('no-game-placeholder').classList.remove('d-none');
        localStorage.removeItem('activeTimer');
    }
};

// --- GAME LOGIC ---
window.selectGame = function(id, name) {
    activeGameId = id; seconds = 0; roundHistory = []; startTime = new Date().toISOString();
    document.getElementById('activeGameNameDisplay').innerText = name;
    document.getElementById('logSection').classList.remove('d-none');
    document.getElementById('no-game-placeholder').classList.add('d-none');
    
    updateTotals(); 
    renderRoundPreview();
    startInternalTimer();
    switchTab('home');
};

window.nextRound = function() {
    const a = document.getElementById('score_adrian'), l = document.getElementById('score_lea');
    if (a.value === "" && l.value === "") return;
    roundHistory.push({ round: roundHistory.length + 1, adrian: parseInt(a.value) || 0, lea: parseInt(l.value) || 0 });
    updateTotals(); renderRoundPreview();
    a.value = ""; l.value = ""; a.focus();
    saveTimerState();
};

function updateTotals() {
    document.getElementById('sum_adrian').innerText = roundHistory.reduce((s, r) => s + r.adrian, 0);
    document.getElementById('sum_lea').innerText = roundHistory.reduce((s, r) => s + r.lea, 0);
}

function renderRoundPreview() {
    const preview = document.getElementById('roundPreview');
    preview.innerHTML = roundHistory.map(r => `<span class="badge bg-white text-dark border me-1 mb-1 shadow-sm">R${r.round}: ${r.adrian}|${r.lea}</span>`).reverse().join('');
}

window.saveSession = async function() {
    const a = document.getElementById('score_adrian').value, l = document.getElementById('score_lea').value;
    if (a !== "" || l !== "") roundHistory.push({ round: roundHistory.length + 1, adrian: parseInt(a) || 0, lea: parseInt(l) || 0 });
    
    const formData = new FormData();
    formData.append('game_id', activeGameId); formData.append('duration', seconds); formData.append('start_time', startTime);
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

// --- DATA LOADERS ---
window.loadCollection = async function() {
    const res = await fetch('/collection');
    const data = await res.json();
    document.getElementById('collectionList').innerHTML = data.collection.map(g => `
        <div class="list-group-item d-flex justify-content-between align-items-center" onclick="showGameStats(${g.id})">
            <span class="fw-bold">${g.name}</span>
            <span class="text-primary small fw-bold">PROFIL</span>
        </div>`).join('');
};

window.showGameStats = async function(gameId) {
    const res = await fetch(`/stats/game/${gameId}`);
    const data = await res.json();
    const modal = new bootstrap.Modal(document.getElementById('gameStatsModal'));
    
    document.getElementById('statsGameName').innerText = data.game_name;
    document.getElementById('statsWinsA').innerText = data.wins["Adrian"] || 0;
    document.getElementById('statsWinsL').innerText = data.wins["Lea"] || 0;
    
    document.getElementById('statsHistoryList').innerHTML = data.history.slice(0, 3).map(s => {
        const winner = s.scores.find(sc => sc.is_winner === 1);
        return `<div class="list-group-item border-0 px-0 small d-flex justify-content-between" onclick="closeAndShowDetails(${s.id})">
            <span>${new Date(s.play_date).toLocaleDateString('de-DE')}</span>
            <span class="fw-bold ${winner ? 'text-success' : 'text-muted'}">${winner ? winner.name : 'Remis'}</span>
        </div>`;
    }).join('');

    document.getElementById('startGameBtn').onclick = () => {
        modal.hide();
        selectGame(gameId, data.game_name);
    };
    modal.show();
};

window.closeAndShowDetails = (id) => {
    const currentModal = bootstrap.Modal.getInstance(document.getElementById('gameStatsModal'));
    if(currentModal) currentModal.hide();
    setTimeout(() => showDetails(id), 400);
};

window.loadHistory = async function() {
    const res = await fetch('/history');
    const data = await res.json();
    allSessions = data.history;
    renderHistory(allSessions);
};

function renderHistory(sessions) {
    document.getElementById('historyList').innerHTML = sessions.map(s => {
        const winner = s.scores.find(sc => sc.is_winner === 1);
        return `
        <div class="list-group-item d-flex justify-content-between align-items-center" onclick="showDetails(${s.id})">
            <div><div class="fw-bold">${s.game_name}</div><small class="text-muted">${new Date(s.play_date).toLocaleDateString('de-DE')}</small></div>
            <span class="badge rounded-pill ${winner ? 'bg-success' : 'bg-secondary'}">${winner ? winner.name : 'Remis'}</span>
        </div>`;
    }).join('');
}

window.showDetails = function(sessionId) {
    const s = allSessions.find(x => x.id === sessionId);
    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    
    document.getElementById('modalGameName').innerText = s.game_name;
    document.getElementById('modalFullDate').innerText = new Date(s.play_date).toLocaleDateString('de-DE', {weekday: 'long', day: '2-digit', month: 'long'});
    
    document.getElementById('modalDuration').innerText = `⏱️ ${Math.floor(s.duration_seconds/60)} Min.`;
    if(s.start_time) {
        document.getElementById('modalStartTime').innerText = `🕒 ${new Date(s.start_time).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}`;
        document.getElementById('modalStartTime').classList.remove('d-none');
    } else { document.getElementById('modalStartTime').classList.add('d-none'); }

    const commBox = document.getElementById('modalCommentBox');
    if(s.comment) { document.getElementById('modalComment').innerText = s.comment; commBox.classList.remove('d-none'); } 
    else { commBox.classList.add('d-none'); }

    const imgCont = document.getElementById('modalImageContainer');
    imgCont.innerHTML = s.photo_path ? `<img src="${s.photo_path.replace('uploads/', '/photos/')}" class="w-100" style="max-height:300px; object-fit:cover; display:block;">` : '';

    let scoreHtml = '<div class="list-group border-0 mb-3">';
    scoreHtml += s.scores.map(sc => `<div class="list-group-item px-0 d-flex justify-content-between align-items-center border-0 ${sc.is_winner ? 'fw-bold text-success' : ''}"><span>${sc.name} ${sc.is_winner ? '🏆' : ''}</span><span class="fs-5">${sc.score_value}</span></div>`).join('');
    scoreHtml += '</div>';

    if (s.rounds && s.rounds.length > 0) {
        scoreHtml += '<div class="table-responsive"><table class="table table-sm table-borderless x-small mb-0"><thead><tr class="text-muted"><th>R</th><th>Adrian</th><th>Lea</th></tr></thead><tbody>';
        const count = s.rounds.length / 2;
        for (let i = 1; i <= count; i++) {
            const rA = s.rounds.find(r => r.round_number === i && r.name === 'Adrian');
            const rL = s.rounds.find(r => r.round_number === i && r.name === 'Lea');
            scoreHtml += `<tr><td class="text-muted">${i}</td><td>${rA ? rA.points : 0}</td><td>${rL ? rL.points : 0}</td></tr>`;
        }
        scoreHtml += '</tbody></table></div>';
    }
    document.getElementById('modalScores').innerHTML = scoreHtml;
    modal.show();
};

window.filterHistory = function() {
    const term = document.getElementById('historyFilter').value.toLowerCase();
    renderHistory(allSessions.filter(s => s.game_name.toLowerCase().includes(term)));
};

// --- BACKUP ---
function saveTimerState() {
    if (!activeGameId) return;
    localStorage.setItem('activeTimer', JSON.stringify({
        seconds, startTime, activeGameId,
        name: document.getElementById('activeGameNameDisplay').innerText,
        rounds: roundHistory, last: Date.now()
    }));
}

function restoreTimerState() {
    const saved = localStorage.getItem('activeTimer');
    if (!saved) return;
    const s = JSON.parse(saved);
    activeGameId = s.activeGameId; seconds = s.seconds; startTime = s.startTime; roundHistory = s.rounds || [];
    seconds += Math.floor((Date.now() - s.last) / 1000);
    document.getElementById('activeGameNameDisplay').innerText = s.name;
    document.getElementById('logSection').classList.remove('d-none');
    document.getElementById('no-game-placeholder').classList.add('d-none');
    updateTotals(); renderRoundPreview();
    startInternalTimer();
}

window.loadDashboard = async function() {
    const res = await fetch('/stats/dashboard');
    const data = await res.json();
    document.getElementById('dashWinsA').innerText = data.wins["Adrian"] || 0;
    document.getElementById('dashWinsL').innerText = data.wins["Lea"] || 0;
};

window.searchBGG = async function() {
    const q = document.getElementById('searchInput').value; if (!q) return;
    const res = await fetch(`/search?name=${q}`); const data = await res.json();
    document.getElementById('searchResults').innerHTML = data.results.map(g => `<div class="list-group-item d-flex justify-content-between align-items-center animate-fade-in"><span class="small">${g.name}</span><button class="btn btn-sm btn-success rounded-pill" onclick="addGame('${g.name}', ${g.id})">+</button></div>`).join('');
};

window.addGame = async function(name, id) {
    await fetch(`/add?name=${encodeURIComponent(name)}&bgg_id=${id}`);
    bootstrap.Collapse.getInstance(document.getElementById('searchCol')).hide();
    loadCollection();
};

window.onload = () => { loadDashboard(); loadCollection(); loadHistory(); restoreTimerState(); };