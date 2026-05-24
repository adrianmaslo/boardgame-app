// share.js - Canvas-Bildgenerierung und Web Share Integration

let currentShareBlob = null;

window.openShareImageModal = function(session) {
    // Detail-Modal schließen
    const detailModalEl = document.getElementById('detailModal');
    if (detailModalEl) {
        const detailModal = bootstrap.Modal.getInstance(detailModalEl);
        if (detailModal) detailModal.hide();
    }

    // Share Modal anzeigen
    const shareModalEl = document.getElementById('shareImageModal');
    const shareModal = bootstrap.Modal.getOrCreateInstance(shareModalEl);
    shareModal.show();

    // Spinner anzeigen, Bild verstecken
    const imgEl = document.getElementById('shareModalGeneratedImg');
    const spinnerEl = document.getElementById('shareLoadingSpinner');
    imgEl.classList.add('d-none');
    imgEl.classList.remove('d-block');
    spinnerEl.classList.remove('d-none');
    spinnerEl.classList.add('d-flex');

    // Generierung leicht verzögern für UI-Thread
    setTimeout(() => {
        generateShareCanvas(session, handleShareCanvasResult);
    }, 400);
};

window.currentShareSession = null;
function handleShareCanvasResult(dataUrl, blob) {
    currentShareBlob = blob;
    const imgEl = document.getElementById('shareModalGeneratedImg');
    const spinnerEl = document.getElementById('shareLoadingSpinner');
    imgEl.src = dataUrl;
    imgEl.classList.remove('d-none');
    imgEl.classList.add('d-block');
    spinnerEl.classList.remove('d-flex');
    spinnerEl.classList.add('d-none');

    // Download-Button verknüpfen
    const downloadBtn = document.getElementById('btnDownloadShareImg');
    if (downloadBtn && window.currentShareSession) {
        downloadBtn.href = dataUrl;
        downloadBtn.download = `${window.currentShareSession.game_name.replace(/\s+/g, '_')}_runde.png`;
    }
}

window.updateShareImage = function() {
    if (!window.currentShareSession) return;
    const imgEl = document.getElementById('shareModalGeneratedImg');
    const spinnerEl = document.getElementById('shareLoadingSpinner');
    imgEl.classList.add('d-none');
    imgEl.classList.remove('d-block');
    spinnerEl.classList.remove('d-none');
    spinnerEl.classList.add('d-flex');
    
    setTimeout(() => {
        generateShareCanvas(window.currentShareSession, handleShareCanvasResult);
    }, 100);
};

