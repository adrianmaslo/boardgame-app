window.searchBGG = async function() {
    const q = document.getElementById('searchInput').value; if (!q) return;
    document.getElementById('searchResults').innerHTML = '<div class="text-center text-primary small p-3 spinner-border spinner-border-sm" role="status"></div><span class="small text-muted ms-2">Suche...</span>';
    const res = await authFetch(`/search?name=${q}`); 
    if (!res) return;
    const data = await res.json();
    if(data.results.length === 0) { document.getElementById('searchResults').innerHTML = '<div class="text-center text-muted small p-3">Nichts gefunden.</div>'; return; }
    document.getElementById('searchResults').innerHTML = data.results.map(g => `
        <div class="list-group-item d-flex justify-content-between align-items-center animate-fade-in rounded-3 mb-2" onclick="previewGame(${g.id}, '${g.name.replace(/'/g, "\\'")}')" style="cursor:pointer; background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);">
            <span class="small fw-bold text-white">${g.name}</span><span class="badge bg-primary rounded-pill px-3 py-2 shadow-sm">VORSCHAU</span>
        </div>`).join('');
};

window.previewGame = async function(bggId, tempName) {
    document.getElementById('previewGameName').innerText = tempName;
    document.getElementById('previewCoverImage').innerHTML = '<div class="p-5 text-center text-muted spinner-border text-primary"></div>';
    document.getElementById('previewBadges').innerHTML = '';
    const modal = new bootstrap.Modal(document.getElementById('bggPreviewModal')); modal.show();
    try {
        const res = await authFetch(`/preview?bgg_id=${bggId}`); 
        if (!res) return;
        const data = await res.json();
        document.getElementById('previewGameName').innerText = data.name || tempName;
        if (data.image_url) { document.getElementById('previewCoverImage').innerHTML = `<img src="${data.image_url}" class="w-100" style="height: 220px; object-fit: cover; opacity: 0.9; mask-image: linear-gradient(to bottom, black 50%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);">`; } 
        else { document.getElementById('previewCoverImage').innerHTML = '<div class="p-4 text-center text-muted bg-dark">Kein Cover</div>'; }
        let badgesHtml = '';
        if (data.min_players && data.max_players) badgesHtml += `<span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-50 rounded-pill px-2 py-1">👥 ${data.min_players}-${data.max_players}</span>`;
        if (data.playing_time) badgesHtml += `<span class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-50 rounded-pill px-2 py-1">⏱ ${data.playing_time} Min</span>`;
        if (data.weight) badgesHtml += `<span class="badge bg-secondary bg-opacity-50 text-light border border-secondary rounded-pill px-2 py-1">🧠 Weight: ${data.weight}</span>`;
        document.getElementById('previewBadges').innerHTML = badgesHtml;
        document.getElementById('confirmAddBtn').onclick = () => { modal.hide(); addGame(data.name || tempName, bggId, false); };
        document.getElementById('confirmWishlistBtn').onclick = () => { modal.hide(); addGame(data.name || tempName, bggId, true); };
    } catch (e) { document.getElementById('previewCoverImage').innerHTML = '<div class="p-4 text-center text-danger bg-dark">Fehler</div>'; }
};

window.addGame = async function(name, id, isWishlist = false) {
    await authFetch(`/add?name=${encodeURIComponent(name)}&bgg_id=${id}&is_wishlist=${isWishlist ? 1 : 0}`);
    bootstrap.Collapse.getInstance(document.getElementById('searchCol'))?.hide();
    if (typeof loadCollection === 'function') loadCollection(); 
    if (isWishlist) {
        if (typeof switchCollectionTab === 'function') switchCollectionTab('wishlist');
        document.getElementById('btn-col-wish').checked = true;
    } else {
        if (typeof switchCollectionTab === 'function') switchCollectionTab('games');
        document.getElementById('btn-col-games').checked = true;
        if (typeof loadDashboard === 'function') loadDashboard();
    }
};
