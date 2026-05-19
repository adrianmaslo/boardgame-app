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
        const names = group.members.map(m => m.display_name);
        player1Name = names[0] || 'Spieler 1';
        player2Name = names[1] || 'Spieler 2';
        allPlayers = group.members; // Alle Spieler für dynamische UI
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

    // Spieler für Session-Recording laden
    if (typeof loadPlayersForSession === 'function') loadPlayersForSession();

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
