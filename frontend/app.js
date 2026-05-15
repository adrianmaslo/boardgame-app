let seconds = 0, timerInterval = null, activeGameId = null, activeGameImg = '';
let allSessions = []; 
let roundHistory = []; 
let startTime = null;

// --- UTILS & NAVIGATION ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`nav-${tabName}`).classList.add('active');
    window.scrollTo(0, 0);
};

window.toggleSearch = () => bootstrap.Collapse.getOrCreateInstance(document.getElementById('searchCol')).toggle();
window.toggleComment = () => document.getElementById('comment').classList.toggle('d-none');

function formatSeconds(s) {
    const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
    const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

// --- TIMER LOGIC ---
function startInternalTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { 
        seconds++; 
        const timeStr = formatSeconds(seconds);
        document.getElementById('activeGameTimerDisplay').innerText = timeStr;
        document.getElementById('miniPlayerTimer').innerText = timeStr;
        if (seconds % 5 === 0) saveTimerState();
    }, 1000);
}

window.confirmResetTimer = function() {
    if (activeGameId && confirm("Partie wirklich abbrechen?")) {
        clearInterval(timerInterval); timerInterval = null; seconds = 0; activeGameId = null; activeGameImg = '';
        document.getElementById('miniPlayer').classList.add('d-none');
        bootstrap.Modal.getInstance(document.getElementById('activeGameModal')).hide();
        localStorage.removeItem('activeTimer');
    }
};

window.selectGame = function(id, name, imageUrl) {
    activeGameId = id; activeGameImg = imageUrl || ''; seconds = 0; roundHistory = []; startTime = new Date().toISOString();
    document.getElementById('activeGameNameDisplay').innerText = name;
    document.getElementById('miniPlayerGameName').innerText = name;
    document.getElementById('miniPlayerImg').src = imageUrl || 'https://via.placeholder.com/42?text=🎲';
    document.getElementById('miniPlayer').classList.remove('d-none');
    updateTotals(); renderRoundPreview(); startInternalTimer(); openActiveGame();
};

window.openActiveGame = function() {
    if (!activeGameId) return;
    const modal = new bootstrap.Modal(document.getElementById('activeGameModal'));
    modal.show();
};

window.nextRound = function() {
    const a = document.getElementById('score_adrian'), l = document.getElementById('score_lea');
    if (a.value === "" && l.value === "") return;
    roundHistory.push({ round: roundHistory.length + 1, adrian: parseInt(a.value) || 0, lea: parseInt(l.value) || 0 });
    updateTotals(); renderRoundPreview(); a.value = ""; l.value = ""; a.focus(); saveTimerState();
};

window.removeRound = function(index) {
    if (confirm("Möchtest du diese Runde wirklich löschen?")) {
        roundHistory.splice(index, 1);
        roundHistory.forEach((r, i) => r.round = i + 1);
        updateTotals(); renderRoundPreview(); saveTimerState();
    }
};

function updateTotals() {
    document.getElementById('sum_adrian').innerText = roundHistory.reduce((s, r) => s + r.adrian, 0);
    document.getElementById('sum_lea').innerText = roundHistory.reduce((s, r) => s + r.lea, 0);
}

function renderRoundPreview() {
    const preview = document.getElementById('roundPreview');
    preview.innerHTML = roundHistory.map((r, index) => 
        `<span class="badge rounded-pill d-flex align-items-center shadow-sm" onclick="removeRound(${index})" style="cursor:pointer; padding: 8px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);">
            <span class="text-white-50 me-2">R${r.round}</span>
            <span class="adrian-color fw-bold">${r.adrian}</span>
            <span class="mx-1 text-white-50">|</span>
            <span class="lea-color fw-bold">${r.lea}</span>
            <span class="text-danger ms-2 ms-auto">✖</span>
        </span>`
    ).reverse().join('');
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
    localStorage.removeItem('activeTimer'); location.reload();
};

