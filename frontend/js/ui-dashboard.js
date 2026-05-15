window.loadDashboard = async function() {
    // Fetch Daily Photo
    fetch('/stats/daily_photo').then(r => r.json()).then(photoData => {
        if (photoData.photo) {
            document.getElementById('dailyPhotoImg').src = photoData.photo.path;
            document.getElementById('dailyPhotoGame').innerText = photoData.photo.game;
            document.getElementById('dailyPhotoDate').innerText = new Date(photoData.photo.date).toLocaleDateString('de-DE');
            document.getElementById('dailyPhotoContainer').classList.remove('d-none');
        } else {
            document.getElementById('dailyPhotoContainer').classList.add('d-none');
        }
    }).catch(()=>{});

    const res = await fetch('/stats/dashboard'); const data = await res.json();
    player1Name = data.player1_name || "Adrian";
    player2Name = data.player2_name || "Lea";

    // Update names in UI
    document.querySelectorAll('.player1-name').forEach(el => el.innerText = player1Name);
    document.querySelectorAll('.player2-name').forEach(el => el.innerText = player2Name);
    
    // Update select options if they exist
    const editWinnerP1 = document.getElementById('editWinnerP1');
    if (editWinnerP1) editWinnerP1.innerText = `🏆 ${player1Name} hat gewonnen`;
    const editWinnerP2 = document.getElementById('editWinnerP2');
    if (editWinnerP2) editWinnerP2.innerText = `🏆 ${player2Name} hat gewonnen`;
    
    const selectP1 = document.getElementById('selectP1');
    if (selectP1) selectP1.innerText = `🏆 ${player1Name}`;
    const selectP2 = document.getElementById('selectP2');
    if (selectP2) selectP2.innerText = `🏆 ${player2Name}`;

    document.getElementById('dashWinsA').innerText = data.wins[player1Name] || 0; 
    document.getElementById('dashWinsL').innerText = data.wins[player2Name] || 0;
    
    // Render Achievements for P1
    const achContA = document.getElementById('dashboardAchievementsAdrian');
    if (achContA) {
        let htmlA = '';
        if (data.achievements && data.achievements[player1Name]) {
            htmlA += data.achievements[player1Name].map(a => `<span class="badge rounded-pill bg-dark text-warning border border-warning border-opacity-50 px-2 py-1 shadow-sm mt-1 mx-1">${a}</span>`).join('');
        }
        if (data.streaks && data.streaks[player1Name]) {
            htmlA += `<span class="badge rounded-pill bg-dark text-danger border border-danger border-opacity-50 px-2 py-1 shadow-sm mt-1 mx-1">${data.streaks[player1Name]}</span>`;
        }
        achContA.innerHTML = htmlA;
    }

    // Render Achievements for P2
    const achContL = document.getElementById('dashboardAchievementsLea');
    if (achContL) {
        let htmlL = '';
        if (data.achievements && data.achievements[player2Name]) {
            htmlL += data.achievements[player2Name].map(a => `<span class="badge rounded-pill bg-dark text-warning border border-warning border-opacity-50 px-2 py-1 shadow-sm mt-1 mx-1">${a}</span>`).join('');
        }
        if (data.streaks && data.streaks[player2Name]) {
            htmlL += `<span class="badge rounded-pill bg-dark text-danger border border-danger border-opacity-50 px-2 py-1 shadow-sm mt-1 mx-1">${data.streaks[player2Name]}</span>`;
        }
        achContL.innerHTML = htmlL;
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
    
    if (data.best_player1) {
        highlightsHtml += `
        <div class="dashboard-card shadow-sm">
            <img src="${data.best_player1.image_url || 'https://via.placeholder.com/60?text=🏆'}">
            <div>
                <small class="adrian-color text-uppercase x-small d-block tracking-wider fw-bold">${player1Name}s Festung</small>
                <span class="fw-bold d-block text-white">${data.best_player1.name}</span>
                <small class="text-white-50">${data.best_player1.wins} Siege</small>
            </div>
        </div>`;
    }
    
    if (data.best_player2) {
        highlightsHtml += `
        <div class="dashboard-card shadow-sm">
            <img src="${data.best_player2.image_url || 'https://via.placeholder.com/60?text=👑'}">
            <div>
                <small class="lea-color text-uppercase x-small d-block tracking-wider fw-bold">${player2Name}s Imperium</small>
                <span class="fw-bold d-block text-white">${data.best_player2.name}</span>
                <small class="text-white-50">${data.best_player2.wins} Siege</small>
            </div>
        </div>`;
    }

    if (highlightsHtml === '' && data.most_played) {
         // If there's only 1 game, just show it.
         document.getElementById('dashboardHighlights').innerHTML = highlightsHtml;
    } else if (highlightsHtml === '') {
         document.getElementById('dashboardHighlights').innerHTML = '<div class="text-center text-white-50 small py-4">Noch keine Highlights. Spielt ein paar Partien!</div>';
    } else {
         document.getElementById('dashboardHighlights').innerHTML = highlightsHtml;
    }

    // Load Chart Data
    fetch('/stats/chart_data').then(r => r.json()).then(chartData => {
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
