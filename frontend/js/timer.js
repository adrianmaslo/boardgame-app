function startInternalTimer() {
    clearInterval(timerInterval);
    if (typeof updatePauseUI === 'function') updatePauseUI();
    timerInterval = setInterval(() => { 
        if (!isPaused) {
            seconds++; 
            const timeStr = formatSeconds(seconds);
            document.getElementById('activeGameTimerDisplay').innerText = timeStr;
            document.getElementById('miniPlayerTimer').innerText = timeStr;
            if (seconds % 5 === 0) saveTimerState();
        }
    }, 1000);
}

window.togglePauseTimer = function(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    isPaused = !isPaused;
    saveTimerState();
    updatePauseUI();
};

window.updatePauseUI = function() {
    const btnModal = document.getElementById('btnPauseModal');
    const btnMini = document.getElementById('btnPauseMini');
    
    if (isPaused) {
        if(btnModal) btnModal.innerHTML = t('btn_resume_timer', '▶️ WEITER');
        if(btnMini) btnMini.innerHTML = '▶️';
        document.getElementById('activeGameTimerDisplay').classList.add('text-warning');
        document.getElementById('miniPlayerTimer').classList.add('text-warning');
    } else {
        if(btnModal) btnModal.innerHTML = t('btn_pause', '⏸ PAUSE');
        if(btnMini) btnMini.innerHTML = '⏸';
        document.getElementById('activeGameTimerDisplay').classList.remove('text-warning');
        document.getElementById('miniPlayerTimer').classList.remove('text-warning');
    }
};

