window.showGameProfile = async function(gameId, bggId, imageUrl, minP, maxP, time, weight, currentCat) {
    // Kombinierter Fetch: Basis-Stats und Advanced-Stats laden
    const [resBasic, resAdv] = await Promise.all([
        authFetch(`/stats/game/${gameId}`),
        authFetch(`/stats/game/${gameId}/advanced`)
    ]);
    const basicData = await resBasic.json();
    const advData = await resAdv.json();

    const modal = new bootstrap.Modal(document.getElementById('gameProfileModal'));
    
    // Basis-Header füllen
    document.getElementById('profileGameName').innerText = basicData.game_name;
    
    const winsContainer = document.getElementById('profileWinsContainer');
    if (winsContainer) {
        let winsHtml = '';
        allPlayers.forEach((p, idx) => {
            const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
            const pWins = basicData.wins[p.name] || 0;
            winsHtml += `
            <div class="text-center px-2 flex-grow-1" style="min-width: 60px;">
                <small class="${colorClass} d-block x-small fw-bold tracking-wider text-truncate" style="max-width: 90px; margin: 0 auto;">${p.name}</small>
                <h3 class="fw-bold mb-0 text-white mt-1" style="font-size: 1.5rem;">${pWins}</h3>
            </div>`;
            if (idx < allPlayers.length - 1) {
                winsHtml += `<div class="text-white-50 small align-self-center mt-3">VS</div>`;
            }
        });
        winsContainer.innerHTML = winsHtml;
    }
    
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
    if (basicData.win_condition === 2) {
        toggleBtn.innerText = "🔄 Regel: Keine Punkte (nur Sieger)";
    } else if (basicData.win_condition === 1) {
        toggleBtn.innerText = "🔄 Regel: Niedrigste Punkte gewinnen";
    } else {
        toggleBtn.innerText = "🔄 Regel: Höchste Punkte gewinnen";
    }
    toggleBtn.onclick = async () => {
        try {
            const res = await authFetch(`/toggle_win_condition/${gameId}`, { method: 'PATCH' });
            if (!res || !res.ok) throw new Error();
            modal.hide(); setTimeout(() => showGameProfile(gameId, bggId, imageUrl, minP, maxP, time, weight, currentCat), 350);
        } catch (e) { alert("Fehler beim Umstellen der Wertungsregel."); }
    };

    // Render players selection
    window.profileActiveGuests = [];
    renderProfilePlayers();
    
    // Category Dropdown
    const select = document.getElementById('profileCategorySelect');
    const categories = new Set(window.allCollectionGames.map(g => (g.category && g.category !== 'Standard') ? g.category : 'Alle Spiele'));
    categories.add('Archiv'); // Default offer
    
    if(!currentCat || currentCat === 'Standard') currentCat = 'Alle Spiele';
    let opts = Array.from(categories).sort().map(c => `<option value="${c}" ${c === currentCat ? 'selected' : ''}>${c}</option>`);
    opts.push('<option value="__NEW__">+ Neue Kategorie...</option>');
    select.innerHTML = opts.join('');
    
    document.getElementById('changeCategoryBtn').onclick = () => changeGameCategory(gameId);

    // History Liste (Letzte 3)
    document.getElementById('profileHistoryList').innerHTML = basicData.history.slice(0, 3).map(s => {
        const winners = s.scores.filter(sc => sc.is_winner === 1);
        let winnerText = 'Remis';
        let colorClass = 'text-muted';
        if (winners.length > 0) {
            winnerText = winners.map(w => w.name).join(' & ') + ' 🏆';
            if (winners.length === 1) {
                const idx = allPlayers.findIndex(p => p.id === winners[0].player_id || p.name === winners[0].name);
                colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
            } else {
                colorClass = 'text-info';
            }
        }
        return `<div class="list-group-item border-0 px-3 py-2 mb-1 rounded-3 d-flex justify-content-between align-items-center" 
                     onclick="showSessionDetailsFromProfile(${s.id})" style="cursor: pointer; background: rgba(255,255,255,0.03);">
            <span class="text-white-50">${new Date(s.play_date).toLocaleDateString('de-DE')}</span>
            <span class="fw-bold ${colorClass}">${winnerText}</span>
        </div>`;
    }).join('');

    // Advanced Stats Injection
    const advBody = document.getElementById('profileAdvancedStats');
    if (advData.total_games === 0) {
        advBody.innerHTML = `<div class="text-center text-muted p-3">Noch keine Spiele geloggt!</div>`;
    } else if (advData.win_condition === 2) {
        advBody.innerHTML = `
            <div class="d-flex justify-content-between mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-white-50">Gespielte Partien:</span>
                <span class="text-white fw-bold">${advData.total_games}</span>
            </div>
            <div class="text-center text-muted p-3">
                Dieses Spiel wird ohne Punkte gewertet. Im Verlauf siehst du, wer gewonnen hat.
            </div>
        `;
    } else {
        const recordHolder = advData.all_time_high ? `${advData.all_time_high.name} (${advData.all_time_high.score_value} Pkt)` : "-";
        
        let avgScoresHtml = '';
        let maxScoresHtml = '';
        
        allPlayers.forEach((p, idx) => {
            const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
            const pStats = advData.player_stats[p.name] || { avg: 0, max: 0 };
            avgScoresHtml += `<span class="${colorClass} fw-bold" style="font-size: 0.85rem;">${p.name}: ${pStats.avg}</span>`;
            maxScoresHtml += `<span class="${colorClass} fw-bold" style="font-size: 0.85rem;">${p.name}: ${pStats.max}</span>`;
        });
        
        advBody.innerHTML = `
            <div class="d-flex justify-content-between mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-white-50">Gespielte Partien:</span>
                <span class="text-white fw-bold">${advData.total_games}</span>
            </div>
            <div class="d-flex flex-column mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-muted mb-1 x-small text-uppercase tracking-wider fw-bold">Durchschnittliche Punkte</span>
                <div class="d-flex justify-content-between flex-wrap gap-2">
                    ${avgScoresHtml}
                </div>
            </div>
            <div class="d-flex flex-column mb-3">
                <span class="text-muted mb-1 x-small text-uppercase tracking-wider fw-bold">Persönliche Rekorde</span>
                <div class="d-flex justify-content-between flex-wrap gap-2">
                    ${maxScoresHtml}
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
        const checkedIds = Array.from(document.querySelectorAll('#profilePlayersSelectContainer input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
        if (checkedIds.length === 0) {
            alert("Bitte wähle mindestens einen Spieler aus!");
            return;
        }
        if (typeof selectGame === 'function') setTimeout(() => selectGame(gameId, basicData.game_name, imageUrl, checkedIds), 350); 
    };
    document.getElementById('deleteGameBtn').onclick = () => deleteGame(gameId);
    
    modal.show();
};

window.changeGameCategory = async function(gameId) {
    const select = document.getElementById('profileCategorySelect');
    let newCat = select.value;
    if (newCat === '__NEW__') {
        newCat = prompt("Name der neuen Kategorie (z.B. Exit Games, Party):");
        if (!newCat || newCat.trim() === '') return;
        newCat = newCat.trim();
    }
    
    try {
        const res = await authFetch(`/game/${gameId}/category?category=${encodeURIComponent(newCat)}`, { method: 'PATCH' });
        if (!res || !res.ok) throw new Error();
        if (typeof loadCollection === 'function') loadCollection();
        bootstrap.Modal.getInstance(document.getElementById('gameProfileModal')).hide();
    } catch (e) {
        alert("Fehler beim Verschieben.");
    }
};

window.deleteGame = async function(gameId) {
    showConfirmModal("Spiel löschen", "Willst du dieses Spiel wirklich aus der Sammlung löschen?", async () => {
        try {
            const res = await authFetch(`/delete/${gameId}`, { method: 'DELETE' });
            if (!res || !res.ok) { const data = await res.json(); alert(data.detail || "Konnte nicht gelöscht werden."); return; }
            bootstrap.Modal.getInstance(document.getElementById('gameProfileModal')).hide();
            if (typeof loadCollection === 'function') loadCollection(); 
        } catch (e) { alert("Fehler beim Löschen."); }
    });
};

// ─── Profil-Einstellungen (Username / Passwort ändern) ────────────────────────

window.openProfileSettings = function() {
    const user = Auth.getUser();
    if (!user) return;
    
    const usernameEl = document.getElementById('settingsUsername');
    const newPwEl = document.getElementById('settingsNewPassword');
    const curPwEl = document.getElementById('settingsCurrentPassword');
    const alertEl = document.getElementById('profileSettingsAlert');
    
    if (usernameEl) usernameEl.value = user.username;
    if (newPwEl) newPwEl.value = '';
    if (curPwEl) curPwEl.value = '';
    if (alertEl) { alertEl.classList.add('d-none'); alertEl.textContent = ''; }
    
    const modal = new bootstrap.Modal(document.getElementById('profileSettingsModal'));
    modal.show();
};

window.saveProfileSettings = async function() {
    const newUsername = document.getElementById('settingsUsername').value.trim();
    const newPassword = document.getElementById('settingsNewPassword').value;
    const currentPassword = document.getElementById('settingsCurrentPassword').value;
    const alertEl = document.getElementById('profileSettingsAlert');
    const btn = document.getElementById('saveProfileSettingsBtn');
    
    // Validierung
    if (!currentPassword) {
        alertEl.textContent = 'Bitte gib dein aktuelles Passwort zur Bestätigung ein.';
        alertEl.className = 'alert alert-danger rounded-3 small py-2 px-3';
        alertEl.classList.remove('d-none');
        return;
    }
    
    if (!newUsername && !newPassword) {
        alertEl.textContent = 'Bitte ändere mindestens den Username oder das Passwort.';
        alertEl.className = 'alert alert-warning rounded-3 small py-2 px-3';
        alertEl.classList.remove('d-none');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Speichern...';
    alertEl.classList.add('d-none');
    
    try {
        const body = {
            current_password: currentPassword
        };
        if (newUsername) body.new_username = newUsername;
        if (newPassword) body.new_password = newPassword;
        
        const res = await authFetch('/auth/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (!res) return;
        const data = await res.json();
        
        if (!res.ok) {
            alertEl.textContent = data.detail || 'Fehler beim Speichern.';
            alertEl.className = 'alert alert-danger rounded-3 small py-2 px-3';
            alertEl.classList.remove('d-none');
            return;
        }
        
        // Token und User-Daten aktualisieren
        if (data.access_token && data.user) {
            Auth._save(data.access_token, data.user);
            const headerUser = document.getElementById('headerUsername');
            if (headerUser) headerUser.textContent = data.user.username;
        }
        
        alertEl.textContent = '✅ Profil erfolgreich aktualisiert!';
        alertEl.className = 'alert alert-success rounded-3 small py-2 px-3';
        alertEl.classList.remove('d-none');
        
        // Passwort-Felder leeren
        document.getElementById('settingsNewPassword').value = '';
        document.getElementById('settingsCurrentPassword').value = '';
        
        // Nach 2 Sekunden Modal schließen und App neu laden
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('profileSettingsModal'));
            if (modal) modal.hide();
            // App-State aktualisieren
            if (typeof loadUserAndStart === 'function') loadUserAndStart();
        }, 2000);
        
    } catch (e) {
        alertEl.textContent = 'Verbindungsfehler. Bitte versuche es erneut.';
        alertEl.className = 'alert alert-danger rounded-3 small py-2 px-3';
        alertEl.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '💾 Änderungen speichern';
    }
};

window.toggleProfilePlayerBadge = function(cb, pId) {
    const idNum = parseInt(pId);
    if (idNum < 0) {
        if (!cb.checked) {
            window.profileActiveGuests = window.profileActiveGuests.filter(g => g.id !== idNum);
            renderProfilePlayers();
            return;
        }
    }
    const lbl = document.getElementById(`profile_lbl_p_${pId}`);
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

window.renderProfilePlayers = function() {
    const playersCont = document.getElementById('profilePlayersSelectContainer');
    if (!playersCont) return;

    let html = allPlayers.map(p => {
        const cb = document.getElementById(`profile_p_${p.id}`);
        const isChecked = cb ? cb.checked : true;
        return `
        <div class="form-check form-check-inline m-0">
            <input class="form-check-input d-none" type="checkbox" id="profile_p_${p.id}" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="toggleProfilePlayerBadge(this, '${p.id}')">
            <label class="form-check-label badge rounded-pill px-3 py-2 border fs-6 d-flex align-items-center gap-1" for="profile_p_${p.id}" id="profile_lbl_p_${p.id}" style="cursor: pointer; transition: all 0.2s ease; ${isChecked ? 'background-color: var(--bs-primary); border-color: var(--bs-primary); opacity: 1;' : 'background-color: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); opacity: 0.5;'}">
                👥 ${p.name}
            </label>
        </div>`;
    }).join('');

    html += (window.profileActiveGuests || []).map(g => `
        <div class="form-check form-check-inline m-0">
            <input class="form-check-input d-none" type="checkbox" id="profile_p_${g.id}" value="${g.id}" checked onchange="toggleProfilePlayerBadge(this, '${g.id}')">
            <label class="form-check-label badge rounded-pill px-3 py-2 border fs-6 d-flex align-items-center gap-1" for="profile_p_${g.id}" id="profile_lbl_p_${g.id}" style="cursor: pointer; transition: all 0.2s ease; background-color: var(--bs-primary); border-color: var(--bs-primary); opacity: 1;">
                👤 ${g.name}
            </label>
        </div>`).join('');

    html += `
        <button class="btn btn-outline-secondary rounded-pill px-3 py-1 fs-6 d-flex align-items-center gap-1 m-0" type="button" onclick="showProfileGuestModal()" style="height: 38px; border-style: dashed;">
            ➕ Gast
        </button>
    `;
    playersCont.innerHTML = html;
};

window.showProfileGuestModal = async function() {
    document.getElementById('profileNewGuestNameInput').value = '';
    const err = document.getElementById('profileNewGuestError');
    if (err) {
        err.textContent = '';
        err.classList.add('d-none');
    }
    
    let guests = [];
    try {
        const res = await authFetch('/guests');
        if (res && res.ok) {
            const data = await res.json();
            guests = data.guests || [];
        }
    } catch(e) {
        console.error(e);
    }
    
    const activeIds = (window.profileActiveGuests || []).map(g => g.id);
    const availableGuests = guests.filter(g => !activeIds.includes(-g.id));
    
    const listCont = document.getElementById('profileExistingGuestsList');
    if (listCont) {
        if (availableGuests.length === 0) {
            listCont.innerHTML = `<div class="text-center text-muted small p-2">Keine weiteren Gäste vorhanden.</div>`;
        } else {
            listCont.innerHTML = availableGuests.map(g => `
                <div class="d-flex justify-content-between align-items-center p-2 rounded mb-2" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);">
                    <span class="text-white small fw-bold">👤 ${g.name}</span>
                    <button class="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-0.5 fw-bold" type="button" onclick="selectGuestForProfile(${g.id}, '${g.name.replace(/'/g, "\\'")}')" style="font-size: 0.7rem;">
                        ➕ Hinzufügen
                    </button>
                </div>
            `).join('');
        }
    }
    
    const modal = new bootstrap.Modal(document.getElementById('profileGuestModal'));
    modal.show();
};

window.selectGuestForProfile = function(guestId, name) {
    if (!window.profileActiveGuests) window.profileActiveGuests = [];
    
    const idNum = -Math.abs(guestId);
    if (!window.profileActiveGuests.some(g => g.id === idNum)) {
        window.profileActiveGuests.push({ id: idNum, name: name });
    }
    
    const modalEl = document.getElementById('profileGuestModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    
    renderProfilePlayers();
};

window.submitNewGuestFromProfile = async function() {
    const input = document.getElementById('profileNewGuestNameInput');
    const err = document.getElementById('profileNewGuestError');
    const name = input ? input.value.trim() : '';
    
    if (!name) {
        if (err) {
            err.textContent = 'Bitte einen Namen eingeben.';
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
            selectGuestForProfile(data.id, data.name);
        } else {
            if (err) {
                err.textContent = data.detail || 'Fehler beim Erstellen.';
                err.classList.remove('d-none');
            }
        }
    } catch(e) {
        if (err) {
            err.textContent = 'Verbindungsfehler.';
            err.classList.remove('d-none');
        }
    }
};

window.showSessionDetailsFromProfile = function(sessionId) {
    const profileModalEl = document.getElementById('gameProfileModal');
    const profileModal = bootstrap.Modal.getInstance(profileModalEl);
    if (profileModal) {
        profileModal.hide();
        
        const gameName = document.getElementById('profileGameName').innerText;
        const game = window.allCollectionGames ? window.allCollectionGames.find(g => g.name === gameName) : null;
        if (game) {
            window.returnToGameProfileData = {
                id: game.id,
                bgg_id: game.bgg_id,
                image_url: game.image_url,
                min_players: game.min_players,
                max_players: game.max_players,
                playing_time: game.playing_time,
                weight: game.weight,
                category: game.category
            };
        }
    }
    
    setTimeout(() => {
        if (typeof showDetails === 'function') {
            showDetails(sessionId);
        }
    }, 350);
};