// --- DATA LOADING & RENDERING ---
window.loadCollection = async function() {
    const res = await fetch('/collection'); const data = await res.json();
    document.getElementById('collectionList').innerHTML = data.collection.map(g => {
        const imgSrc = g.image_url ? g.image_url : 'https://via.placeholder.com/50?text=🎲';
        return `
        <div class="list-group-item d-flex align-items-center" onclick="showGameProfile(${g.id}, ${g.bgg_id || 'null'}, '${g.image_url || ''}', ${g.min_players || 'null'}, ${g.max_players || 'null'}, ${g.playing_time || 'null'}, ${g.weight || 'null'})">
            <img src="${imgSrc}" class="rounded-3 me-3" style="width: 55px; height: 55px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">
            <div class="flex-grow-1"><span class="fw-bold d-block text-white">${g.name}</span><span class="text-muted x-small">${g.playing_time ? '⏱ ' + g.playing_time + ' Min.' : ''}</span></div>
            <span class="text-primary small fw-bold pe-2">PROFIL</span>
        </div>`;
    }).join('');
};

window.showGameProfile = async function(gameId, bggId, imageUrl, minP, maxP, time, weight) {
    // Kombinierter Fetch: Basis-Stats und Advanced-Stats laden
    const [resBasic, resAdv] = await Promise.all([
        fetch(`/stats/game/${gameId}`),
        fetch(`/stats/game/${gameId}/advanced`)
    ]);
    const basicData = await resBasic.json();
    const advData = await resAdv.json();

    const modal = new bootstrap.Modal(document.getElementById('gameProfileModal'));
    
    // Basis-Header füllen
    document.getElementById('profileGameName').innerText = basicData.game_name;
    document.getElementById('profileWinsA').innerText = basicData.wins["Adrian"] || 0;
    document.getElementById('profileWinsL').innerText = basicData.wins["Lea"] || 0;
    
    const coverCont = document.getElementById('profileCoverImage');
    if (imageUrl && imageUrl !== 'null' && imageUrl !== '') {
        coverCont.innerHTML = `<img src="${imageUrl}" class="w-100" style="height: 180px; object-fit: cover; opacity: 0.8; border-bottom: 1px solid var(--surface-border); mask-image: linear-gradient(to bottom, black 50%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);">`;
        coverCont.classList.remove('d-none');
    } else { coverCont.classList.add('d-none'); }

    // BGG Info Badges
    let bggInfoHtml = '';
    if (weight || time || minP) {
        bggInfoHtml = `<div class="d-flex justify-content-start flex-wrap gap-2 mb-3">
            ${minP && maxP ? `<span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-50 rounded-pill px-2 py-1">👥 ${minP}-${maxP}</span>` : ''}
            ${time ? `<span class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-50 rounded-pill px-2 py-1">⏱ ${time} Min</span>` : ''}
            ${weight ? `<span class="badge bg-secondary bg-opacity-50 text-light border border-secondary rounded-pill px-2 py-1">🧠 Weight: ${weight}</span>` : ''}
        </div>`;
    }
    const bggLink = (bggId && bggId !== 'null') ? `<a href="https://boardgamegeek.com/boardgame/${bggId}/files" target="_blank" class="btn btn-sm w-100 rounded-pill mb-2 fw-bold text-muted" style="background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);">📖 BGG Regeln & Infos</a>` : '';
    document.getElementById('profileBggInfo').innerHTML = bggInfoHtml + bggLink;
    
    // Win Condition Toggle
    const toggleBtn = document.getElementById('toggleWinCondBtn');
    if (basicData.win_condition === 1) {
        toggleBtn.innerText = "🔄 Regel: Niedrigste Punkte gewinnen";
    } else {
        toggleBtn.innerText = "🔄 Regel: Höchste Punkte gewinnen";
    }
    toggleBtn.onclick = async () => {
        toggleBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Lade...';
        await fetch(`/toggle_win_condition/${gameId}`, { method: 'PATCH' });
        modal.hide();
        setTimeout(() => showGameProfile(gameId, bggId, imageUrl, minP, maxP, time, weight), 350);
    };

    // History Liste (Letzte 3)
    document.getElementById('profileHistoryList').innerHTML = basicData.history.slice(0, 3).map(s => {
        const winner = s.scores.find(sc => sc.is_winner === 1);
        const colorClass = winner ? (winner.name === 'Adrian' ? 'adrian-color' : 'lea-color') : 'text-muted';
        return `<div class="list-group-item border-0 px-3 py-2 mb-1 rounded-3 d-flex justify-content-between align-items-center" style="background: rgba(255,255,255,0.03);">
            <span class="text-white-50">${new Date(s.play_date).toLocaleDateString('de-DE')}</span>
            <span class="fw-bold ${colorClass}">${winner ? winner.name : 'Remis'}</span>
        </div>`;
    }).join('');

    // Advanced Stats Injection
    const advBody = document.getElementById('profileAdvancedStats');
    if (advData.total_games === 0) {
        advBody.innerHTML = `<div class="text-center text-muted p-3">Noch keine Spiele geloggt!</div>`;
    } else {
        const adrian = advData.player_stats["Adrian"] || { avg: 0, max: 0 };
        const lea = advData.player_stats["Lea"] || { avg: 0, max: 0 };
        const recordHolder = advData.all_time_high ? `${advData.all_time_high.name} (${advData.all_time_high.score_value} Pkt)` : "-";
        
        advBody.innerHTML = `
            <div class="d-flex justify-content-between mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-muted">Gespielt:</span><span class="text-white fw-bold">${advData.total_games}x</span>
            </div>
            <div class="d-flex justify-content-between mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-muted">Schnitt / Max Zeit:</span><span class="text-white fw-bold">⏱️ ${advData.avg_time_mins} / ${advData.max_time_mins} Min</span>
            </div>
            <div class="d-flex flex-column mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-muted mb-1">Durchschnittliche Punkte:</span>
                <div class="d-flex justify-content-between">
                    <span class="adrian-color fw-bold">Adrian: ${adrian.avg}</span>
                    <span class="lea-color fw-bold">Lea: ${lea.avg}</span>
                </div>
            </div>
            <div class="d-flex flex-column mb-3">
                <span class="text-muted mb-1">Persönliche Rekorde:</span>
                <div class="d-flex justify-content-between">
                    <span class="adrian-color fw-bold">Adrian: ${adrian.max}</span>
                    <span class="lea-color fw-bold">Lea: ${lea.max}</span>
                </div>
            </div>
            <div class="text-center p-2 rounded-3" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2);">
                <span class="d-block text-success x-small fw-bold text-uppercase tracking-wider">All-Time Bestergebnis</span>
                <span class="text-white fw-bold">${recordHolder}</span>
            </div>
        `;
    }

    document.getElementById('startGameBtn').onclick = () => { 
        modal.hide(); 
        setTimeout(() => selectGame(gameId, basicData.game_name, imageUrl), 350); 
    };
    document.getElementById('deleteGameBtn').onclick = () => deleteGame(gameId);
    
    modal.show();
};

window.deleteGame = async function(gameId) {
    if(!confirm("Willst du dieses Spiel wirklich aus der Sammlung löschen?")) return;
    try {
        const res = await fetch(`/delete/${gameId}`, { method: 'DELETE' });
        if (!res.ok) { const data = await res.json(); alert(data.detail || "Konnte nicht gelöscht werden."); return; }
        bootstrap.Modal.getInstance(document.getElementById('gameProfileModal')).hide();
        loadCollection(); 
    } catch (e) { alert("Fehler beim Löschen."); }
};

window.loadHistory = async function() {
    const res = await fetch('/history'); const data = await res.json();
    allSessions = data.history; renderHistory(allSessions);
};

function renderHistory(sessions) {
    document.getElementById('historyList').innerHTML = sessions.map(s => {
        const winner = s.scores.find(sc => sc.is_winner === 1);
        const winnerColor = winner ? (winner.name === 'Adrian' ? 'adrian-color' : 'lea-color') : 'text-white';
        const bgClass = winner ? 'bg-opacity-10 bg-white' : 'bg-transparent';
        
        return `<div class="list-group-item d-flex justify-content-between align-items-center ${bgClass}" onclick="showDetails(${s.id})">
            <div>
                <div class="fw-bold text-white mb-1">${s.game_name}</div>
                <small class="text-white-50">${new Date(s.play_date).toLocaleDateString('de-DE')}</small>
            </div>
            <span class="fw-bold ${winnerColor} bg-dark bg-opacity-50 px-3 py-1 rounded-pill border border-secondary border-opacity-50">${winner ? winner.name + ' 🏆' : 'Remis'}</span>
        </div>`;
    }).join('');
}

window.showDetails = function(sessionId) {
    const s = allSessions.find(x => x.id === sessionId);
    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    document.getElementById('modalGameName').innerText = s.game_name;
    document.getElementById('modalFullDate').innerText = new Date(s.play_date).toLocaleDateString('de-DE', {weekday: 'long', day: '2-digit', month: 'long'});
    document.getElementById('modalDuration').innerText = `⏱️ ${Math.floor(s.duration_seconds/60)} Min.`;
    if(s.start_time) { document.getElementById('modalStartTime').innerText = `🕒 ${new Date(s.start_time).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}`; document.getElementById('modalStartTime').classList.remove('d-none'); } else { document.getElementById('modalStartTime').classList.add('d-none'); }
    const commBox = document.getElementById('modalCommentBox');
    if(s.comment) { document.getElementById('modalComment').innerText = s.comment; commBox.classList.remove('d-none'); } else { commBox.classList.add('d-none'); }
    const imgCont = document.getElementById('modalImageContainer');
    imgCont.innerHTML = s.photo_path ? `<img src="${s.photo_path.replace('uploads/', '/photos/')}" class="w-100" style="max-height:250px; object-fit:cover; display:block; mask-image: linear-gradient(to bottom, black 70%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);">` : '';

    let scoreHtml = '<div class="list-group border-0 mb-3">';
    scoreHtml += s.scores.map(sc => {
        const colorClass = sc.name === 'Adrian' ? 'adrian-color' : 'lea-color';
        return `<div class="list-group-item px-3 py-2 d-flex justify-content-between align-items-center mb-2 rounded-3" style="background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);">
            <span class="${sc.is_winner ? 'fw-bold text-white' : 'text-white-50'}">${sc.name} ${sc.is_winner ? '🏆' : ''}</span>
            <span class="fs-4 fw-bold ${colorClass}">${sc.score_value}</span>
        </div>`;
    }).join('');
    scoreHtml += '</div>';

    if (s.rounds && s.rounds.length > 0) {
        scoreHtml += `<div class="table-responsive rounded-3 overflow-hidden" style="border: 1px solid var(--surface-border);">
            <table class="table table-dark table-striped table-sm mb-0 text-center">
            <thead><tr><th class="text-muted fw-normal">Runde</th><th class="adrian-color fw-normal">Adrian</th><th class="lea-color fw-normal">Lea</th></tr></thead><tbody>`;
        const count = s.rounds.length / 2;
        for (let i = 1; i <= count; i++) {
            const rA = s.rounds.find(r => r.round_number === i && r.name === 'Adrian');
            const rL = s.rounds.find(r => r.round_number === i && r.name === 'Lea');
            scoreHtml += `<tr><td class="text-white-50">${i}</td><td>${rA ? rA.points : 0}</td><td>${rL ? rL.points : 0}</td></tr>`;
        }
        scoreHtml += '</tbody></table></div>';
    }
    document.getElementById('modalScores').innerHTML = scoreHtml;
    document.getElementById('deleteSessionBtn').onclick = () => deleteSession(sessionId);
    modal.show();
};

window.deleteSession = async function(sessionId) {
    if(!confirm("Willst du diese Partie wirklich aus dem Verlauf löschen?")) return;
    try {
        const res = await fetch(`/session/${sessionId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadHistory(); loadDashboard(); 
    } catch (e) { alert("Fehler beim Löschen."); }
};