function generateShareCanvas(session, callback) {
    try {
        window.currentShareSession = session;
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');

        const drawForeground = () => {
            // 2. Dekorative Grid/Punkte im Hintergrund
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            for (let x = 20; x < 600; x += 40) {
                for (let y = 80; y < 540; y += 40) {
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

        // 3. Header-Leiste
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(0, 0, 600, 80);
        
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(10, 10, 580, 60, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8'; // primary color
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎲 GAME-LOG PRO', 300, 40);

        // 4. Spielname
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // Spielname kürzen, falls zu lang
        let displayName = session.game_name || 'Unbekanntes Spiel';
        if (displayName.length > 25) {
            displayName = displayName.substring(0, 22) + '...';
        }
        ctx.fillText(displayName, 300, 110);

        // 5. Spieldatum & Dauer
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 16px system-ui, -apple-system, sans-serif';
        const lang = localStorage.getItem('app_lang') || 'de';
        const dateLocale = lang === 'en' ? 'en-US' : 'de-DE';
        const playDate = new Date(session.play_date || Date.now()).toLocaleDateString(dateLocale, { 
            weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' 
        });
        const durationMin = Math.floor((session.duration_seconds || 0) / 60);
        ctx.fillText(`${playDate}  •  ⏱️ ${durationMin} ${t('label_minutes_short', 'Min.')}`, 300, 155);

        // 6. Spielergebnisse zeichnen
        const scores = [...(session.scores || [])];
        // Sortieren: Gewinner zuerst, dann nach Punkten absteigend (bzw. aufsteigend falls win_condition == 1)
        scores.sort((a, b) => {
            if (a.is_winner && !b.is_winner) return -1;
            if (!a.is_winner && b.is_winner) return 1;
            const valA = a.score_value || 0;
            const valB = b.score_value || 0;
            if (session.win_condition === 1) {
                return valA - valB; // niedrigere Punkte besser
            }
            return valB - valA; // höhere Punkte besser
        });

        const numWinners = scores.filter(s => s.is_winner).length;
        const winnerBadge = numWinners > 1 ? t('label_team_winner', '🏆 TEAM-SIEG') : t('label_winner_cap', '🏆 SIEGER');

        const startY = 200;
        const cardHeight = 70;
        const cardSpacing = 12;

        scores.forEach((sc, idx) => {
            if (idx >= 4) return; // Maximal 4 Spieler rendern wegen Platzmangel

            const cardY = startY + idx * (cardHeight + cardSpacing);
            const cardX = 50;
            const cardWidth = 500;

            // Player Info laden für Avatar
            const playerInfo = (window.allPlayers || []).find(p => p.id === sc.player_id || p.name === sc.name) || {};
            const avatarIcon = playerInfo.avatar_icon || '👤';

            // Card Hintergrund
            if (sc.is_winner) {
                const winnerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
                winnerGrad.addColorStop(0, 'rgba(234, 179, 8, 0.15)');
                winnerGrad.addColorStop(1, 'rgba(234, 179, 8, 0.03)');
                ctx.fillStyle = winnerGrad;
                ctx.strokeStyle = '#eab308'; // Gold-Rand für Gewinner
                ctx.lineWidth = 2;
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 1;
            }

            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 14);
            ctx.fill();
            ctx.stroke();

            // 6a. Avatar & Name zeichnen
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            // Avatar-Emoji
            ctx.font = '28px system-ui, -apple-system, sans-serif';
            ctx.fillText(avatarIcon, cardX + 20, cardY + cardHeight / 2);

            // Name
            ctx.fillStyle = sc.is_winner ? '#ffffff' : '#e2e8f0';
            ctx.font = sc.is_winner ? 'bold 20px system-ui, -apple-system, sans-serif' : '500 18px system-ui, -apple-system, sans-serif';
            ctx.fillText(sc.name || 'Unbekannt', cardX + 70, cardY + cardHeight / 2);

            // 6b. Score / Winner Badge zeichnen
            ctx.textAlign = 'right';
            if (session.win_condition !== 2) {
                ctx.fillStyle = sc.is_winner ? '#eab308' : '#cbd5e1';
                ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
                const sVal = sc.score_value !== null && sc.score_value !== undefined ? sc.score_value.toString() : '0';
                
                if (sc.is_winner) {
                    const combinedText = `${winnerBadge}    ${sVal}`;
                    ctx.fillText(combinedText, cardX + cardWidth - 25, cardY + cardHeight / 2);
                } else {
                    ctx.fillText(sVal, cardX + cardWidth - 25, cardY + cardHeight / 2);
                }
            } else {
                if (sc.is_winner) {
                    ctx.fillStyle = '#eab308';
                    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
                    ctx.fillText(winnerBadge, cardX + cardWidth - 25, cardY + cardHeight / 2);
                }
            }
        });

        // 7. Footer
        ctx.fillStyle = '#64748b';
        ctx.font = '500 14px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(t('share_footer', 'Erstellt mit Game-Log Pro'), 300, 575);

        const finishCanvas = () => {
            try {
                const dataUrl = canvas.toDataURL('image/png');
                canvas.toBlob((blob) => {
                    if (callback) callback(dataUrl, blob);
                }, 'image/png');
            } catch (err) {
                console.error("Error on canvas:", err);
                if (typeof showToast === 'function') {
                    showToast("Fehler beim Erstellen des Bildes.");
                }
            }
        };
        
        finishCanvas();
    }; // end drawForeground

    drawGradientBackground();
    drawForeground();
    
    function drawGradientBackground() {
        const grad = ctx.createLinearGradient(0, 0, 0, 600);
        grad.addColorStop(0, '#0b0f19');
        grad.addColorStop(0.5, '#0f172a');
        grad.addColorStop(1, '#1e293b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 600);
    }
    
    } catch(e) {
        console.error("Fehler beim Generieren des Share-Bildes:", e);
        const spinnerEl = document.getElementById('shareLoadingSpinner');
        if (spinnerEl) {
            spinnerEl.classList.remove('d-flex');
            spinnerEl.classList.add('d-none');
        }
        showToast("Fehler beim Erstellen des Bildes.");
    }
}

window.triggerWebShare = async function() {
    if (!currentShareBlob) return;
    try {
        const file = new File([currentShareBlob], 'spielrunde.png', { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: t('msg_share_title', 'Brettspiel-Runde'),
                text: t('msg_share_text', 'Schau dir unsere letzte Brettspiel-Runde an! 🎲')
            });
        } else {
            const warningMsg = t('msg_share_not_supported', 'Direktes Teilen wird nicht unterstützt. Nutze den Download-Button.');
            if (typeof showToast === 'function') {
                showToast(warningMsg);
            } else {
                console.error(warningMsg);
            }
        }
    } catch(e) {
        console.error("Fehler beim Teilen:", e);
    }
};
