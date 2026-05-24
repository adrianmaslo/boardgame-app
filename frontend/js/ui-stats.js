window.loadGlobalStats = async function() {
    const container = document.getElementById('statsContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">${t('label_loading', 'Laden...')}</span>
            </div>
        </div>
    `;
    
    try {
        const res = await authFetch('/stats/global');
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        // 1. Guests
        let guestsHtml = `<div class="list-group list-group-flush bg-transparent">`;
        if (!data.guests || data.guests.length === 0) {
            guestsHtml += `<div class="text-center text-muted small py-3">${t('msg_no_guest_stats', 'Noch keine Gastspiele verzeichnet.')}</div>`;
        } else {
            data.guests.forEach((g, idx) => {
                const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '👤'));
                guestsHtml += `
                    <div class="list-group-item bg-transparent text-white border-secondary border-opacity-10 d-flex justify-content-between align-items-center px-0 py-2.5">
                        <span class="fw-semibold">${medal} ${g.name}</span>
                        <span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 rounded-pill px-3 py-1 fw-bold">${g.play_count} ${t('label_plays', 'Partien')}</span>
                    </div>
                `;
            });
        }
        guestsHtml += `</div>`;

        // 2. Popular Games
        let popularHtml = ``;
        if ((!data.recent_popular || data.recent_popular.length === 0) && (!data.all_time_popular || data.all_time_popular.length === 0)) {
            popularHtml += `<div class="text-center text-muted small py-3">${t('msg_no_games_stats', 'Noch keine Spiele aufgezeichnet.')}</div>`;
        } else {
            if (data.recent_popular && data.recent_popular.length > 0) {
                popularHtml += `<h6 class="text-white-50 x-small text-uppercase tracking-wider fw-bold mb-3 mt-1">🔥 ${t('label_last_30_days', 'Letzte 30 Tage')}</h6>`;
                data.recent_popular.forEach(g => {
                    const img = g.image_url || 'https://via.placeholder.com/40?text=🎲';
                    popularHtml += `
                        <div class="d-flex align-items-center gap-3 mb-3">
                            <img src="${img}" class="rounded shadow-sm" style="width: 40px; height: 40px; object-fit: cover;">
                            <div class="flex-grow-1 min-w-0">
                                <span class="d-block text-white fw-bold text-truncate small">${g.name}</span>
                                <span class="text-info x-small fw-semibold">${g.play_count}x ${t('label_played_times', 'gespielt')}</span>
                            </div>
                        </div>
                    `;
                });
            }
            if (data.all_time_popular && data.all_time_popular.length > 0) {
                popularHtml += `<h6 class="text-white-50 x-small text-uppercase tracking-wider fw-bold mb-3 mt-4">🏆 ${t('label_all_time_favorites', 'All-Time Favoriten')}</h6>`;
                data.all_time_popular.forEach(g => {
                    const img = g.image_url || 'https://via.placeholder.com/40?text=🎲';
                    popularHtml += `
                        <div class="d-flex align-items-center gap-3 mb-3">
                            <img src="${img}" class="rounded shadow-sm" style="width: 40px; height: 40px; object-fit: cover;">
                            <div class="flex-grow-1 min-w-0">
                                <span class="d-block text-white fw-bold text-truncate small">${g.name}</span>
                                <span class="text-warning x-small fw-semibold">${g.play_count}x ${t('label_played_times', 'gespielt')}</span>
                            </div>
                        </div>
                    `;
                });
            }
        }

        // 3. Never Played Games
        let unplayedHtml = `<div class="d-flex flex-column gap-2" style="max-height: 250px; overflow-y: auto; padding-right: 4px;">`;
        if (!data.never_played || data.never_played.length === 0) {
            unplayedHtml += `<div class="text-center text-muted small py-3">${t('msg_all_played', 'Alle Spiele in der Sammlung wurden mindestens einmal gespielt! 🎉')}</div>`;
        } else {
            data.never_played.forEach(g => {
                const img = g.image_url || 'https://via.placeholder.com/32?text=🎲';
                unplayedHtml += `
                    <div class="d-flex align-items-center gap-2 p-1.5 rounded" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.03);">
                        <img src="${img}" class="rounded" style="width: 32px; height: 32px; object-fit: cover;">
                        <span class="text-white text-truncate small fw-medium">${g.name}</span>
                    </div>
                `;
            });
        }
        unplayedHtml += `</div>`;

        // 4. Stärken & Schwächen
        let strengthsHtml = `<div class="d-flex flex-column gap-2 mb-4">`;
        if (!data.best_performances || data.best_performances.length === 0) {
            strengthsHtml += `<div class="text-center text-muted small py-2">${t('msg_not_enough_data', 'Noch nicht genügend Daten.')}</div>`;
        } else {
            data.best_performances.forEach(p => {
                const rate = Math.round(p.win_rate * 100);
                strengthsHtml += `
                    <div class="d-flex align-items-center justify-content-between p-2 rounded" style="background: rgba(46, 213, 115, 0.05); border: 1px solid rgba(46, 213, 115, 0.1);">
                        <div class="min-w-0 flex-grow-1">
                            <span class="fw-bold text-white small d-block text-truncate">${p.player_name}</span>
                            <span class="text-white-50 x-small text-truncate d-block">${p.game_name} (${p.games_played} ${t('label_plays', 'Partien')})</span>
                        </div>
                        <span class="badge bg-success bg-opacity-25 text-success rounded px-2.5 py-1.5 fw-bold ms-2" style="font-size: 0.8rem;">${rate}% ${t('label_wins', 'Siege')}</span>
                    </div>
                `;
            });
        }
        strengthsHtml += `</div>`;

        let weaknessesHtml = `<div class="d-flex flex-column gap-2">`;
        if (!data.worst_performances || data.worst_performances.length === 0) {
            weaknessesHtml += `<div class="text-center text-muted small py-2">${t('msg_not_enough_data', 'Noch nicht genügend Daten.')}</div>`;
        } else {
            data.worst_performances.forEach(p => {
                const rate = Math.round(p.win_rate * 100);
                weaknessesHtml += `
                    <div class="d-flex align-items-center justify-content-between p-2 rounded" style="background: rgba(255, 71, 87, 0.05); border: 1px solid rgba(255, 71, 87, 0.1);">
                        <div class="min-w-0 flex-grow-1">
                            <span class="fw-bold text-white small d-block text-truncate">${p.player_name}</span>
                            <span class="text-white-50 x-small text-truncate d-block">${p.game_name} (${p.games_played} ${t('label_plays', 'Partien')})</span>
                        </div>
                        <span class="badge bg-danger bg-opacity-25 text-danger rounded px-2.5 py-1.5 fw-bold ms-2" style="font-size: 0.8rem;">${rate}% ${t('label_wins', 'Siege')}</span>
                    </div>
                `;
            });
        }
        weaknessesHtml += `</div>`;

        container.innerHTML = `
            <div class="row g-4">
                <!-- Stärken & Schwächen -->
                <div class="col-12 col-md-6 animate-fade-in" style="animation-delay: 0.1s;">
                    <div class="card border-0 h-100 p-4 shadow-sm" style="background: var(--surface-card); border-radius: 1.2rem; border: 1px solid var(--surface-border) !important;">
                        <h5 class="fw-bold text-white mb-3 d-flex align-items-center gap-2">
                            <span>🏆 ${t('label_strengths_weaknesses', 'Stärken & Schwächen')}</span>
                        </h5>
                        <h6 class="text-success x-small text-uppercase tracking-wider fw-bold mb-3">${t('label_best_in', '🔥 Am besten in...')}</h6>
                        ${strengthsHtml}
                        <h6 class="text-danger x-small text-uppercase tracking-wider fw-bold mb-3 mt-2">${t('label_could_improve', '❄️ Ausbaufähig in...')}</h6>
                        ${weaknessesHtml}
                    </div>
                </div>

                <!-- Beliebte Spiele -->
                <div class="col-12 col-md-6 animate-fade-in" style="animation-delay: 0.2s;">
                    <div class="card border-0 h-100 p-4 shadow-sm" style="background: var(--surface-card); border-radius: 1.2rem; border: 1px solid var(--surface-border) !important;">
                        <h5 class="fw-bold text-white mb-3 d-flex align-items-center gap-2">
                            <span>📊 ${t('label_popular_games', 'Beliebte Spiele')}</span>
                        </h5>
                        ${popularHtml}
                    </div>
                </div>

                <!-- Gast-Aktivität -->
                <div class="col-12 col-md-6 animate-fade-in" style="animation-delay: 0.3s;">
                    <div class="card border-0 h-100 p-4 shadow-sm" style="background: var(--surface-card); border-radius: 1.2rem; border: 1px solid var(--surface-border) !important;">
                        <h5 class="fw-bold text-white mb-3 d-flex align-items-center gap-2">
                            <span>👥 ${t('label_guest_activity', 'Gast-Aktivität')}</span>
                        </h5>
                        <p class="text-white-50 small mb-3">${t('label_guest_activity_hint', 'Welche Gäste haben am häufigsten mitgespielt?')}</p>
                        ${guestsHtml}
                    </div>
                </div>

                <!-- Ungespielte Schätze -->
                <div class="col-12 col-md-6 animate-fade-in" style="animation-delay: 0.4s;">
                    <div class="card border-0 h-100 p-4 shadow-sm" style="background: var(--surface-card); border-radius: 1.2rem; border: 1px solid var(--surface-border) !important;">
                        <h5 class="fw-bold text-white mb-3 d-flex align-items-center gap-2">
                            <span>📦 ${t('label_unplayed_treasures', 'Ungespielte Schätze')}</span>
                        </h5>
                        <p class="text-white-50 small mb-3">${t('label_unplayed_treasures_hint', 'Spiele aus deiner Sammlung mit 0 aufgezeichneten Partien:')}</p>
                        ${unplayedHtml}
                    </div>
                </div>
            </div>
        `;
        renderAchievements();
    } catch (e) {
        container.innerHTML = `
            <div class="alert alert-danger rounded-3 fw-bold small text-center" role="alert">
                ${t('msg_error_global_stats', 'Fehler beim Laden der globalen Statistiken.')}
            </div>
        `;
    }
};

window.renderAchievements = async function() {
    const container = document.getElementById('achievementsContainer');
    if (!container) return;

    if (!window.allSessions) {
        try {
            const res = await authFetch('/history');
            if (res && res.ok) {
                const data = await res.json();
                window.allSessions = data.history || [];
            }
        } catch(e) {
            console.error("Failed to load history for achievements", e);
        }
    }

    if (!window.allSessions) {
        container.innerHTML = `<div class="text-center text-muted small py-3">Keine Daten verfügbar.</div>`;
        return;
    }

    const userId = Auth.getUser()?.id;
    let totalPlays = 0;
    let totalWins = 0;
    let teamWins = 0;
    let longGames = 0;
    let nightOwlGames = 0;
    
    // Analyze history
    window.allSessions.forEach(session => {
        const myScore = session.scores.find(sc => sc.player_id === userId);
        if (myScore) {
            totalPlays++;
            if (myScore.is_winner) totalWins++;
            
            // Team Win Check (wenn es andere Gewinner gibt, war es ein Team)
            if (myScore.is_winner && session.scores.filter(sc => sc.is_winner).length > 1) {
                teamWins++;
            }
        }
        
        // Long Game Check
        if (session.duration_seconds > 7200) { // 2 Hours
            longGames++;
        }
        
        // Night Owl Check
        const playHour = new Date(session.play_date).getHours();
        if (playHour >= 22 || playHour < 4) {
            nightOwlGames++;
        }
    });

    const achievements = [
        { id: 'first_blood', name: 'Erstes Blut', desc: 'Gewinne dein erstes Spiel', current: totalWins, max: 1, icon: '🩸', color: '#ef4444' },
        { id: 'veteran', name: 'Veteran', desc: 'Spiele 100 Spiele', current: totalPlays, max: 100, icon: '🎖️', color: '#eab308' },
        { id: 'champion', name: 'Champion', desc: 'Gewinne 50 Spiele', current: totalWins, max: 50, icon: '🏆', color: '#f59e0b' },
        { id: 'team_player', name: 'Team Player', desc: 'Gewinne im Team', current: teamWins, max: 1, icon: '🤝', color: '#3b82f6' },
        { id: 'marathon', name: 'Marathon', desc: 'Spiele eine Partie > 2 Stunden', current: longGames, max: 1, icon: '🏃', color: '#10b981' },
        { id: 'night_owl', name: 'Nachteule', desc: 'Spiele nach 22:00 Uhr', current: nightOwlGames, max: 1, icon: '🦉', color: '#8b5cf6' }
    ];

    let html = `<div class="row g-3">`;
    
    achievements.forEach(ach => {
        const progress = Math.min(100, Math.round((ach.current / ach.max) * 100));
        const unlocked = progress === 100;
        const opacity = unlocked ? '1' : '0.4';
        const filter = unlocked ? 'none' : 'grayscale(100%)';
        
        html += `
            <div class="col-6 col-md-4">
                <div class="card h-100 border-0 shadow-sm p-3 text-center position-relative overflow-hidden" style="background: var(--surface-card); border-radius: 1.2rem; border: 1px solid var(--surface-border) !important;">
                    <div class="mb-2" style="font-size: 2.5rem; opacity: ${opacity}; filter: ${filter};">${ach.icon}</div>
                    <h6 class="fw-bold text-white mb-1" style="font-size: 0.9rem;">${ach.name}</h6>
                    <p class="text-white-50 x-small mb-3" style="min-height: 32px;">${ach.desc}</p>
                    <div class="progress" style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px;">
                        <div class="progress-bar" role="progressbar" style="width: ${progress}%; background: ${unlocked ? ach.color : 'rgba(255,255,255,0.2)'};"></div>
                    </div>
                    <div class="x-small text-white-50 mt-2 fw-bold">${ach.current} / ${ach.max}</div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
};
