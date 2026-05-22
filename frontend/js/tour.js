// tour.js - Interaktive Tour für Erstnutzer

let currentTourStep = 0;

const tourSteps = [
    {
        element: 'mainApp',
        title: () => t('tour_step1_title', 'Willkommen bei Game-Log Pro! 🎲'),
        content: () => t('tour_step1_content', 'Hier kannst du deine Brettspiel-Runden protokollieren, Statistiken einsehen und deine Sammlung pflegen.'),
        placement: 'bottom'
    },
    {
        element: 'dashboardDuellContainer',
        title: () => t('tour_step2_title', '⚔️ Ewiges Duell'),
        content: () => t('tour_step2_content', 'Dieses Scoreboard zeigt auf einen Blick, wer in deiner Gruppe die Nase vorn hat.'),
        placement: 'bottom'
    },
    {
        element: 'nav-collection',
        title: () => t('tour_step3_title', '📚 Deine Sammlung'),
        content: () => t('tour_step3_content', 'Hier fügst du neue Spiele aus der BoardGameGeek Datenbank hinzu und startest deine Timer-Sessions.'),
        placement: 'top'
    },
    {
        element: 'headerUsername',
        title: () => t('tour_step4_title', '👤 Dein Profil'),
        content: () => t('tour_step4_content', 'In den Kontoeinstellungen kannst du dein Profil mit Emojis anpassen, dein Lieblingsspiel festlegen oder das Design wechseln.'),
        placement: 'bottom'
    }
];

window.cleanupTour = function() {
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    const overlay = document.getElementById('tour-overlay');
    if (overlay) overlay.remove();
    const backdrop = document.getElementById('tour-backdrop');
    if (backdrop) backdrop.remove();
};

window.startOnboardingTour = function(force = false) {
    const hasSeenTour = localStorage.getItem('has_seen_tour');
    if (hasSeenTour && !force) return;
    
    currentTourStep = 0;
    showTourStep();
};

window.showTourStep = function() {
    // Alten Zustand aufräumen
    window.cleanupTour();
    
    if (currentTourStep >= tourSteps.length) {
        localStorage.setItem('has_seen_tour', 'true');
        if (typeof showToast === 'function') {
            showToast(t('tour_finished_toast', "Tour beendet! Viel Spaß beim Tracken!"));
        }
        return;
    }
    
    const step = tourSteps[currentTourStep];
    const targetEl = document.getElementById(step.element);
    if (!targetEl) {
        // Schritt überspringen, falls Element nicht geladen oder unsichtbar
        currentTourStep++;
        showTourStep();
        return;
    }
    
    // Backdrop hinzufügen
    let backdrop = document.getElementById('tour-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'tour-backdrop';
        document.body.appendChild(backdrop);
    }
    
    // Highlight hinzufügen
    targetEl.classList.add('tour-highlight');
    
    // Element in den Fokus scrollen
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    const overlay = document.createElement('div');
    overlay.id = 'tour-overlay';
    overlay.style.position = 'absolute';
    overlay.style.zIndex = '2005'; // Über dem Highlight (2001) und Backdrop (1999)
    overlay.style.background = 'rgba(15, 23, 42, 0.98)';
    overlay.style.border = '2px solid var(--primary)';
    overlay.style.borderRadius = '16px';
    overlay.style.padding = '16px';
    overlay.style.width = '280px';
    overlay.style.color = '#fff';
    overlay.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
    overlay.style.backdropFilter = 'blur(12px)';
    overlay.style.transition = 'top 0.3s, left 0.3s';
    
    const titleText = typeof step.title === 'function' ? step.title() : step.title;
    const contentText = typeof step.content === 'function' ? step.content() : step.content;

    overlay.innerHTML = `
        <div class="fw-bold mb-2" style="font-size: 1.1rem; color: #06b6d4 !important;">${titleText}</div>
        <div style="font-size: 0.8rem; line-height: 1.4; margin-bottom: 1rem; color: rgba(255,255,255,0.7) !important;">${contentText}</div>
        <div class="d-flex justify-content-between align-items-center">
            <button class="btn btn-sm btn-outline-light py-1 px-2 x-small" onclick="skipTour()" style="font-size: 0.7rem; border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7) !important;">${t('btn_end_tour', 'Beenden')}</button>
            <div>
                <span class="x-small me-2" style="font-size: 0.7rem; color: rgba(255,255,255,0.5) !important;">${currentTourStep + 1}/${tourSteps.length}</span>
                <button class="btn btn-sm py-1 px-3 fw-bold x-small" style="background: #06b6d4 !important; color: #fff !important; border: none; border-radius: 6px;" onclick="nextTourStep()">${t('btn_next', 'Weiter')}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Position berechnen nach kurzer Verzögerung (damit Smooth-Scrolling beendet ist)
    setTimeout(() => {
        const rect = targetEl.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        let top = window.scrollY + rect.bottom + 10;
        let left = rect.left + (rect.width - overlayRect.width) / 2;
        
        if (left < 10) left = 10;
        if (left + overlayRect.width > window.innerWidth - 10) {
            left = window.innerWidth - overlayRect.width - 10;
        }
        
        if (step.placement === 'top') {
            top = window.scrollY + rect.top - overlayRect.height - 10;
        } else if (step.element === 'mainApp') {
            // Spezialfall für mainApp: Tooltip vertikal zentrieren
            top = window.scrollY + (window.innerHeight - overlayRect.height) / 2;
        }
        
        // Verhindern, dass der Tooltip den oberen Bildschirmrand übersteigt
        if (top < window.scrollY + 10) {
            top = window.scrollY + 10;
        }
        
        // Verhindern, dass der Tooltip unten aus dem Bildschirm ragt
        if (top + overlayRect.height > window.scrollY + window.innerHeight - 10) {
            top = window.scrollY + window.innerHeight - overlayRect.height - 10;
        }
        
        overlay.style.top = `${top}px`;
        overlay.style.left = `${left}px`;
        overlay.style.transform = 'none';
    }, 350);
};

window.nextTourStep = function() {
    currentTourStep++;
    showTourStep();
};

window.skipTour = function() {
    window.cleanupTour();
    localStorage.setItem('has_seen_tour', 'true');
    if (typeof showToast === 'function') {
        showToast(t('tour_skipped_toast', "Tour beendet."));
    }
};

window.restartOnboardingTour = function() {
    window.startOnboardingTour(true);
};
