/**
 * main.js — App-Einstieg für Game-Log Pro v1.1
 */
window.onload = async () => {
    // Service Worker registrieren
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Auth prüfen
    if (Auth.isLoggedIn()) {
        await loadUserAndStart();
    }
    // Falls nicht eingeloggt: Auth-View ist standardmäßig sichtbar (HTML)
};

/**
 * Wird aufgerufen nachdem User eingeloggt ist und eine Gruppe hat.
 * Initialisiert alle Tabs mit den Gruppen-Daten.
 */
window.initApp = function(group) {
    // Spielernamen aus der Gruppe setzen
    if (group && group.members) {
        allPlayers = group.members.map(m => ({
            id: m.id || m.user_id,
            name: m.display_name,
            avatar_color: m.avatar_color
        }));
        player1Name = allPlayers[0]?.name || 'Spieler 1';
        player2Name = allPlayers[1]?.name || 'Spieler 2';
    }

    // Header-Infos aktualisieren
    const user = Auth.getUser();
    if (user) {
        const headerUsername = document.getElementById('headerUsername');
        if (headerUsername) headerUsername.textContent = user.username;
    }

    // Gruppen-Switcher rendern
    const me = Auth.getUser();
    // Gruppen vom /auth/me holen (asynchron, non-blocking)
    authFetch('/auth/me').then(res => res && res.json()).then(data => {
        if (data && data.groups) {
            renderGroupSwitcher(data.groups, group.id);
            const groupLabel = document.getElementById('activeGroupLabel');
            if (groupLabel) groupLabel.textContent = group.name;
        }
    });

    // Dashboard laden
    if (typeof loadDashboard === 'function') loadDashboard();

    // Sammlung laden
    if (typeof loadCollection === 'function') loadCollection();

    // Historie laden
    if (typeof loadHistory === 'function') loadHistory();

    // Timer-State wiederherstellen
    if (typeof restoreTimerState === 'function') restoreTimerState();
};

// Gruppe wechsel → App neu initialisieren
window.addEventListener('groupChanged', (e) => {
    if (e.detail && document.getElementById('mainApp') && !document.getElementById('mainApp').classList.contains('d-none')) {
        initApp(e.detail);
    }
});