window.filterHistory = function() {
    const term = document.getElementById('historyFilter').value.toLowerCase();
    renderHistory(allSessions.filter(s => s.game_name.toLowerCase().includes(term)));
};

// --- BGG SEARCH ---
window.searchBGG = async function() {
    const q = document.getElementById('searchInput').value; if (!q) return;
    document.getElementById('searchResults').innerHTML = '<div class="text-center text-primary small p-3 spinner-border spinner-border-sm" role="status"></div><span class="small text-muted ms-2">Suche...</span>';
    const res = await fetch(`/search?name=${q}`); const data = await res.json();
    if(data.results.length === 0) { document.getElementById('searchResults').innerHTML = '<div class="text-center text-muted small p-3">Nichts gefunden.</div>'; return; }
    document.getElementById('searchResults').innerHTML = data.results.map(g => `
        <div class="list-group-item d-flex justify-content-between align-items-center animate-fade-in rounded-3 mb-2" onclick="previewGame(${g.id}, '${g.name.replace(/'/g, "\\'")}')" style="cursor:pointer; background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);">
            <span class="small fw-bold text-white">${g.name}</span><span class="badge bg-primary rounded-pill px-3 py-2 shadow-sm">VORSCHAU</span>
        </div>`).join('');
};

window.previewGame = async function(bggId, tempName) {
    document.getElementById('previewGameName').innerText = tempName;
    document.getElementById('previewCoverImage').innerHTML = '<div class="p-5 text-center text-muted spinner-border text-primary"></div>';
    document.getElementById('previewBadges').innerHTML = '';
    const modal = new bootstrap.Modal(document.getElementById('bggPreviewModal')); modal.show();
    try {
        const res = await fetch(`/preview?bgg_id=${bggId}`); const data = await res.json();
        document.getElementById('previewGameName').innerText = data.name || tempName;
        if (data.image_url) { document.getElementById('previewCoverImage').innerHTML = `<img src="${data.image_url}" class="w-100" style="height: 220px; object-fit: cover; opacity: 0.9; mask-image: linear-gradient(to bottom, black 50%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);">`; } 
        else { document.getElementById('previewCoverImage').innerHTML = '<div class="p-4 text-center text-muted bg-dark">Kein Cover</div>'; }
        let badgesHtml = '';
        if (data.min_players && data.max_players) badgesHtml += `<span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-50 rounded-pill px-2 py-1">👥 ${data.min_players}-${data.max_players}</span>`;
        if (data.playing_time) badgesHtml += `<span class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-50 rounded-pill px-2 py-1">⏱ ${data.playing_time} Min</span>`;
        if (data.weight) badgesHtml += `<span class="badge bg-secondary bg-opacity-50 text-light border border-secondary rounded-pill px-2 py-1">🧠 Weight: ${data.weight}</span>`;
        document.getElementById('previewBadges').innerHTML = badgesHtml;
        document.getElementById('confirmAddBtn').onclick = () => { modal.hide(); addGame(data.name || tempName, bggId); };
    } catch (e) { document.getElementById('previewCoverImage').innerHTML = '<div class="p-4 text-center text-danger bg-dark">Fehler</div>'; }
};

