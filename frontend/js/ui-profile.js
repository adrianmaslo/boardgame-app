window.showGameProfile = async function(gameId, bggId, imageUrl, minP, maxP, time, weight, currentCat) {
    // Kombinierter Fetch: Basis-Stats und Advanced-Stats laden
    const [resBasic, resAdv] = await Promise.all([
        fetch(`/stats/game/${gameId}`),
        fetch(`/stats/game/${gameId}/advanced`)
    ]);
    const basicData = await resBasic.json();
    const advData = await resAdv.json();

    const modal = new bootstrap.Modal(document.getElementById('gameProfileModal'));
    
    // Basis-Header füllen
    document.getElementById('profileGameName').innerText = basicData.game_name;
    document.getElementById('profileWinsA').innerText = basicData.wins[player1Name] || 0;
    document.getElementById('profileWinsL').innerText = basicData.wins[player2Name] || 0;
    
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
    if (basicData.win_condition === 1) {
        toggleBtn.innerText = "🔄 Regel: Niedrigste Punkte gewinnen";
    } else {
        toggleBtn.innerText = "🔄 Regel: Höchste Punkte gewinnen";
    }
    toggleBtn.onclick = async () => {
        try {
            const res = await fetch(`/toggle_win_condition/${gameId}`, { method: 'PATCH' });
            if (!res.ok) throw new Error();
            modal.hide(); setTimeout(() => showGameProfile(gameId, bggId, imageUrl, minP, maxP, time, weight, currentCat), 350);
        } catch (e) { alert("Fehler beim Umstellen der Wertungsregel."); }
    };
    
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
        const winner = s.scores.find(sc => sc.is_winner === 1);
        const colorClass = winner ? (winner.name === player1Name ? 'adrian-color' : 'lea-color') : 'text-muted';
        return `<div class="list-group-item border-0 px-3 py-2 mb-1 rounded-3 d-flex justify-content-between align-items-center" style="background: rgba(255,255,255,0.03);">
            <span class="text-white-50">${new Date(s.play_date).toLocaleDateString('de-DE')}</span>
            <span class="fw-bold ${colorClass}">${winner ? winner.name : 'Remis'}</span>
        </div>`;
    }).join('');

    // Advanced Stats Injection
    const advBody = document.getElementById('profileAdvancedStats');
    if (advData.total_games === 0) {
        advBody.innerHTML = `<div class="text-center text-muted p-3">Noch keine Spiele geloggt!</div>`;
    } else {
        const adrian = advData.player_stats[player1Name] || { avg: 0, max: 0 };
        const lea = advData.player_stats[player2Name] || { avg: 0, max: 0 };
        const recordHolder = advData.all_time_high ? `${advData.all_time_high.name} (${advData.all_time_high.score_value} Pkt)` : "-";
        
        advBody.innerHTML = `
            <div class="d-flex justify-content-between mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-white-50">Gespielte Partien:</span>
                <span class="text-white fw-bold">${advData.total_games}</span>
            </div>
            <div class="d-flex flex-column mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                <span class="text-muted mb-1">Durchschnittliche Punkte:</span>
                <div class="d-flex justify-content-between">
                    <span class="adrian-color fw-bold">${player1Name}: ${adrian.avg}</span>
                    <span class="lea-color fw-bold">${player2Name}: ${lea.avg}</span>
                </div>
            </div>
            <div class="d-flex flex-column mb-3">
                <span class="text-muted mb-1">Persönliche Rekorde:</span>
                <div class="d-flex justify-content-between">
                    <span class="adrian-color fw-bold">${player1Name}: ${adrian.max}</span>
                    <span class="lea-color fw-bold">${player2Name}: ${lea.max}</span>
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
        if (typeof selectGame === 'function') setTimeout(() => selectGame(gameId, basicData.game_name, imageUrl), 350); 
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
        const res = await fetch(`/game/${gameId}/category?category=${encodeURIComponent(newCat)}`, { method: 'PATCH' });
        if (!res.ok) throw new Error();
        if (typeof loadCollection === 'function') loadCollection();
        bootstrap.Modal.getInstance(document.getElementById('gameProfileModal')).hide();
    } catch (e) {
        alert("Fehler beim Verschieben.");
    }
};

window.deleteGame = async function(gameId) {
    if(!confirm("Willst du dieses Spiel wirklich aus der Sammlung löschen?")) return;
    try {
        const res = await fetch(`/delete/${gameId}`, { method: 'DELETE' });
        if (!res.ok) { const data = await res.json(); alert(data.detail || "Konnte nicht gelöscht werden."); return; }
        bootstrap.Modal.getInstance(document.getElementById('gameProfileModal')).hide();
        if (typeof loadCollection === 'function') loadCollection(); 
    } catch (e) { alert("Fehler beim Löschen."); }
};
