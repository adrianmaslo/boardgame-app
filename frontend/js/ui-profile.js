window.showGameProfile = async function(gameId, bggId, imageUrl, minP, maxP, time, weight, currentCat, isRefresh = false) {
    // Kombinierter Fetch: Basis-Stats und Advanced-Stats laden
    const [resBasic, resAdv] = await Promise.all([
        authFetch(`/stats/game/${gameId}`),
        authFetch(`/stats/game/${gameId}/advanced`)
    ]);
    const basicData = await resBasic.json();
    const advData = await resAdv.json();

    const modalEl = document.getElementById('gameProfileModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    
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
                <h3 class="fw-bold mb-0 text-main mt-1" style="font-size: 1.5rem;">${pWins}</h3>
            </div>`;
            if (idx < allPlayers.length - 1) {
                winsHtml += `<div class="text-muted small align-self-center mt-3 fw-bold">VS</div>`;
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
    const bggLink = (bggId && bggId !== 'null') ? `<a href="https://boardgamegeek.com/boardgame/${bggId}/files" target="_blank" class="btn btn-sm w-100 rounded-pill mb-2 fw-bold text-muted" style="background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);">${t('btn_bgg_rules', '📖 BGG Regeln & Infos')}</a>` : '';
    document.getElementById('profileBggInfo').innerHTML = bggInfoHtml + bggLink;
    
    // Win Condition Toggle
    const toggleBtn = document.getElementById('toggleWinCondBtn');
    if (basicData.win_condition === 2) {
        toggleBtn.innerText = t('btn_rule_no_points', '🔄 Regel: Keine Punkte (nur Sieger)');
    } else if (basicData.win_condition === 1) {
        toggleBtn.innerText = t('btn_rule_lowest_wins', '🔄 Regel: Niedrigste Punkte gewinnen');
    } else {
        toggleBtn.innerText = t('btn_rule_highest_wins', '🔄 Regel: Höchste Punkte gewinnen');
    }
    toggleBtn.onclick = async () => {
        try {
            const res = await authFetch(`/toggle_win_condition/${gameId}`, { method: 'PATCH' });
            if (!res || !res.ok) throw new Error();
            if (typeof showToast === 'function') {
                showToast(t('msg_rule_updated', 'Regel erfolgreich geändert!'));
            }
            showGameProfile(gameId, bggId, imageUrl, minP, maxP, time, weight, currentCat, true);
        } catch (e) { 
            if (typeof showToast === 'function') {
                showToast(t('msg_rule_update_error', 'Fehler beim Umstellen der Wertungsregel.')); 
            } else {
                alert(t('msg_rule_update_error', 'Fehler beim Umstellen der Wertungsregel.'));
            }
        }
    };

    // Render players selection
    window.profileActiveGuests = [];
    renderProfilePlayers();
    
    // Category Dropdown
    const select = document.getElementById('profileCategorySelect');
    const allGamesText = t('label_all_games', 'Alle Spiele');
    const archiveText = t('label_archive', 'Archiv');
    const categories = new Set(window.allCollectionGames.map(g => {
        if (!g.category || g.category === 'Standard' || g.category === 'Alle Spiele') {
            return allGamesText;
        }
        if (g.category === 'Archiv') {
            return archiveText;
        }
        return g.category;
    }));
    categories.add(archiveText); // Default offer
    
    let currentCatTranslated = currentCat;
    if (!currentCat || currentCat === 'Standard' || currentCat === 'Alle Spiele') {
        currentCatTranslated = allGamesText;
    } else if (currentCat === 'Archiv') {
        currentCatTranslated = archiveText;
    }

    let opts = Array.from(categories).sort().map(c => `<option value="${c}" ${c === currentCatTranslated ? 'selected' : ''}>${c}</option>`);
    opts.push(`<option value="__NEW__">${t('btn_new_category_option', '+ Neue Kategorie...')}</option>`);
    select.innerHTML = opts.join('');
    document.getElementById('changeCategoryBtn').onclick = () => changeGameCategory(gameId);

    // History Liste (Letzte 3)
    const lang = localStorage.getItem('app_lang') || 'de';
    const dateLocale = lang === 'en' ? 'en-US' : 'de-DE';
    document.getElementById('profileHistoryList').innerHTML = basicData.history.slice(0, 3).map(s => {
        const winners = s.scores.filter(sc => sc.is_winner === 1);
        let winnerText = t('option_draw', 'Remis');
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
            <span class="text-white-50">${new Date(s.play_date).toLocaleDateString(dateLocale)}</span>
            <span class="fw-bold ${colorClass}">${winnerText}</span>
        </div>`;
    }).join('');

    // Advanced Stats Injection
    const advBody = document.getElementById('profileAdvancedStats');
    if (advData.total_games === 0) {
        advBody.innerHTML = `<div class="text-center text-muted p-3">${t('msg_no_games_logged', 'Noch keine Spiele geloggt!')}</div>`;
    } else if (advData.win_condition === 2) {
        advBody.innerHTML = `
            <div class="d-flex justify-content-between mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-white-50">${t('label_games_played', 'Gespielte Partien:')}</span>
                <span class="text-white fw-bold">${advData.total_games}</span>
            </div>
            <div class="text-center text-muted p-3">
                ${t('msg_no_scores_game', 'Dieses Spiel wird ohne Punkte gewertet. Im Verlauf siehst du, wer gewonnen hat.')}
            </div>
        `;
    } else {
        const recordHolder = advData.all_time_high ? `${advData.all_time_high.name} (${advData.all_time_high.score_value} ${t('label_points_short', 'Pkt')})` : "-";
        
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
                <span class="text-white-50">${t('label_games_played', 'Gespielte Partien:')}</span>
                <span class="text-white fw-bold">${advData.total_games}</span>
            </div>
            <div class="d-flex flex-column mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-muted mb-1 x-small text-uppercase tracking-wider fw-bold">${t('msg_average_points', 'Durchschnittliche Punkte')}</span>
                <div class="d-flex justify-content-between flex-wrap gap-2">
                    ${avgScoresHtml}
                </div>
            </div>
            <div class="d-flex flex-column mb-3">
                <span class="text-muted mb-1 x-small text-uppercase tracking-wider fw-bold">${t('msg_personal_records', 'Persönliche Rekorde')}</span>
                <div class="d-flex justify-content-between flex-wrap gap-2">
                    ${maxScoresHtml}
                </div>
            </div>
            <div class="text-center p-2 rounded-3" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2);">
                <span class="d-block text-success x-small fw-bold text-uppercase tracking-wider">${t('msg_all_time_high', 'All-Time Bestergebnis')}</span>
                <span class="text-white fw-bold">${recordHolder}</span>
            </div>
        `;
    }

    document.getElementById('startGameBtn').onclick = () => { 
        modal.hide(); 
        const checkedIds = Array.from(document.querySelectorAll('#profilePlayersSelectContainer input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
        if (checkedIds.length === 0) {
            alert(t('msg_select_at_least_one_player', 'Bitte wähle mindestens einen Spieler aus!'));
            return;
        }
        if (typeof selectGame === 'function') setTimeout(() => selectGame(gameId, basicData.game_name, imageUrl, checkedIds), 350); 
    };
    document.getElementById('deleteGameBtn').onclick = () => deleteGame(gameId);
    
    if (!isRefresh) {
        modal.show();
    }
};

window.changeGameCategory = async function(gameId) {
    const select = document.getElementById('profileCategorySelect');
    let newCat = select.value;
    if (newCat === '__NEW__') {
        newCat = prompt(t('prompt_new_category', "Name der neuen Kategorie (z.B. Exit Games, Party):"));
        if (!newCat || newCat.trim() === '') return;
        newCat = newCat.trim();
    }
    
    // Map translated name back to internal database standard value
    let dbCat = newCat;
    if (newCat === t('label_all_games', 'Alle Spiele')) {
        dbCat = 'Standard';
    } else if (newCat === t('label_archive', 'Archiv')) {
        dbCat = 'Archiv';
    }
    
    try {
        const res = await authFetch(`/game/${gameId}/category?category=${encodeURIComponent(dbCat)}`, { method: 'PATCH' });
        if (!res || !res.ok) throw new Error();
        if (typeof loadCollection === 'function') loadCollection();
        bootstrap.Modal.getInstance(document.getElementById('gameProfileModal')).hide();
    } catch (e) {
        alert(t('msg_error_move', "Fehler beim Verschieben."));
    }
};

window.deleteGame = async function(gameId) {
    showConfirmModal(t('title_delete_game', "Spiel löschen"), t('confirm_delete_game', "Willst du dieses Spiel wirklich aus der Sammlung löschen?"), async () => {
        try {
            const res = await authFetch(`/delete/${gameId}`, { method: 'DELETE' });
            if (!res || !res.ok) { const data = await res.json(); alert(data.detail || t('msg_error_delete', "Fehler beim Löschen.")); return; }
            bootstrap.Modal.getInstance(document.getElementById('gameProfileModal')).hide();
            if (typeof loadCollection === 'function') loadCollection(); 
        } catch (e) { alert(t('msg_error_delete', "Fehler beim Löschen.")); }
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

    // Sprachauswahl setzen
    const currentLang = localStorage.getItem('app_lang') || 'de';
    const langSelect = document.getElementById('settingsLanguage');
    if (langSelect) langSelect.value = currentLang;

    // Theme setzen
    const currentTheme = localStorage.getItem('app_theme') || 'dark';
    const themeSelect = document.getElementById('settingsTheme');
    if (themeSelect) themeSelect.value = currentTheme;

    // Avatar Emojis renderen
    const avatars = ['🦁', '🐯', '🤖', '🧙‍♂️', '🦄', '🦖', '🍕', '🎲', '🃏', '🏆', '🐱', '🐶', '🦊', '🐻', '🐼', '🐨'];
    const container = document.getElementById('settingsAvatarContainer');
    const selectedAvatarInput = document.getElementById('settingsSelectedAvatar');
    
    if (container) {
        let currentIcon = user.avatar_icon || '👤';
        selectedAvatarInput.value = currentIcon;
        
        container.innerHTML = avatars.map(a => {
            const isSelected = a === currentIcon;
            return `
            <span class="avatar-emoji-option p-2 fs-4 rounded cursor-pointer ${isSelected ? 'bg-primary' : ''}" 
                  style="transition: all 0.2s; user-select: none;"
                  onclick="selectSettingsAvatar(this, '${a}')">
                ${a}
            </span>`;
        }).join('');
    }

    // Lieblingsspiel dropdown befüllen
    const favGameSelect = document.getElementById('settingsFavoriteGame');
    if (favGameSelect) {
        let optionsHtml = `<option value="" data-i18n="option_none_selected">${t('option_none_selected', 'Keines ausgewählt')}</option>`;
        if (window.allCollectionGames) {
            window.allCollectionGames.forEach(g => {
                const isSelected = g.id === user.favorite_game_id;
                optionsHtml += `<option value="${g.id}" ${isSelected ? 'selected' : ''}>${g.name}</option>`;
            });
        }
        favGameSelect.innerHTML = optionsHtml;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('profileSettingsModal'));
    modal.show();
};

window.selectSettingsAvatar = function(el, emoji) {
    document.querySelectorAll('.avatar-emoji-option').forEach(option => {
        option.classList.remove('bg-primary');
    });
    el.classList.add('bg-primary');
    document.getElementById('settingsSelectedAvatar').value = emoji;
};

window.saveProfileSettings = async function() {
    const newUsername = document.getElementById('settingsUsername').value.trim();
    const newPassword = document.getElementById('settingsNewPassword').value;
    const currentPassword = document.getElementById('settingsCurrentPassword').value;
    const avatarIcon = document.getElementById('settingsSelectedAvatar').value;
    const favoriteGameIdVal = document.getElementById('settingsFavoriteGame').value;
    const favoriteGameId = favoriteGameIdVal ? parseInt(favoriteGameIdVal) : 0;
    const securityQuestion = document.getElementById('settingsSecurityQuestion').value;
    const securityAnswer = document.getElementById('settingsSecurityAnswer').value.trim();
    const alertEl = document.getElementById('profileSettingsAlert');
    const btn = document.getElementById('saveProfileSettingsBtn');
    
    // Validierung: Aktuelles Passwort ist nur erforderlich, wenn ein neues Passwort festgelegt wird
    if (newPassword && !currentPassword) {
        alertEl.textContent = t('msg_enter_current_password', 'Bitte gib dein aktuelles Passwort zur Bestätigung ein.');
        alertEl.className = 'alert alert-danger rounded-3 small py-2 px-3';
        alertEl.classList.remove('d-none');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t('btn_saving', 'Speichern...')}`;
    alertEl.classList.add('d-none');
    
    try {
        const body = {
            avatar_icon: avatarIcon,
            favorite_game_id: favoriteGameId
        };
        if (currentPassword) body.current_password = currentPassword;
        if (newUsername) body.new_username = newUsername;
        if (newPassword) body.new_password = newPassword;
        if (securityQuestion && securityAnswer) {
            body.security_question = securityQuestion;
            body.security_answer = securityAnswer;
        }
        
        const res = await authFetch('/auth/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (!res) return;
        const data = await res.json();
        
        if (!res.ok) {
            alertEl.textContent = data.detail || t('msg_save_error', 'Fehler beim Speichern.');
            alertEl.className = 'alert alert-danger rounded-3 small py-2 px-3';
            alertEl.classList.remove('d-none');
            return;
        }
        
        // Token und User-Daten aktualisieren
        if (data.access_token && data.user) {
            Auth._save(data.access_token, data.user);
            const headerUser = document.getElementById('headerUsername');
            if (headerUser) {
                const icon = data.user.avatar_icon || '👤';
                headerUser.textContent = `${icon} ${data.user.username}`;
            }
        }
        
        alertEl.textContent = t('msg_profile_updated', '✅ Profil erfolgreich aktualisiert!');
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
        alertEl.textContent = t('msg_connection_error', 'Verbindungsfehler. Bitte versuche es erneut.');
        alertEl.className = 'alert alert-danger rounded-3 small py-2 px-3';
        alertEl.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.innerHTML = t('btn_save_changes', '💾 Änderungen speichern');
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
        <div class="m-0">
            <input class="d-none" type="checkbox" id="profile_p_${p.id}" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="toggleProfilePlayerBadge(this, '${p.id}')">
            <label class="badge rounded-pill px-3 py-2 border fs-6 d-flex align-items-center gap-2 m-0" for="profile_p_${p.id}" id="profile_lbl_p_${p.id}" style="cursor: pointer; transition: all 0.2s ease; ${isChecked ? 'background-color: var(--bs-primary); border-color: var(--bs-primary); opacity: 1;' : 'background-color: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); opacity: 0.5;'}">
                <span style="font-size: 1.1rem; line-height: 1;">${p.avatar_icon || '👤'}</span> <span>${p.name}</span>
            </label>
        </div>`;
    }).join('');

    html += (window.profileActiveGuests || []).map(g => `
        <div class="m-0">
            <input class="d-none" type="checkbox" id="profile_p_${g.id}" value="${g.id}" checked onchange="toggleProfilePlayerBadge(this, '${g.id}')">
            <label class="badge rounded-pill px-3 py-2 border fs-6 d-flex align-items-center gap-2 m-0" for="profile_p_${g.id}" id="profile_lbl_p_${g.id}" style="cursor: pointer; transition: all 0.2s ease; background-color: var(--bs-primary); border-color: var(--bs-primary); opacity: 1;">
                <span style="font-size: 1.1rem; line-height: 1;">👤</span> <span>${g.name}</span>
            </label>
        </div>`).join('');

    html += `
        <button class="btn btn-outline-secondary rounded-pill px-3 py-1 fs-6 d-flex align-items-center gap-1 m-0" type="button" onclick="showProfileGuestModal()" style="height: 38px; border-style: dashed;">
            ${t('btn_add_guest_timer', '➕ Gast')}
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
            listCont.innerHTML = `<div class="text-center text-muted small p-2">${t('msg_no_more_guests', 'Keine weiteren Gäste vorhanden.')}</div>`;
        } else {
            listCont.innerHTML = availableGuests.map(g => `
                <div class="d-flex justify-content-between align-items-center p-2 rounded mb-2" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);">
                    <span class="text-white small fw-bold">👤 ${g.name}</span>
                    <button class="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-0.5 fw-bold" type="button" onclick="selectGuestForProfile(${g.id}, '${g.name.replace(/'/g, "\\'")}')" style="font-size: 0.7rem;">
                        ➕ ${t('btn_add', 'Hinzufügen')}
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
            err.textContent = t('msg_enter_name', 'Bitte einen Namen eingeben.');
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
                err.textContent = data.detail || t('msg_error_creating', 'Fehler beim Erstellen.');
                err.classList.remove('d-none');
            }
        }
    } catch(e) {
        if (err) {
            err.textContent = t('msg_connection_error', 'Verbindungsfehler.');
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

window.openGameProfileById = async function(gameId) {
    if (!window.allCollectionGames || window.allCollectionGames.length === 0) {
        if (typeof loadCollection === 'function') {
            await loadCollection();
        }
    }
    const game = window.allCollectionGames ? window.allCollectionGames.find(g => g.id === gameId) : null;
    if (game) {
        showGameProfile(game.id, game.bgg_id, game.image_url, game.min_players, game.max_players, game.playing_time, game.weight, game.category);
    } else {
        showToast(t('msg_game_not_found_collection', 'Spiel nicht in der Sammlung gefunden!'));
    }
};