window.addGame = async function(name, id) {
    await fetch(`/add?name=${encodeURIComponent(name)}&bgg_id=${id}`);
    bootstrap.Collapse.getInstance(document.getElementById('searchCol')).hide();
    loadCollection(); loadDashboard();
};

// --- STATE MANAGEMENT ---
function saveTimerState() {
    if (!activeGameId) return;
    localStorage.setItem('activeTimer', JSON.stringify({
        seconds, startTime, activeGameId, activeGameImg,
        name: document.getElementById('miniPlayerGameName').innerText, rounds: roundHistory, last: Date.now()
    }));
}

function restoreTimerState() {
    const saved = localStorage.getItem('activeTimer'); if (!saved) return;
    const s = JSON.parse(saved);
    activeGameId = s.activeGameId; activeGameImg = s.activeGameImg || ''; seconds = s.seconds; startTime = s.startTime; roundHistory = s.rounds || [];
    seconds += Math.floor((Date.now() - s.last) / 1000);
    
    document.getElementById('activeGameNameDisplay').innerText = s.name;
    document.getElementById('miniPlayerGameName').innerText = s.name;
    document.getElementById('miniPlayerImg').src = activeGameImg || 'https://via.placeholder.com/42?text=🎲';
    document.getElementById('miniPlayer').classList.remove('d-none');
    
    updateTotals(); renderRoundPreview(); startInternalTimer();
}

