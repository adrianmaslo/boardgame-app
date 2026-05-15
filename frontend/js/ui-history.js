window.loadHistory = async function() {
    const res = await fetch('/history'); const data = await res.json();
    allSessions = data.history; renderHistory(allSessions);
};

function renderHistory(sessions) {
    document.getElementById('historyList').innerHTML = sessions.map(s => {
        const winner = s.scores.find(sc => sc.is_winner === 1);
        const winnerColor = winner ? (winner.name === player1Name ? 'adrian-color' : 'lea-color') : 'text-white';
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
        const colorClass = sc.name === player1Name ? 'adrian-color' : 'lea-color';
        return `<div class="list-group-item px-3 py-2 d-flex justify-content-between align-items-center mb-2 rounded-3" style="background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);">
            <span class="${sc.is_winner ? 'fw-bold text-white' : 'text-white-50'}">${sc.name} ${sc.is_winner ? '🏆' : ''}</span>
            <span class="fs-4 fw-bold ${colorClass}">${sc.score_value}</span>
        </div>`;
    }).join('');
    scoreHtml += '</div>';

    if (s.rounds && s.rounds.length > 0) {
        scoreHtml += `<div class="table-responsive rounded-3 overflow-hidden" style="border: 1px solid var(--surface-border);">
            <table class="table table-dark table-striped table-sm mb-0 text-center">
            <thead><tr><th class="text-muted fw-normal">Runde</th><th class="adrian-color fw-normal">${player1Name}</th><th class="lea-color fw-normal">${player2Name}</th></tr></thead><tbody>`;
        const count = s.rounds.length / 2;
        for (let i = 1; i <= count; i++) {
            const rA = s.rounds.find(r => r.round_number === i && r.name === player1Name);
            const rL = s.rounds.find(r => r.round_number === i && r.name === player2Name);
            scoreHtml += `<tr><td class="text-white-50">${i}</td><td>${rA ? rA.points : 0}</td><td>${rL ? rL.points : 0}</td></tr>`;
        }
        scoreHtml += '</tbody></table></div>';
    }
    document.getElementById('modalScores').innerHTML = scoreHtml;
    document.getElementById('deleteSessionBtn').onclick = () => deleteSession(sessionId);
    
    // Edit Session Logic
    window.currentEditSessionData = {
        id: s.id,
        duration: s.duration_seconds ? Math.floor(s.duration_seconds / 60) : 0,
        date: s.play_date ? s.play_date.split(' ')[0] : '',
        comment: s.comment || '',
        score_adrian: null,
        score_lea: null,
        winner_id: 0
    };
    const sA = s.scores.find(sc => sc.name === 'Adrian');
    const sL = s.scores.find(sc => sc.name === 'Lea');
    if (sA) window.currentEditSessionData.score_adrian = sA.score_value;
    if (sL) window.currentEditSessionData.score_lea = sL.score_value;
    if (sA && sA.is_winner === 1) window.currentEditSessionData.winner_id = 1;
    if (sL && sL.is_winner === 1) window.currentEditSessionData.winner_id = 2;

    document.getElementById('editSessionBtn').onclick = () => {
        modal.hide();
        document.getElementById('editSessionDate').value = currentEditSessionData.date;
        document.getElementById('editSessionDuration').value = currentEditSessionData.duration;
        document.getElementById('editScoreA').value = currentEditSessionData.score_adrian !== null ? currentEditSessionData.score_adrian : '';
        document.getElementById('editScoreL').value = currentEditSessionData.score_lea !== null ? currentEditSessionData.score_lea : '';
        document.getElementById('editWinner').value = currentEditSessionData.winner_id;
        document.getElementById('editSessionComment').value = currentEditSessionData.comment;
        
        const editModal = new bootstrap.Modal(document.getElementById('editSessionModal'));
        editModal.show();
        
        document.getElementById('saveEditSessionBtn').onclick = async () => {
            const payload = {
                play_date: document.getElementById('editSessionDate').value + " 12:00:00",
                duration_minutes: parseInt(document.getElementById('editSessionDuration').value) || 0,
                score_adrian: parseInt(document.getElementById('editScoreA').value) || 0,
                score_lea: parseInt(document.getElementById('editScoreL').value) || 0,
                winner_id: parseInt(document.getElementById('editWinner').value),
                comment: document.getElementById('editSessionComment').value
            };
            
            try {
                const res = await fetch(`/session/${currentEditSessionData.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error();
                editModal.hide();
                loadHistory();
                if (typeof loadDashboard === 'function') loadDashboard();
            } catch (e) {
                alert("Fehler beim Speichern der Änderungen.");
            }
        };
    };

    modal.show();
};

window.deleteSession = async function(sessionId) {
    if(!confirm("Willst du diese Partie wirklich aus dem Verlauf löschen?")) return;
    try {
        const res = await fetch(`/session/${sessionId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadHistory(); 
        if (typeof loadDashboard === 'function') loadDashboard(); 
    } catch (e) { alert("Fehler beim Löschen."); }
};

window.filterHistory = function() {
    const term = document.getElementById('historyFilter').value.toLowerCase();
    const dateFromStr = document.getElementById('historyDateFrom').value;
    const dateToStr = document.getElementById('historyDateTo').value;
    
    let dateFrom = dateFromStr ? new Date(dateFromStr) : null;
    let dateTo = dateToStr ? new Date(dateToStr) : null;
    
    if (dateFrom) dateFrom.setHours(0,0,0,0);
    if (dateTo) dateTo.setHours(23,59,59,999);

    renderHistory(allSessions.filter(s => {
        const gameMatch = s.game_name.toLowerCase().includes(term);
        const playerMatch = s.scores.some(sc => sc.name.toLowerCase().includes(term));
        const dateMatch = new Date(s.play_date).toLocaleDateString('de-DE').includes(term);
        const textMatch = term === '' || gameMatch || playerMatch || dateMatch;
        
        let sessionDate = new Date(s.play_date);
        let rangeMatch = true;
        if (dateFrom && sessionDate < dateFrom) rangeMatch = false;
        if (dateTo && sessionDate > dateTo) rangeMatch = false;
        
        return textMatch && rangeMatch;
    }));
};