window.confirmResetTimer = function() {
    if (activeGameId) {
        showConfirmModal(t('title_cancel_session', "Partie abbrechen"), t('confirm_cancel_session', "Willst du diese Partie wirklich abbrechen? Der Fortschritt geht verloren."), () => {
            clearInterval(timerInterval); timerInterval = null; seconds = 0; activeGameId = null; activeGameImg = ''; isPaused = false;
            document.getElementById('miniPlayer').classList.add('d-none');
            const modalEl = document.getElementById('activeGameModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            localStorage.removeItem('activeTimer');
        });
    }
};

window.selectGame = async function(id, name, imageUrl, checkedPlayerIds) {
    activeGameId = id; activeGameImg = imageUrl || ''; seconds = 0; roundHistory = []; startTime = new Date().toISOString(); isPaused = false;
    document.getElementById('activeGameNameDisplay').innerText = name;
    document.getElementById('miniPlayerGameName').innerText = name;
    document.getElementById('miniPlayerImg').src = imageUrl || 'https://via.placeholder.com/42?text=🎲';
    document.getElementById('miniPlayer').classList.remove('d-none');
    
    // Team-Status zurücksetzen
    window.sessionTeams = {};
    
    // Gäste laden und mit initialisieren
    let guests = [];
    try {
        const res = await authFetch('/guests');
        if (res && res.ok) {
            const data = await res.json();
            guests = data.guests || [];
        }
    } catch(e) {
        console.error("Guests fetch failed:", e);
    }

    const potentialPlayers = [
        ...allPlayers.map(p => ({ id: Number(p.id), name: p.name, is_guest: false })),
        ...guests.map(g => ({ id: -Math.abs(Number(g.id)), name: g.name, is_guest: true }))
    ];

    window.sessionPlayers = potentialPlayers.map(p => ({
        id: p.id,
        name: p.name,
        active: checkedPlayerIds ? checkedPlayerIds.map(String).includes(String(p.id)) : !p.is_guest,
        is_guest: p.is_guest
    }));

    const comm = document.getElementById('comment');
    if (comm) {
        comm.value = '';
        comm.classList.add('d-none');
    }
    const photoInput = document.getElementById('photo');
    if (photoInput) photoInput.value = '';
    
    const photoBtn = document.querySelector('[onclick="document.getElementById(\'photo\').click()"]');
    if (photoBtn) {
        photoBtn.innerHTML = '📸 ' + t('btn_add_photo', 'Foto hinzufügen');
        photoBtn.classList.remove('btn-success');
        photoBtn.classList.add('btn-dark');
    }

    // Fetch win condition dynamically
    try {
        const res = await authFetch(`/stats/game/${id}`);
        if (res && res.ok) {
            const data = await res.json();
            window.activeGameWinCondition = data.win_condition;
        } else {
            window.activeGameWinCondition = 0;
        }
    } catch(e) {
        window.activeGameWinCondition = 0;
    }
    
    // Reset to play view
    showPlayView();
    
    renderActivePlayersToggleList();
    renderActiveScoreboard();
    updateTotals(); 
    renderRoundPreview(); 
    togglePointsInterfaceVisibility();
    startInternalTimer(); 
    openActiveGame();
};

window.togglePointsInterfaceVisibility = function() {
    const isNoPoints = window.activeGameWinCondition === 2;
    let noPointsBlock = document.getElementById('noPointsInfoBlock');
    if (!noPointsBlock) {
        noPointsBlock = document.createElement('div');
        noPointsBlock.id = 'noPointsInfoBlock';
        noPointsBlock.className = 'text-center p-4 my-3 rounded-4';
        noPointsBlock.style.background = 'rgba(255,255,255,0.02)';
        noPointsBlock.style.border = '1px solid var(--surface-border)';
        noPointsBlock.innerHTML = `
            <div style="font-size: 2.2rem;" class="mb-2">🎲</div>
            <h6 class="fw-bold text-white mb-2">${t('label_no_points_game_header', 'Dieses Spiel hat keine Punkte')}</h6>
            <p class="text-white-50 small mb-0">${t('label_no_points_game_desc', 'Die Rundenwertung ist für dieses Spiel deaktiviert. Du kannst den Gewinner am Spielende manuell auswählen.')}</p>
        `;
        const scoreboard = document.getElementById('activeScoreboardContainer');
        if (scoreboard) {
            scoreboard.parentNode.insertBefore(noPointsBlock, scoreboard);
        }
    }
    
    const scoreboard = document.getElementById('activeScoreboardContainer');
    const nextRoundBtn = document.querySelector('[onclick="nextRound()"]');
    const finishBtn = document.querySelector('[onclick="showSaveView()"]');
    
    // Find Rundenverlauf header
    let roundTitle = null;
    document.querySelectorAll('.modal-body div').forEach(el => {
        if (el.innerText.toUpperCase() === 'RUNDENVERLAUF') roundTitle = el;
    });
    const roundPreviewEl = document.getElementById('roundPreview');
    
    if (isNoPoints) {
        if (scoreboard) scoreboard.classList.add('d-none');
        if (nextRoundBtn) nextRoundBtn.classList.add('d-none');
        if (finishBtn) {
            finishBtn.className = 'btn btn-warning w-100 rounded-3 fw-bold py-2 shadow-sm';
        }
        if (roundTitle) roundTitle.classList.add('d-none');
        if (roundPreviewEl) roundPreviewEl.classList.add('d-none');
        if (noPointsBlock) noPointsBlock.classList.remove('d-none');
    } else {
        if (scoreboard) scoreboard.classList.remove('d-none');
        if (nextRoundBtn) nextRoundBtn.classList.remove('d-none');
        if (finishBtn) {
            finishBtn.className = 'btn btn-outline-warning rounded-3 fw-bold px-3 py-2';
        }
        if (roundTitle) roundTitle.classList.remove('d-none');
        if (roundPreviewEl) roundPreviewEl.classList.remove('d-none');
        if (noPointsBlock) noPointsBlock.classList.add('d-none');
    }
};

window.openActiveGame = function() {
    if (!activeGameId) return;
    const modal = new bootstrap.Modal(document.getElementById('activeGameModal'));
    modal.show();
};

// Helper: reads player score from round
function getPlayerScoreInRound(r, playerKey) {
    if (r.scores && r.scores[playerKey] !== undefined) {
        return r.scores[playerKey];
    }
    return 0;
}

window.renderActivePlayersToggleList = function() {
    const container = document.getElementById('activePlayersToggleList');
    if (!container) return;

    const teamColors = {
        1: '#00d2d3',
        2: '#ff7675',
        3: '#1dd1a1',
        4: '#feca57'
    };

    let html = '';
    window.sessionPlayers.forEach(p => {
        if (p.is_guest && !p.active) {
            return;
        }
        const key = p.id !== null && p.id !== undefined ? String(p.id) : String(p.temp_id);
        const teamNum = (window.sessionTeams || {})[key] || 0;
        
        let teamBadge = '';
        let extraStyle = '';
        if (teamNum > 0 && p.active) {
            const teamColor = teamColors[teamNum] || '#ffffff';
            teamBadge = `<span class="badge ms-1" style="background-color: ${teamColor}; color: #000; font-size: 0.65rem; padding: 2px 5px; border-radius: 4px; font-weight: 800; vertical-align: middle;">T${teamNum}</span>`;
            extraStyle = `border-color: ${teamColor} !important; box-shadow: 0 0 5px ${teamColor}33;`;
        }

        html += `
        <span class="badge rounded-pill px-3 py-1.5 border fs-6 d-flex align-items-center gap-1" 
              onclick="togglePlayerActive('${key}')" 
              style="cursor: pointer; transition: all 0.2s ease; ${extraStyle} ${p.active ? 'background-color: var(--bs-primary); border-color: var(--bs-primary);' : 'background-color: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); opacity: 0.5;'}">
            ${p.is_guest ? '👤' : '👥'} ${p.name}
            ${teamBadge}
            ${p.active ? '✅' : '❌'}
        </span>`;
    });
    container.innerHTML = html;
};

window.togglePlayerActive = function(key) {
    const player = window.sessionPlayers.find(p => (p.id !== null && p.id !== undefined ? String(p.id) : String(p.temp_id)) === String(key));
    if (player) {
        const activeCount = window.sessionPlayers.filter(p => p.active).length;
        if (player.active && activeCount <= 1) {
            alert(t('msg_at_least_one_player', "Mindestens ein Spieler muss mitspielen!"));
            return;
        }
        player.active = !player.active;
        renderActivePlayersToggleList();
        renderActiveScoreboard();
        updateTotals();
        renderRoundPreview();
    }
};

window.showAddGuestPrompt = async function() {
    let existingGuests = [];
    try {
        const res = await authFetch('/guests');
        if (res && res.ok) {
            const data = await res.json();
            existingGuests = data.guests || [];
        }
    } catch (e) {
        console.error("Fehler beim Laden der Gäste:", e);
    }

    const input = document.getElementById('newGuestNameInput');
    if (input) input.value = '';
    const err = document.getElementById('newGuestError');
    if (err) {
        err.textContent = '';
        err.classList.add('d-none');
    }

    const listEl = document.getElementById('timerExistingGuestsList');
    if (listEl) {
        const activeNames = window.sessionPlayers.filter(p => p.active).map(p => p.name.toLowerCase());
        const availableGuests = existingGuests.filter(g => !activeNames.includes(g.name.toLowerCase()));

        if (availableGuests.length === 0) {
            listEl.innerHTML = `<div class="text-white-50 small text-center py-2">${t('msg_no_more_guests', 'Keine weiteren Gäste vorhanden.')}</div>`;
        } else {
            listEl.innerHTML = availableGuests.map(g => `
                <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);">
                    <span class="text-white small fw-bold">👤 ${g.name}</span>
                    <button class="btn btn-xs btn-outline-primary rounded-pill px-2.5 py-0.5 fw-bold" onclick="addGuestToActiveSession(${g.id}, '${g.name.replace(/'/g, "\\'")}')" style="font-size: 0.7rem;">
                        ➕ ${t('btn_add', 'Hinzufügen')}
                    </button>
                </div>
            `).join('');
        }
    }

    const modal = new bootstrap.Modal(document.getElementById('activeGuestModal'));
    modal.show();
};

window.addGuestToActiveSession = function(guestId, name) {
    const trimmedName = name.trim();
    if (trimmedName === "") return;

    const alreadyInSessionActive = window.sessionPlayers.some(p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.active);
    if (alreadyInSessionActive) {
        alert(t('msg_player_already_in_session', "Dieser Spieler ist bereits in der Session!"));
        return;
    }

    const existingInSession = window.sessionPlayers.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingInSession) {
        existingInSession.active = true;
    } else {
        window.sessionPlayers.push({
            id: guestId ? -Math.abs(Number(guestId)) : null,
            name: trimmedName,
            active: true,
            is_guest: true
        });
    }

    const modalEl = document.getElementById('activeGuestModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    renderActivePlayersToggleList();
    renderActiveScoreboard();
    updateTotals();
    renderRoundPreview();
};

window.submitNewGuestFromTimer = async function() {
    const input = document.getElementById('timerNewGuestNameInput');
    const err = document.getElementById('newGuestError');
    if (!input) return;

    const name = input.value.trim();
    if (!name) {
        if (err) {
            err.textContent = t('msg_enter_name', "Bitte einen Namen eingeben.");
            err.classList.remove('d-none');
        }
        return;
    }

    try {
        const res = await authFetch('/guests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (res.ok) {
            addGuestToActiveSession(data.id, data.name);
        } else {
            if (err) {
                err.textContent = data.detail || t('msg_error_creating', "Fehler beim Erstellen.");
                err.classList.remove('d-none');
            }
        }
    } catch (e) {
        if (err) {
            err.textContent = t('msg_connection_error', "Verbindungsfehler.");
            err.classList.remove('d-none');
        }
    }
};

window.renderActiveScoreboard = function() {
    const container = document.getElementById('activeScoreboardContainer');
    if (!container || !window.sessionPlayers) return;

    const activePlayers = window.sessionPlayers.filter(p => p.active);
    
    // Determine teams
    const teams = window.sessionTeams || {};
    const scoringGroups = [];
    const processedTeamNums = new Set();

    activePlayers.forEach(p => {
        const key = p.id || p.temp_id;
        const teamNum = teams[key] || 0;
        
        if (teamNum === 0) {
            scoringGroups.push({
                type: 'individual',
                key: key,
                name: p.name,
                players: [p]
            });
        } else {
            if (!processedTeamNums.has(teamNum)) {
                processedTeamNums.add(teamNum);
                const teamPlayers = activePlayers.filter(ap => {
                    const apKey = ap.id || ap.temp_id;
                    return (teams[apKey] || 0) === teamNum;
                });
                scoringGroups.push({
                    type: 'team',
                    key: `team_${teamNum}`,
                    name: `Team ${teamNum}`,
                    players: teamPlayers
                });
            }
        }
    });

    let html = '';
    scoringGroups.forEach((g, idx) => {
        const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
        const prevInputVal = document.getElementById(`score_${g.key}`)?.value || '';
        
        let displayName = g.name;
        if (g.type === 'team') {
            displayName = `Team ${g.key.split('_')[1]}: ${g.players.map(p => p.name).join(' & ')}`;
        }

        html += `
        <div class="text-center px-2 py-2 rounded-3 flex-grow-1" style="min-width: 80px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); max-width: 200px;">
            <div class="${colorClass} x-small fw-bold text-uppercase tracking-wider text-truncate" style="margin: 0 auto;" title="${displayName}">${displayName}</div>
            <div class="fs-3 fw-bold ${colorClass} my-1" id="sum_${g.key}">0</div>
            <input type="number" id="score_${g.key}" value="${prevInputVal}" class="form-control form-control-sm bg-dark text-white border-secondary border-opacity-50 mx-auto text-center" placeholder="${t('placeholder_points_input', '+ Pkt')}" style="max-width: 85px; font-size: 0.9rem;" inputmode="numeric">
        </div>`;
    });
    container.innerHTML = html;
};

window.openTeamBuilder = function() {
    const listCont = document.getElementById('teamBuilderPlayersList');
    if (!listCont) return;
    
    if (!window.sessionTeams) {
        window.sessionTeams = {};
    }
    
    const activePlayers = window.sessionPlayers.filter(p => p.active);
    
    listCont.innerHTML = activePlayers.map((p, idx) => {
        const key = p.id || p.temp_id;
        const currentTeam = window.sessionTeams[key] || 0;
        const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
        
        return `
        <div class="d-flex align-items-center justify-content-between">
            <span class="${colorClass} fw-bold">${p.name}</span>
            <select class="form-select form-select-sm bg-dark text-white border-secondary border-opacity-50" style="max-width: 150px;" id="team_select_${key}">
                <option value="0" ${currentTeam === 0 ? 'selected' : ''}>Kein Team</option>
                <option value="1" ${currentTeam === 1 ? 'selected' : ''}>Team 1</option>
                <option value="2" ${currentTeam === 2 ? 'selected' : ''}>Team 2</option>
                <option value="3" ${currentTeam === 3 ? 'selected' : ''}>Team 3</option>
                <option value="4" ${currentTeam === 4 ? 'selected' : ''}>Team 4</option>
            </select>
        </div>`;
    }).join('');
    
    const modal = new bootstrap.Modal(document.getElementById('teamBuilderModal'));
    modal.show();
};

window.saveTeams = function() {
    const activePlayers = window.sessionPlayers.filter(p => p.active);
    window.sessionTeams = {};
    
    activePlayers.forEach(p => {
        const key = p.id || p.temp_id;
        const el = document.getElementById(`team_select_${key}`);
        if (el) {
            window.sessionTeams[key] = parseInt(el.value) || 0;
        }
    });
    
    const modalEl = document.getElementById('teamBuilderModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    
    renderActiveScoreboard();
    updateTotals();
    renderRoundPreview();
    saveTimerState();
};

window.nextRound = function() {
    if (!window.sessionPlayers) return;
    const activePlayers = window.sessionPlayers.filter(p => p.active);
    const teams = window.sessionTeams || {};
    const processedTeamNums = new Set();
    const scoringGroupKeys = [];

    activePlayers.forEach(p => {
        const key = p.id || p.temp_id;
        const teamNum = teams[key] || 0;
        if (teamNum === 0) {
            scoringGroupKeys.push({ key: key, players: [key] });
        } else if (!processedTeamNums.has(teamNum)) {
            processedTeamNums.add(teamNum);
            const teamPlayers = activePlayers.filter(ap => (teams[ap.id || ap.temp_id] || 0) === teamNum).map(ap => ap.id || ap.temp_id);
            scoringGroupKeys.push({ key: `team_${teamNum}`, players: teamPlayers });
        }
    });

    let hasValue = false;
    scoringGroupKeys.forEach(g => {
        const val = document.getElementById(`score_${g.key}`)?.value;
        if (val !== undefined && val !== "") hasValue = true;
    });
    if (!hasValue) return;

    const roundScores = {};
    scoringGroupKeys.forEach(g => {
        const inputEl = document.getElementById(`score_${g.key}`);
        const scoreVal = inputEl ? (parseInt(inputEl.value) || 0) : 0;
        if (inputEl) inputEl.value = "";
        
        g.players.forEach(pKey => {
            roundScores[pKey] = scoreVal;
        });
    });

    roundHistory.push({
        round: roundHistory.length + 1,
        scores: roundScores
    });

    updateTotals(); 
    renderRoundPreview(); 
    
    if (scoringGroupKeys[0]) {
        const firstInput = document.getElementById(`score_${scoringGroupKeys[0].key}`);
        if (firstInput) firstInput.focus();
    }
    saveTimerState();
};

window.removeRound = function(index) {
    showConfirmModal(t('title_delete_round', "Runde löschen"), t('confirm_delete_round', "Möchtest du diese Runde wirklich löschen?"), () => {
        roundHistory.splice(index, 1);
        roundHistory.forEach((r, i) => r.round = i + 1);
        updateTotals(); renderRoundPreview(); saveTimerState();
    });
};

window.updateTotals = function() {
    if (!window.sessionPlayers || !window.sessionPlayers.length) return;
    const activePlayers = window.sessionPlayers.filter(p => p.active);
    const teams = window.sessionTeams || {};
    const processedTeamNums = new Set();
    const scoringGroupKeys = [];

    activePlayers.forEach(p => {
        const key = p.id || p.temp_id;
        const teamNum = teams[key] || 0;
        if (teamNum === 0) {
            scoringGroupKeys.push({ key: key, players: [key] });
        } else if (!processedTeamNums.has(teamNum)) {
            processedTeamNums.add(teamNum);
            const teamPlayers = activePlayers.filter(ap => (teams[ap.id || ap.temp_id] || 0) === teamNum).map(ap => ap.id || ap.temp_id);
            scoringGroupKeys.push({ key: `team_${teamNum}`, players: teamPlayers });
        }
    });

    scoringGroupKeys.forEach(g => {
        const refPlayerKey = g.players[0];
        const total = roundHistory.reduce((s, r) => s + getPlayerScoreInRound(r, refPlayerKey), 0);
        const sumEl = document.getElementById(`sum_${g.key}`);
        if (sumEl) sumEl.innerText = total;
    });
};

window.renderRoundPreview = function() {
    const preview = document.getElementById('roundPreview');
    if (!preview || !window.sessionPlayers) return;
    const activePlayers = window.sessionPlayers.filter(p => p.active);

    preview.innerHTML = roundHistory.map((r, index) => {
        let playerScoresHtml = activePlayers.map((p, idx) => {
            const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
            const key = p.id || p.temp_id;
            const scoreVal = getPlayerScoreInRound(r, key);
            return `<span class="${colorClass} fw-bold">${scoreVal}</span>`;
        }).join('<span class="mx-1 text-white-50">|</span>');

        return `<span class="badge rounded-pill d-flex align-items-center shadow-sm" onclick="removeRound(${index})" style="cursor:pointer; padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <span class="text-white-50 me-2">R${r.round}</span>
            ${playerScoresHtml}
            <span class="text-danger ms-2 ms-auto">✖</span>
        </span>`;
    }).reverse().join('');
};

window.showSaveView = function() {
    document.getElementById('activeGamePlayView').classList.add('d-none');
    document.getElementById('activeGameSaveView').classList.remove('d-none');
    
    const activePlayers = window.sessionPlayers.filter(p => p.active);
    const winCond = window.activeGameWinCondition;
    const lowWins = winCond === 1;
    const isNoPoints = winCond === 2;

    const teams = window.sessionTeams || {};
    const scoringGroups = [];
    const processedTeamNums = new Set();

    activePlayers.forEach(p => {
        const key = p.id || p.temp_id;
        const teamNum = teams[key] || 0;
        
        if (teamNum === 0) {
            scoringGroups.push({
                type: 'individual',
                key: String(key),
                name: p.name,
                players: [p]
            });
        } else {
            if (!processedTeamNums.has(teamNum)) {
                processedTeamNums.add(teamNum);
                const teamPlayers = activePlayers.filter(ap => {
                    const apKey = ap.id || ap.temp_id;
                    return (teams[apKey] || 0) === teamNum;
                });
                scoringGroups.push({
                    type: 'team',
                    key: `team_${teamNum}`,
                    name: `Team ${teamNum}`,
                    players: teamPlayers
                });
            }
        }
    });

    let bestScore = null;
    let winningKeys = [];

    if (!isNoPoints) {
        scoringGroups.forEach(g => {
            const scoreKey = g.key;
            const groupSumEl = document.getElementById(`sum_${scoreKey}`);
            const score = groupSumEl ? parseInt(groupSumEl.innerText) || 0 : 0;
            
            if (bestScore === null) {
                bestScore = score;
                winningKeys = [scoreKey];
            } else if (lowWins ? (score < bestScore) : (score > bestScore)) {
                bestScore = score;
                winningKeys = [scoreKey];
            } else if (score === bestScore) {
                winningKeys.push(scoreKey);
            }
        });
    }

    const winCont = document.getElementById('winnerSelectContainer');
    if (winCont) {
        winCont.innerHTML = scoringGroups.map((g, idx) => {
            const isWinner = winningKeys.includes(g.key);
            const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
            
            let displayName = g.name;
            if (g.type === 'team') {
                displayName = `Team ${g.key.split('_')[1]}: ${g.players.map(p => p.name).join(' & ')}`;
            }

            return `
            <div class="form-check form-check-inline m-0">
                <input class="form-check-input d-none" type="checkbox" id="winner_p_${g.key}" value="${g.key}" ${isWinner ? 'checked' : ''} onchange="toggleWinnerBadge(this, '${g.key}')">
                <label class="form-check-label badge rounded-pill px-3 py-2 border fs-6 d-flex align-items-center gap-1" for="winner_p_${g.key}" id="winner_lbl_p_${g.key}" style="cursor: pointer; transition: all 0.2s ease; ${isWinner ? 'background-color: var(--bs-primary); border-color: var(--bs-primary);' : 'background-color: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); opacity: 0.5;'}">
                    🏆 ${displayName}
                </label>
            </div>`;
        }).join('');
    }

    const totalsCont = document.getElementById('activeFinalTotalsContainer');
    if (totalsCont) {
        if (isNoPoints) {
            let html = '<div class="d-flex justify-content-around flex-wrap gap-2 py-1">';
            activePlayers.forEach((p, idx) => {
                const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
                html += `
                <div class="text-center px-2">
                    <span class="${colorClass} small fw-bold">${p.name}</span>
                </div>`;
            });
            html += '</div>';
            totalsCont.innerHTML = html;
        } else {
            let html = '<div class="d-flex justify-content-around flex-wrap gap-2">';
            activePlayers.forEach((p, idx) => {
                const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
                const key = p.id || p.temp_id;
                
                const teamNum = teams[key] || 0;
                const scoreKey = teamNum === 0 ? key : `team_${teamNum}`;
                const groupSumEl = document.getElementById(`sum_${scoreKey}`);
                const score = groupSumEl ? groupSumEl.innerText : '0';
                
                const isWinner = winningKeys.includes(scoreKey);
                html += `
                <div class="text-center px-2">
                    <span class="${colorClass} small d-block">${p.name} ${isWinner ? '🏆' : ''}</span>
                    <span class="fs-4 fw-bold text-white">${score}</span>
                </div>`;
            });
            html += '</div>';
            totalsCont.innerHTML = html;
        }
    }
};

window.toggleWinnerBadge = function(cb, key) {
    const lbl = document.getElementById(`winner_lbl_p_${key}`);
    if (lbl) {
        if (cb.checked) {
            lbl.style.backgroundColor = 'var(--bs-primary)';
            lbl.style.borderColor = 'var(--bs-primary)';
            lbl.style.opacity = '1';
        } else {
            lbl.style.backgroundColor = 'rgba(255,255,255,0.05)';
            lbl.style.borderColor = 'rgba(255,255,255,0.1)';
            lbl.style.opacity = '0.5';
        }
    }
};

window.showPlayView = function() {
    document.getElementById('activeGamePlayView').classList.remove('d-none');
    document.getElementById('activeGameSaveView').classList.add('d-none');
};

document.addEventListener('DOMContentLoaded', () => {
    const photoEl = document.getElementById('photo');
    if (photoEl) {
        photoEl.addEventListener('change', function() {
            const file = this.files[0];
            const btn = document.querySelector('[onclick="document.getElementById(\'photo\').click()"]');
            if (file && btn) {
                btn.innerHTML = `📸 ${t('label_photo', 'Foto')}: ${file.name.substring(0, 10)}... ✔`;
                btn.classList.remove('btn-dark');
                btn.classList.add('btn-success');
            }
        });
    }
});

window.saveSession = async function() {
    if (!window.sessionPlayers || !window.sessionPlayers.length) {
        alert(t('msg_error_no_player_data', 'Fehler: Keine Spieler-Daten vorhanden. Bitte starte das Spiel neu.'));
        return;
    }
    const activePlayers = window.sessionPlayers.filter(p => p.active);
    
    // Add pending inputs as final round if any (only if not a no-points game)
    const isNoPoints = window.activeGameWinCondition === 2;
    if (!isNoPoints) {
        const teams = window.sessionTeams || {};
        const processedTeamNums = new Set();
        const scoringGroupKeys = [];

        activePlayers.forEach(p => {
            const key = p.id || p.temp_id;
            const teamNum = teams[key] || 0;
            if (teamNum === 0) {
                scoringGroupKeys.push({ key: key, players: [key] });
            } else if (!processedTeamNums.has(teamNum)) {
                processedTeamNums.add(teamNum);
                const teamPlayers = activePlayers.filter(ap => (teams[ap.id || ap.temp_id] || 0) === teamNum).map(ap => ap.id || ap.temp_id);
                scoringGroupKeys.push({ key: `team_${teamNum}`, players: teamPlayers });
            }
        });

        let hasValue = false;
        scoringGroupKeys.forEach(g => {
            const val = document.getElementById(`score_${g.key}`)?.value;
            if (val !== undefined && val !== "") hasValue = true;
        });
        
        if (hasValue) {
            const roundScores = {};
            scoringGroupKeys.forEach(g => {
                const inputEl = document.getElementById(`score_${g.key}`);
                const scoreVal = inputEl ? (parseInt(inputEl.value) || 0) : 0;
                
                g.players.forEach(pKey => {
                    roundScores[pKey] = scoreVal;
                });
            });
            roundHistory.push({
                round: roundHistory.length + 1,
                scores: roundScores
            });
        }
    }
    
    const checkedWinners = Array.from(document.querySelectorAll('#winnerSelectContainer input[type="checkbox"]:checked')).map(cb => String(cb.value));

    const scores = activePlayers.map(p => {
        const key = p.id || p.temp_id;
        
        // Find total points (check if individual or team)
        const teams = window.sessionTeams || {};
        const teamNum = teams[key] || 0;
        const scoreKey = teamNum === 0 ? key : `team_${teamNum}`;
        const sumEl = document.getElementById(`sum_${scoreKey}`);
        const total = sumEl ? (parseInt(sumEl.innerText) || 0) : 0;
        
        const isWinner = teamNum > 0 
            ? checkedWinners.includes(`team_${teamNum}`) 
            : checkedWinners.includes(String(key));
        
        return {
            player_id: p.is_guest ? (p.id ? -Math.abs(p.id) : null) : p.id,
            guest_name: p.is_guest ? p.name : null,
            temp_id: p.is_guest && !p.id ? p.temp_id : null,
            score: total,
            is_winner: isWinner
        };
    });

    const backendRounds = roundHistory.map(r => {
        const roundScores = {};
        activePlayers.forEach(p => {
            const key = p.id || p.temp_id;
            roundScores[key] = getPlayerScoreInRound(r, key);
        });
        return {
            round: r.round,
            scores: roundScores
        };
    });

    const formData = new FormData();
    formData.append('game_id', activeGameId);
    formData.append('duration', seconds);
    formData.append('start_time', startTime);
    formData.append('scores_json', JSON.stringify(scores));
    formData.append('rounds_json', JSON.stringify(backendRounds));
    formData.append('winner_id', 0); // Backend calculates/uses winner mapping in scores_json
    formData.append('comment', document.getElementById('comment').value);
    
    const activeGroup = Auth.getActiveGroup();
    if (activeGroup) {
        formData.append('group_id', activeGroup.id);
    }
    
    const photo = document.getElementById('photo').files[0];
    if (photo) formData.append('photo', photo);

    const res = await authFetch('/record_session', { method: 'POST', body: formData });
    if (res && res.ok) {
        localStorage.removeItem('activeTimer');
        location.reload();
    } else {
        alert(t('msg_error_save_session', 'Fehler beim Speichern der Partie.'));
    }
};