// --- DASHBOARD LOAD ---
window.loadDashboard = async function() {
    const res = await fetch('/stats/dashboard'); const data = await res.json();
    document.getElementById('dashWinsA').innerText = data.wins["Adrian"] || 0; 
    document.getElementById('dashWinsL').innerText = data.wins["Lea"] || 0;
    
    let highlightsHtml = '';
    
    if (data.most_played) {
        highlightsHtml += `
        <div class="dashboard-card shadow-sm">
            <img src="${data.most_played.image_url || 'https://via.placeholder.com/60?text=🎲'}">
            <div>
                <small class="text-white-50 text-uppercase x-small d-block tracking-wider fw-bold">Dauerbrenner</small>
                <span class="fw-bold d-block text-white">${data.most_played.name}</span>
                <small class="text-primary fw-bold">${data.most_played.count} Partien</small>
            </div>
        </div>`;
    }
    
    if (data.best_adrian) {
        highlightsHtml += `
        <div class="dashboard-card shadow-sm">
            <img src="${data.best_adrian.image_url || 'https://via.placeholder.com/60?text=🏆'}">
            <div>
                <small class="adrian-color text-uppercase x-small d-block tracking-wider fw-bold">Adrians Festung</small>
                <span class="fw-bold d-block text-white">${data.best_adrian.name}</span>
                <small class="text-white-50">${data.best_adrian.wins} Siege</small>
            </div>
        </div>`;
    }
    
    if (data.best_lea) {
        highlightsHtml += `
        <div class="dashboard-card shadow-sm">
            <img src="${data.best_lea.image_url || 'https://via.placeholder.com/60?text=👑'}">
            <div>
                <small class="lea-color text-uppercase x-small d-block tracking-wider fw-bold">Leas Imperium</small>
                <span class="fw-bold d-block text-white">${data.best_lea.name}</span>
                <small class="text-white-50">${data.best_lea.wins} Siege</small>
            </div>
        </div>`;
    }

    if (highlightsHtml === '' && data.most_played) {
         // If there's only 1 game, just show it.
         document.getElementById('dashboardHighlights').innerHTML = highlightsHtml;
    } else if (highlightsHtml === '') {
         document.getElementById('dashboardHighlights').innerHTML = '<div class="text-center text-white-50 small py-4">Noch keine Highlights. Spielt ein paar Partien!</div>';
    } else {
         document.getElementById('dashboardHighlights').innerHTML = highlightsHtml;
    }
};

// --- INIT ---
window.onload = () => { loadDashboard(); loadCollection(); loadHistory(); restoreTimerState(); };