window.loadHistory = async function() {
    const res = await authFetch('/history'); if (!res) return; const data = await res.json();
    allSessions = data.history; renderHistory(allSessions);
};

function renderHistory(sessions) {
    const lang = localStorage.getItem('app_lang') || 'de';
    const dateLocale = lang === 'en' ? 'en-US' : 'de-DE';
    document.getElementById('historyList').innerHTML = sessions.map(s => {
        const winners = s.scores.filter(sc => sc.is_winner === 1);
        
        let winnerText = t('option_draw', 'Remis');
        let winnerColor = 'text-white-50';
        if (winners.length > 0) {
            winnerText = winners.map(w => w.name).join(' & ') + ' 🏆';
            if (winners.length === 1) {
                const idx = allPlayers.findIndex(p => p.id === winners[0].player_id || p.name === winners[0].name);
                winnerColor = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
            } else {
                winnerColor = 'text-info';
            }
        }
        
        const bgClass = winners.length > 0 ? 'bg-opacity-10 bg-white' : 'bg-transparent';
        
        return `<div class="list-group-item d-flex justify-content-between align-items-center ${bgClass}" onclick="showDetails(${s.id})" style="cursor: pointer;">
            <div>
                <div class="fw-bold text-white mb-1">${s.game_name}</div>
                <small class="text-white-50">${new Date(s.play_date).toLocaleDateString(dateLocale)}</small>
            </div>
            <span class="fw-bold ${winnerColor} bg-dark bg-opacity-50 px-3 py-1 rounded-pill border border-secondary border-opacity-50">${winnerText}</span>
        </div>`;
    }).join('');
}

