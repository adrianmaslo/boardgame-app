let seconds = 0, timerInterval = null, activeGameId = null;
let allSessions = []; 
let roundHistory = []; 
let startTime = null;

window.switchTab = function(tabName) {
    document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`nav-${tabName}`).classList.add('active');
    window.scrollTo(0, 0);
};

window.toggleSearch = () => bootstrap.Collapse.getOrCreateInstance(document.getElementById('searchCol')).toggle();
window.toggleComment = () => document.getElementById('comment').classList.toggle('d-none');

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

window.selectGame = function(id, name) {
    activeGameId = id; seconds = 0; roundHistory = []; startTime = new Date().toISOString();
    document.getElementById('activeGameNameDisplay').innerText = name;
    document.getElementById('logSection').classList.remove('d-none');
    document.getElementById('no-game-placeholder').classList.add('d-none');
    updateTotals(); renderRoundPreview(); startInternalTimer(); switchTab('home');
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
        updateTotals(); 
        renderRoundPreview();
        saveTimerState();
    }
};

function updateTotals() {
    document.getElementById('sum_adrian').innerText = roundHistory.reduce((s, r) => s + r.adrian, 0);
    document.getElementById('sum_lea').innerText = roundHistory.reduce((s, r) => s + r.lea, 0);
}

function renderRoundPreview() {
    const preview = document.getElementById('roundPreview');
    preview.innerHTML = roundHistory.map((r, index) => 
        `<span class="badge bg-white text-dark border me-1 mb-1 shadow-sm" onclick="removeRound(${index})" style="cursor:pointer; padding: 6px 10px;">
            R${r.round}: ${r.adrian}|${r.lea} <span class="text-danger ms-1">✖</span>
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

window.loadCollection = async function() {
    const res = await fetch('/collection'); const data = await res.json();
    document.getElementById('collectionList').innerHTML = data.collection.map(g => {
        const imgSrc = g.image_url ? g.image_url : 'https://via.placeholder.com/50?text=🎲';
        return `
        <div class="list-group-item d-flex align-items-center shadow-sm p-2 mb-2" onclick="showGameStats(${g.id}, ${g.bgg_id || 'null'}, '${g.image_url || ''}', ${g.min_players || 'null'}, ${g.max_players || 'null'}, ${g.playing_time || 'null'}, ${g.weight || 'null'})">
            <img src="${imgSrc}" class="rounded-3 me-3" style="width: 50px; height: 50px; object-fit: cover; border: 1px solid #eee;">
            <div class="flex-grow-1"><span class="fw-bold d-block">${g.name}</span><span class="text-muted x-small">${g.playing_time ? '⏱ ' + g.playing_time + ' Min.' : ''}</span></div>
            <span class="text-primary small fw-bold pe-2">PROFIL</span>
        </div>`;
    }).join('');
};

window.showGameStats = async function(gameId, bggId, imageUrl, minP, maxP, time, weight) {
    const res = await fetch(`/stats/game/${gameId}`); const data = await res.json();
    const modal = new bootstrap.Modal(document.getElementById('gameStatsModal'));
    
    document.getElementById('statsGameName').innerText = data.game_name;
    document.getElementById('statsWinsA').innerText = data.wins["Adrian"] || 0;
    document.getElementById('statsWinsL').innerText = data.wins["Lea"] || 0;
    
    const coverCont = document.getElementById('statsCoverImage');
    if (imageUrl && imageUrl !== 'null' && imageUrl !== '') {
        coverCont.innerHTML = `<img src="${imageUrl}" class="w-100" style="height: 140px; object-fit: cover; opacity: 0.95; border-bottom: 1px solid #eee;">`;
        coverCont.classList.remove('d-none');
    } else { coverCont.classList.add('d-none'); }

    let bggInfoHtml = '';
    if (weight || time || minP) {
        bggInfoHtml = `<div class="d-flex justify-content-start flex-wrap gap-2 mb-3">
            ${minP && maxP ? `<span class="badge bg-primary-subtle text-primary rounded-pill px-2 py-1">👥 ${minP}-${maxP} Spieler</span>` : ''}
            ${time ? `<span class="badge bg-secondary-subtle text-secondary rounded-pill px-2 py-1">⏱ ${time} Min</span>` : ''}
            ${weight ? `<span class="badge bg-light text-dark border rounded-pill px-2 py-1">🧠 Weight: ${weight}</span>` : ''}
        </div>`;
    }
    const bggLink = (bggId && bggId !== 'null') ? `<a href="https://boardgamegeek.com/boardgame/${bggId}/files" target="_blank" class="btn btn-sm btn-light border w-100 rounded-pill mb-4 fw-bold text-muted shadow-sm">📖 BGG Regeln & Infos</a>` : '';
    document.getElementById('bggInfoContainer').innerHTML = bggInfoHtml + bggLink;
    
    document.getElementById('statsHistoryList').innerHTML = data.history.slice(0, 3).map(s => {
        const winner = s.scores.find(sc => sc.is_winner === 1);
        return `<div class="list-group-item border-0 px-0 small d-flex justify-content-between" onclick="closeAndShowDetails(${s.id})"><span>${new Date(s.play_date).toLocaleDateString('de-DE')}</span><span class="fw-bold ${winner ? 'text-success' : 'text-muted'}">${winner ? winner.name : 'Remis'}</span></div>`;
    }).join('');

    document.getElementById('startGameBtn').onclick = () => { modal.hide(); selectGame(gameId, data.game_name); };
    document.getElementById('deleteGameBtn').onclick = () => deleteGame(gameId);
    modal.show();
};

window.deleteGame = async function(gameId) {
    if(!confirm("Willst du dieses Spiel wirklich aus der Sammlung löschen?")) return;
    try {
        const res = await fetch(`/delete/${gameId}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            alert(data.detail || "Konnte nicht gelöscht werden.");
            return;
        }
        bootstrap.Modal.getInstance(document.getElementById('gameStatsModal')).hide();
        loadCollection(); 
    } catch (e) { alert("Fehler beim Löschen."); }
};

