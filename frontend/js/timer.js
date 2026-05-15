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