window.showDetails = function(sessionId) {
    const s = allSessions.find(x => x.id === sessionId);
    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    const lang = localStorage.getItem('app_lang') || 'de';
    const dateLocale = lang === 'en' ? 'en-US' : 'de-DE';
    document.getElementById('modalGameName').innerText = s.game_name;
    document.getElementById('modalFullDate').innerText = new Date(s.play_date).toLocaleDateString(dateLocale, {weekday: 'long', day: '2-digit', month: 'long'});
    document.getElementById('modalDuration').innerText = `⏱️ ${Math.floor(s.duration_seconds/60)} ${t('label_minutes_short', 'Min.')}`;
    if(s.start_time) { document.getElementById('modalStartTime').innerText = `🕒 ${new Date(s.start_time).toLocaleTimeString(dateLocale, {hour:'2-digit', minute:'2-digit'})}`; document.getElementById('modalStartTime').classList.remove('d-none'); } else { document.getElementById('modalStartTime').classList.add('d-none'); }
    const commBox = document.getElementById('modalCommentBox');
    if(s.comment) { document.getElementById('modalComment').innerText = s.comment; commBox.classList.remove('d-none'); } else { commBox.classList.add('d-none'); }
    const imgCont = document.getElementById('modalImageContainer');
    imgCont.innerHTML = s.photo_path ? `<img src="${s.photo_path.replace('uploads/', '/photos/')}" class="w-100" style="max-height:250px; object-fit:cover; display:block; mask-image: linear-gradient(to bottom, black 70%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);">` : '';

    let scoreHtml = '<div class="list-group border-0 mb-3">';
    scoreHtml += s.scores.map(sc => {
        const idx = allPlayers.findIndex(p => p.id === sc.player_id || p.name === sc.name);
        const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
        return `<div class="list-group-item px-3 py-2 d-flex justify-content-between align-items-center mb-2 rounded-3" style="background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);">
            <span class="${sc.is_winner ? 'fw-bold text-white' : 'text-white-50'}">${sc.name} ${sc.is_winner ? '🏆' : ''}</span>
            ${s.win_condition !== 2 ? `<span class="fs-4 fw-bold ${colorClass}">${sc.score_value}</span>` : ''}
        </div>`;
    }).join('');
    scoreHtml += '</div>';

    if (s.rounds && s.rounds.length > 0 && s.win_condition !== 2) {
        let headersHtml = s.scores.map((sc, idx) => {
            const memberIdx = allPlayers.findIndex(p => p.id === sc.player_id || p.name === sc.name);
            const colorClass = memberIdx === 0 ? 'adrian-color' : (memberIdx === 1 ? 'lea-color' : (memberIdx === 2 ? 'text-success' : (sc.player_id < 0 ? 'text-white-50' : 'text-warning')));
            return `<th class="${colorClass} fw-normal">${sc.name}</th>`;
        }).join('');

        scoreHtml += `<div class="table-responsive rounded-3 overflow-hidden" style="border: 1px solid var(--surface-border);">
            <table class="table table-dark table-striped table-sm mb-0 text-center">
            <thead><tr><th class="text-muted fw-normal">Runde</th>${headersHtml}</tr></thead><tbody>`;
            
        const roundNumbers = [...new Set(s.rounds.map(r => r.round_number))].sort((a,b) => a - b);
        roundNumbers.forEach(i => {
            let rowHtml = `<td class="text-white-50">${i}</td>`;
            s.scores.forEach(sc => {
                const rP = s.rounds.find(r => r.round_number === i && (r.player_id === sc.player_id || r.name === sc.name));
                rowHtml += `<td>${rP ? rP.points : 0}</td>`;
            });
            scoreHtml += `<tr>${rowHtml}</tr>`;
        });
        scoreHtml += '</tbody></table></div>';
    }
    document.getElementById('modalScores').innerHTML = scoreHtml;
    document.getElementById('deleteSessionBtn').onclick = () => deleteSession(sessionId);
    document.getElementById('shareSessionBtn').onclick = () => {
        if (typeof openShareImageModal === 'function') {
            openShareImageModal(s);
        }
    };
    
    // Edit Session Logic
    window.currentEditSessionData = {
        id: s.id,
        duration: s.duration_seconds ? Math.floor(s.duration_seconds / 60) : 0,
        date: s.play_date ? s.play_date.split(' ')[0] : '',
        comment: s.comment || '',
        winner_id: 0
    };
    const activeWinner = s.scores.find(sc => sc.is_winner === 1);
    if (activeWinner) {
        window.currentEditSessionData.winner_id = activeWinner.player_id;
    }

    document.getElementById('editSessionBtn').onclick = async () => {
        window.isOpeningEditModal = true;
        modal.hide();
        document.getElementById('editSessionDate').value = currentEditSessionData.date;
        document.getElementById('editSessionDuration').value = currentEditSessionData.duration;
        
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
            ...allPlayers.map(p => ({ id: p.id, name: p.name, is_guest: false })),
            ...guests.map(g => ({ id: -g.id, name: g.name, is_guest: true }))
        ];

        s.scores.forEach(sc => {
            const exists = potentialPlayers.some(p => p.id === sc.player_id || p.name === sc.name);
            if (!exists) {
                potentialPlayers.push({
                    id: sc.player_id,
                    name: sc.name,
                    is_guest: sc.player_id < 0
                });
            }
        });

        const editScoresContainer = document.getElementById('editScoresContainer');
        
        let checklistHtml = `
            <label class="form-label text-white-50 x-small fw-bold text-uppercase d-block mb-2">${t('label_who_played', 'Wer hat mitgespielt?')}</label>
            <div class="d-flex flex-wrap gap-2 mb-3">
        `;
        
        potentialPlayers.forEach(p => {
            const isParticipating = s.scores.some(sc => sc.player_id === p.id || sc.name === p.name);
            checklistHtml += `
                <div class="form-check form-check-inline m-0">
                    <input class="form-check-input d-none" type="checkbox" id="edit_p_${p.id}" value="${p.id}" ${isParticipating ? 'checked' : ''} onchange="toggleEditPlayerBadge(this, '${p.id}')">
                    <label class="form-check-label badge rounded-pill px-3 py-2 border fs-6 d-flex align-items-center gap-1" for="edit_p_${p.id}" id="edit_lbl_p_${p.id}" style="cursor: pointer; transition: all 0.2s ease; ${isParticipating ? 'background-color: var(--bs-primary); border-color: var(--bs-primary); opacity: 1;' : 'background-color: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); opacity: 0.5;'}">
                        ${p.is_guest ? '👤' : '👥'} ${p.name}
                    </label>
                </div>
            `;
        });
        
        checklistHtml += `</div>`;
        
        window.toggleEditPlayerBadge = function(cb, pId) {
            const lbl = document.getElementById(`edit_lbl_p_${pId}`);
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
            const inputContainer = document.getElementById(`editScoreContainer_${pId}`);
            if (inputContainer) {
                inputContainer.classList.toggle('d-none', !cb.checked);
            }
            updateEditWinnerOptions();
        };

        const editWinner = document.getElementById('editWinner');
        
        window.updateEditWinnerOptions = function() {
            const checkedBoxes = Array.from(document.querySelectorAll('#editScoresContainer input[type="checkbox"]:checked'));
            const selectedWinnerId = editWinner.value;
            
            let winnerOptionsHtml = checkedBoxes.map(cb => {
                const pId = parseInt(cb.value);
                const player = potentialPlayers.find(p => p.id === pId);
                return `<option value="${pId}">🏆 ${player.name}</option>`;
            }).join('');
            winnerOptionsHtml += `<option value="0">⚪ ${t('option_draw', 'Unentschieden')}</option>`;
            editWinner.innerHTML = winnerOptionsHtml;
            
            const hasWinner = checkedBoxes.some(cb => parseInt(cb.value) === parseInt(selectedWinnerId));
            if (hasWinner) {
                editWinner.value = selectedWinnerId;
            } else {
                editWinner.value = "0";
            }
        };

        let inputsHtml = `<div id="editScoresInputs">`;
        if (s.win_condition === 2) {
            inputsHtml += `<div class="text-center text-muted mb-3">${t('msg_no_scores_game', 'Dieses Spiel hat keine Punkte. Du kannst nur den Gewinner anpassen.')}</div>`;
        } else {
            potentialPlayers.forEach((p, idx) => {
                const isParticipating = s.scores.some(sc => sc.player_id === p.id || sc.name === p.name);
                const pScore = s.scores.find(sc => sc.player_id === p.id || sc.name === p.name);
                const scoreVal = pScore ? pScore.score_value : '';
                const memberIdx = allPlayers.findIndex(mp => mp.id === p.id || mp.name === p.name);
                const colorClass = memberIdx === 0 ? 'adrian-color' : (memberIdx === 1 ? 'lea-color' : (memberIdx === 2 ? 'text-success' : (p.id < 0 ? 'text-white-50' : 'text-warning')));
                
                inputsHtml += `
                <div id="editScoreContainer_${p.id}" class="d-flex justify-content-between align-items-center mb-3 ${isParticipating ? '' : 'd-none'}">
                    <span class="${colorClass} fw-bold">${p.name}</span>
                    <input type="number" id="editScore_${p.id}" value="${scoreVal}" class="form-control bg-dark text-white border-secondary border-opacity-50 w-50 text-end" inputmode="numeric">
                </div>`;
            });
        }
        inputsHtml += `</div>`;
        
        editScoresContainer.innerHTML = checklistHtml + inputsHtml;

        updateEditWinnerOptions();
        editWinner.value = currentEditSessionData.winner_id;
        
        document.getElementById('editSessionComment').value = currentEditSessionData.comment;
        
        const editModal = new bootstrap.Modal(document.getElementById('editSessionModal'));
        editModal.show();
        
        document.getElementById('saveEditSessionBtn').onclick = async () => {
            const winVal = parseInt(editWinner.value);
            const checkedBoxes = Array.from(document.querySelectorAll('#editScoresContainer input[type="checkbox"]:checked'));
            
            if (checkedBoxes.length === 0) {
                alert(t('msg_select_at_least_one_player', 'Bitte wähle mindestens einen Spieler aus!'));
                return;
            }
            
            const scores = checkedBoxes.map(cb => {
                const pId = parseInt(cb.value);
                const scInput = document.getElementById(`editScore_${pId}`);
                const scVal = scInput ? (parseInt(scInput.value) || 0) : 0;
                return {
                    player_id: pId,
                    score: s.win_condition === 2 ? 0 : scVal,
                    is_winner: pId === winVal
                };
            });

            const payload = {
                play_date: document.getElementById('editSessionDate').value + " 12:00:00",
                duration_minutes: parseInt(document.getElementById('editSessionDuration').value) || 0,
                scores_json: JSON.stringify(scores),
                comment: document.getElementById('editSessionComment').value
            };
            
            try {
                const res = await authFetch(`/session/${currentEditSessionData.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res || !res.ok) throw new Error();
                editModal.hide();
                loadHistory();
                if (typeof loadDashboard === 'function') loadDashboard();
            } catch (e) {
                alert(t('msg_error_save', 'Fehler beim Speichern der Änderungen.'));
            }
        };
    };

    modal.show();
};

window.deleteSession = async function(sessionId) {
    showConfirmModal(t('title_delete_session', "Partie löschen"), t('confirm_delete_session', "Willst du diese Partie wirklich aus dem Verlauf löschen?"), async () => {
        try {
            const res = await authFetch(`/session/${sessionId}`, { method: 'DELETE' });
            if (!res || !res.ok) throw new Error();
            bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
            loadHistory(); 
            if (typeof loadDashboard === 'function') loadDashboard(); 
        } catch (e) { alert(t('msg_error_delete', "Fehler beim Löschen.")); }
    });
};

window.filterHistory = function() {
    const term = document.getElementById('historyFilter').value.toLowerCase();
    const dateFromStr = document.getElementById('historyDateFrom').value;
    const dateToStr = document.getElementById('historyDateTo').value;
    
    let dateFrom = dateFromStr ? new Date(dateFromStr) : null;
    let dateTo = dateToStr ? new Date(dateToStr) : null;
    
    if (dateFrom) dateFrom.setHours(0,0,0,0);
    if (dateTo) dateTo.setHours(23,59,59,999);

    const lang = localStorage.getItem('app_lang') || 'de';
    const dateLocale = lang === 'en' ? 'en-US' : 'de-DE';

    renderHistory(allSessions.filter(s => {
        const gameMatch = s.game_name.toLowerCase().includes(term);
        const playerMatch = s.scores.some(sc => sc.name.toLowerCase().includes(term));
        const dateMatch = new Date(s.play_date).toLocaleDateString(dateLocale).includes(term);
        const textMatch = term === '' || gameMatch || playerMatch || dateMatch;
        
        let sessionDate = new Date(s.play_date);
        let rangeMatch = true;
        if (dateFrom && sessionDate < dateFrom) rangeMatch = false;
        if (dateTo && sessionDate > dateTo) rangeMatch = false;
        
        return textMatch && rangeMatch;
    }));
};

// Return to profile modal events
document.addEventListener('DOMContentLoaded', () => {
    const detailModalEl = document.getElementById('detailModal');
    if (detailModalEl) {
        detailModalEl.addEventListener('hidden.bs.modal', () => {
            if (window.isOpeningEditModal) {
                window.isOpeningEditModal = false;
                return;
            }
            if (window.returnToGameProfileData) {
                const d = window.returnToGameProfileData;
                window.returnToGameProfileData = null;
                setTimeout(() => {
                    if (typeof showGameProfile === 'function') {
                        showGameProfile(d.id, d.bgg_id, d.image_url, d.min_players, d.max_players, d.playing_time, d.weight, d.category);
                    }
                }, 350);
            }
        });
    }

    const editModalEl = document.getElementById('editSessionModal');
    if (editModalEl) {
        editModalEl.addEventListener('hidden.bs.modal', () => {
            if (window.returnToGameProfileData) {
                const d = window.returnToGameProfileData;
                window.returnToGameProfileData = null;
                setTimeout(() => {
                    if (typeof showGameProfile === 'function') {
                        showGameProfile(d.id, d.bgg_id, d.image_url, d.min_players, d.max_players, d.playing_time, d.weight, d.category);
                    }
                }, 350);
            }
        });
    }
});
