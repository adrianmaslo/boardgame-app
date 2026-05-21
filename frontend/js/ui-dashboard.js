window.loadDashboard = async function() {
    // Fetch Daily Photo
    authFetch('/stats/daily_photo').then(r => r.json()).then(photoData => {
        if (photoData.photo) {
            document.getElementById('dailyPhotoImg').src = photoData.photo.path;
            document.getElementById('dailyPhotoGame').innerText = photoData.photo.game;
            document.getElementById('dailyPhotoDate').innerText = new Date(photoData.photo.date).toLocaleDateString('de-DE');
            document.getElementById('dailyPhotoContainer').classList.remove('d-none');
        } else {
            document.getElementById('dailyPhotoContainer').classList.add('d-none');
        }
    }).catch(()=>{});

    const res = await authFetch('/stats/dashboard'); 
    const data = await res.json();
    
    // Fallback if global allPlayers is not populated yet
    if ((!allPlayers || allPlayers.length === 0) && data.players) {
        allPlayers = data.players.map(p => ({
            id: p.id,
            name: p.name,
            avatar_color: p.avatar_color
        }));
    }
    if (allPlayers.length >= 1) player1Name = allPlayers[0].name;
    if (allPlayers.length >= 2) player2Name = allPlayers[1].name;

    // Render Ewiges Duell columns dynamically
    const duellContainer = document.getElementById('dashboardDuellContainer');
    if (duellContainer) {
        let html = '';
        allPlayers.forEach((p, idx) => {
            const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
            const pWins = data.wins[p.name] || 0;
            
            // Build achievements html
            let achsHtml = '';
            const parseBadge = (str) => {
                const parts = str.split(' ');
                const emoji = parts[0] || '🏆';
                const label = parts.slice(1).join(' ') || str;
                const escapedLabel = label.replace(/'/g, "\\'");
                return `
                <span class="d-inline-flex align-items-center justify-content-center rounded-circle border shadow-sm cursor-pointer" 
                      style="width: 28px; height: 28px; background: rgba(0,0,0,0.5); font-size: 1rem; border-color: var(--surface-border); transition: transform 0.2s;" 
                      onclick="window.showToast('${emoji} ${escapedLabel}')" 
                      title="${emoji} ${escapedLabel}"
                      onmouseover="this.style.transform='scale(1.15)'"
                      onmouseout="this.style.transform='scale(1)'">
                    ${emoji}
                </span>`;
            };

            let badgesList = [];
            if (data.achievements && data.achievements[p.name]) {
                data.achievements[p.name].forEach(a => {
                    badgesList.push(parseBadge(a));
                });
            }
            if (data.streaks && data.streaks[p.name]) {
                badgesList.push(parseBadge(data.streaks[p.name]));
            }

            if (badgesList.length > 0) {
                achsHtml = `<div class="d-flex flex-wrap justify-content-center gap-1 mt-1">${badgesList.join('')}</div>`;
            }

            html += `
            <div class="d-flex flex-column align-items-center py-2" style="flex: 1 1 0; min-width: 0; max-width: 25%;">
                <span class="score-name ${colorClass} d-block w-100 text-truncate text-center" style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;" title="${p.name}">${p.name}</span>
                <h1 class="display-3 fw-bold mb-0 text-shadow my-1" style="font-size: 2.2rem;">${pWins}</h1>
                <div class="mt-1 d-flex flex-wrap justify-content-center gap-1 w-100">
                    ${achsHtml}
                </div>
            </div>`;
            
            if (idx < allPlayers.length - 1) {
                html += `<div class="text-white-50 opacity-25 align-self-center px-1" style="font-size: 0.75rem; margin-top: -0.75rem;">⚡</div>`;
            }
        });
        duellContainer.innerHTML = html;
    }
    
    // Render Highlights
    let highlightsHtml = '';
    
    if (data.most_played) {
        highlightsHtml += `
        <div class="dashboard-card shadow-sm">
            <img src="${data.most_played.image_url || 'https://via.placeholder.com/60?text=🎲'}">
            <div>
                <small class="text-white-50 text-uppercase x-small d-block tracking-wider fw-bold">Dauerbrenner</small>
                <span class="fw-bold d-block text-white">${data.most_played.name}</span>
                <small class="text-primary fw-bold">${data.most_played.count} Partien</small>
            </div>
        </div>`;
    }
    
    // Loop over all group members and check for best games in data.best_per_player
    allPlayers.forEach((p, idx) => {
        const best = data.best_per_player && data.best_per_player[p.name];
        if (best) {
            const colorClass = idx === 0 ? 'adrian-color' : (idx === 1 ? 'lea-color' : (idx === 2 ? 'text-success' : 'text-warning'));
            const suffix = idx === 0 ? 's Festung' : (idx === 1 ? 's Imperium' : 's Domäne');
            highlightsHtml += `
            <div class="dashboard-card shadow-sm">
                <img src="${best.image_url || 'https://via.placeholder.com/60?text=🏆'}">
                <div>
                    <small class="${colorClass} text-uppercase x-small d-block tracking-wider fw-bold">${p.name}${suffix}</small>
                    <span class="fw-bold d-block text-white">${best.name}</span>
                    <small class="text-white-50">${best.wins} Siege</small>
                </div>
            </div>`;
        }
    });

    if (highlightsHtml === '') {
         document.getElementById('dashboardHighlights').innerHTML = '<div class="text-center text-white-50 small py-4">Noch keine Highlights. Spielt ein paar Partien!</div>';
    } else {
         document.getElementById('dashboardHighlights').innerHTML = highlightsHtml;
    }

    // Load Chart Data
    authFetch('/stats/chart_data').then(r => r.json()).then(chartData => {
        const ctx = document.getElementById('ewigesDuellChart');
        if (ctx && window.Chart) {
            if (window.duellChart) window.duellChart.destroy();
            Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
            Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
            
            window.duellChart = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { family: 'Inter', size: 10 } } },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: { beginAtZero: true, border: { dash: [4, 4] }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }
            });
        }
    }).catch(e => console.error("Chart fetch error:", e));
};