window.closeAndShowDetails = (id) => {
    const currentModal = bootstrap.Modal.getInstance(document.getElementById('gameStatsModal'));
    if(currentModal) currentModal.hide();
    setTimeout(() => showDetails(id), 400);
};

window.loadHistory = async function() {
    const res = await fetch('/history'); const data = await res.json();
    allSessions = data.history; renderHistory(allSessions);
};

function renderHistory(sessions) {
    document.getElementById('historyList').innerHTML = sessions.map(s => {
        const winner = s.scores.find(sc => sc.is_winner === 1);
        return `<div class="list-group-item d-flex justify-content-between align-items-center" onclick="showDetails(${s.id})"><div><div class="fw-bold">${s.game_name}</div><small class="text-muted">${new Date(s.play_date).toLocaleDateString('de-DE')}</small></div><span class="badge rounded-pill ${winner ? 'bg-success' : 'bg-secondary'}">${winner ? winner.name : 'Remis'}</span></div>`;
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
    
    // VERKNÜPFUNG FÜR DEN VERLAUF-LÖSCHBUTTON HIER UNTEN INTERN GEFIXED:
    document.getElementById('deleteSessionBtn').onclick = () => deleteSession(sessionId);

    modal.show();
};

// --- FUNKTION: GANZE PARTIE LÖSCHEN ---
window.deleteSession = async function(sessionId) {
    if(!confirm("Willst du diese Partie wirklich unwiderruflich aus dem Verlauf löschen?")) return;
    try {
        const res = await fetch(`/session/${sessionId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Konnte nicht gelöscht werden.");
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadHistory(); 
        loadDashboard(); 
    } catch (e) { alert("Fehler beim Löschen der Partie."); }
};

window.filterHistory = function() {
    const term = document.getElementById('historyFilter').value.toLowerCase();
    renderHistory(allSessions.filter(s => s.game_name.toLowerCase().includes(term)));
};

window.searchBGG = async function() {
    const q = document.getElementById('searchInput').value; if (!q) return;
    document.getElementById('searchResults').innerHTML = '<div class="text-center text-muted small p-3">Lade aus der BGG-Datenbank...</div>';
    const res = await fetch(`/search?name=${q}`); const data = await res.json();
    if(data.results.length === 0) {
        document.getElementById('searchResults').innerHTML = '<div class="text-center text-muted small p-3">Nichts gefunden.</div>'; return;
    }
    document.getElementById('searchResults').innerHTML = data.results.map(g => `
        <div class="list-group-item d-flex justify-content-between align-items-center animate-fade-in" onclick="previewGame(${g.id}, '${g.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
            <span class="small fw-bold">${g.name}</span>
            <span class="badge bg-primary rounded-pill px-3 py-2">VORSCHAU</span>
        </div>`).join('');
};

window.previewGame = async function(bggId, tempName) {
    document.getElementById('previewGameName').innerText = tempName;
    document.getElementById('previewCoverImage').innerHTML = '<div class="p-5 text-center text-muted">Lade Spieldetails...</div>';
    document.getElementById('previewBadges').innerHTML = '';
    const modal = new bootstrap.Modal(document.getElementById('bggPreviewModal'));
    modal.show();
    try {
        const res = await fetch(`/preview?bgg_id=${bggId}`); const data = await res.json();
        document.getElementById('previewGameName').innerText = data.name || tempName;
        if (data.image_url) { document.getElementById('previewCoverImage').innerHTML = `<img src="${data.image_url}" class="w-100" style="height: 200px; object-fit: cover; opacity: 0.95; border-bottom: 1px solid #eee;">`; } 
        else { document.getElementById('previewCoverImage').innerHTML = '<div class="p-4 text-center text-muted bg-light">Kein Cover auf BGG hinterlegt</div>'; }
        let badgesHtml = '';
        if (data.min_players && data.max_players) badgesHtml += `<span class="badge bg-primary-subtle text-primary rounded-pill px-2 py-1">👥 ${data.min_players}-${data.max_players} Spieler</span>`;
        if (data.playing_time) badgesHtml += `<span class="badge bg-secondary-subtle text-secondary rounded-pill px-2 py-1">⏱ ${data.playing_time} Min</span>`;
        if (data.weight) badgesHtml += `<span class="badge bg-light text-dark border rounded-pill px-2 py-1">🧠 Weight: ${data.weight}</span>`;
        document.getElementById('previewBadges').innerHTML = badgesHtml;
        document.getElementById('confirmAddBtn').onclick = () => { modal.hide(); addGame(data.name || tempName, bggId); };
    } catch (e) { document.getElementById('previewCoverImage').innerHTML = '<div class="p-4 text-center text-danger bg-light">Fehler beim Laden</div>'; }
};

window.addGame = async function(name, id) {
    await fetch(`/add?name=${encodeURIComponent(name)}&bgg_id=${id}`);
    bootstrap.Collapse.getInstance(document.getElementById('searchCol')).hide();
    loadCollection();
};

function saveTimerState() {
    if (!activeGameId) return;
    localStorage.setItem('activeTimer', JSON.stringify({
        seconds, startTime, activeGameId, name: document.getElementById('activeGameNameDisplay').innerText, rounds: roundHistory, last: Date.now()
    }));
}

function restoreTimerState() {
    const saved = localStorage.getItem('activeTimer'); if (!saved) return;
    const s = JSON.parse(saved);
    activeGameId = s.activeGameId; seconds = s.seconds; startTime = s.startTime; roundHistory = s.rounds || [];
    seconds += Math.floor((Date.now() - s.last) / 1000);
    document.getElementById('activeGameNameDisplay').innerText = s.name;
    document.getElementById('logSection').classList.remove('d-none'); document.getElementById('no-game-placeholder').classList.add('d-none');
    updateTotals(); renderRoundPreview(); startInternalTimer();
}

window.loadDashboard = async function() {
    const res = await fetch('/stats/dashboard'); const data = await res.json();
    document.getElementById('dashWinsA').innerText = data.wins["Adrian"] || 0; document.getElementById('dashWinsL').innerText = data.wins["Lea"] || 0;
};

window.onload = () => { loadDashboard(); loadCollection(); loadHistory(); restoreTimerState(); };