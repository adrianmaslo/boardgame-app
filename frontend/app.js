let seconds = 0;
let timerInterval;
let activeGameId = null;

// --- TIMER LOGIK ---
function toggleTimer() {
    const btn = document.getElementById('startBtn');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        btn.innerText = "Weiter";
        btn.classList.replace('btn-warning', 'btn-success');
    } else {
        timerInterval = setInterval(() => {
            seconds++;
            updateTimerDisplay();
        }, 1000);
        btn.innerText = "Pause";
        btn.classList.replace('btn-success', 'btn-warning');
    }
}

function updateTimerDisplay() {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    document.getElementById('timer').innerText = `${hrs}:${mins}:${secs}`;
}

function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    seconds = 0;
    updateTimerDisplay();
    document.getElementById('startBtn').innerText = "Start";
}

// --- GAME LOGIK ---
async function loadCollection() {
    const res = await fetch('/collection');
    const data = await res.json();
    const list = document.getElementById('collectionList');
    list.innerHTML = '';
    data.collection.forEach(game => {
        const btn = document.createElement('button');
        btn.className = 'list-group-item list-group-item-action game-card d-flex justify-content-between align-items-center';
        btn.innerHTML = `<strong>${game.name}</strong> <span class="badge bg-primary rounded-pill">Start</span>`;
        btn.onclick = () => selectGame(game.id, game.name);
        list.appendChild(btn);
    });
}

function selectGame(id, name) {
    activeGameId = id;
    document.getElementById('activeGameName').innerText = name;
    document.getElementById('logSection').classList.remove('d-none');
    document.getElementById('logSection').scrollIntoView({ behavior: 'smooth' });
}

async function saveSession() {
    const formData = new FormData();
    formData.append('game_id', activeGameId);
    formData.append('duration', seconds);
    formData.append('score_adrian', document.getElementById('score_adrian').value);
    formData.append('score_lea', document.getElementById('score_lea').value);
    formData.append('winner_id', document.getElementById('winner_id').value);
    formData.append('comment', document.getElementById('comment').value);
    
    const photoFile = document.getElementById('photo').files[0];
    if (photoFile) formData.append('photo', photoFile);

    const res = await fetch('/record_session', {
        method: 'POST',
        body: formData
    });

    if (res.ok) {
        alert("Runde erfolgreich gespeichert! 🏆");
        resetTimer();
        document.getElementById('logSection').classList.add('d-none');
    }
}

// --- BGG SUCHE ---
async function searchBGG() {
    const q = document.getElementById('searchInput').value;
    const res = await fetch(`/search?name=${q}`);
    const data = await res.json();
    const div = document.getElementById('searchResults');
    div.innerHTML = '';
    data.results.forEach(g => {
        div.innerHTML += `<div class="d-flex justify-content-between mb-2">${g.name} (${g.year}) <button class="btn btn-sm btn-success" onclick="addGame('${g.name}', ${g.id})">+</button></div>`;
    });
}

async function addGame(name, id) {
    await fetch(`/add?name=${name}&bgg_id=${id}`);
    loadCollection();
    alert(`${name} hinzugefügt!`);
}

// Beim Laden der Seite die Sammlung holen
window.onload = loadCollection;