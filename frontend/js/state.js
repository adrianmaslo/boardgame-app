let seconds = 0, timerInterval = null, activeGameId = null, activeGameImg = '';
let allSessions = []; 
let roundHistory = []; 
let startTime = null;
let player1Name = "Adrian";
let player2Name = "Lea";

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
    
    // Check if these functions are available (loaded via other scripts)
    if (typeof updateTotals === 'function') updateTotals(); 
    if (typeof renderRoundPreview === 'function') renderRoundPreview(); 
    if (typeof startInternalTimer === 'function') startInternalTimer();
}
