window.allCollectionGames = [];

window.loadCollection = async function() {
    const res = await authFetch('/collection'); const data = await res.json();
    window.allCollectionGames = data.collection;
    
    // Render Collection
    if (data.collection.length === 0) {
        document.getElementById('collectionList').innerHTML = '<div class="text-center text-muted p-4">Keine Spiele in der Sammlung.</div>';
    } else {
        const grouped = {};
        data.collection.forEach(g => {
            const cat = g.category && g.category !== 'Standard' ? g.category : 'Alle Spiele';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(g);
        });
        
        const sortedCats = Object.keys(grouped).sort((a,b) => a==='Alle Spiele' ? -1 : (b==='Alle Spiele' ? 1 : a.localeCompare(b)));
        let html = '';
        let index = 0;
        sortedCats.forEach(cat => {
            index++;
            const catId = 'cat' + index;
            html += `
            <div class="accordion-item border-0 mb-3 rounded-4 shadow-sm" style="background: rgba(255,255,255,0.03); overflow:hidden;">
                <h2 class="accordion-header">
                    <button class="accordion-button ${index===1 ? '' : 'collapsed'} bg-transparent fw-bold text-white tracking-wider text-uppercase small px-4 py-3" type="button" data-bs-toggle="collapse" data-bs-target="#${catId}">
                        📁 ${cat} <span class="badge bg-secondary ms-2">${grouped[cat].length}</span>
                    </button>
                </h2>
                <div id="${catId}" class="accordion-collapse collapse ${index===1 ? 'show' : ''}">
                    <div class="accordion-body p-2 pt-0">
                        <div class="list-group list-group-flush">
                            ${grouped[cat].map(g => {
                                const imgSrc = g.image_url ? g.image_url : 'https://via.placeholder.com/50?text=🎲';
                                return `<div class="list-group-item d-flex align-items-center mb-1 rounded-3" onclick="showGameProfile(${g.id}, ${g.bgg_id || 'null'}, '${g.image_url || ''}', ${g.min_players || 'null'}, ${g.max_players || 'null'}, ${g.playing_time || 'null'}, ${g.weight || 'null'}, '${g.category || 'Alle Spiele'}')" style="cursor:pointer; background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);">
                                    <img src="${imgSrc}" class="rounded-3 me-3" style="width: 48px; height: 48px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">
                                    <div class="flex-grow-1"><span class="fw-bold d-block text-white">${g.name}</span>${g.playing_time ? '<span class="text-muted x-small">⏱ ' + g.playing_time + ' Min.</span>' : ''}</div>
                                    <span class="text-primary small fw-bold pe-2">PROFIL</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>`;
        });
        document.getElementById('collectionList').innerHTML = html;
    }
    
    // Render Wishlist
    if (!data.wishlist || data.wishlist.length === 0) {
        document.getElementById('wishlistList').innerHTML = '<div class="text-center text-muted p-4">Deine Wunschliste ist leer.</div>';
    } else {
        document.getElementById('wishlistList').innerHTML = data.wishlist.map(g => {
            const imgSrc = g.image_url ? g.image_url : 'https://via.placeholder.com/50?text=🎲';
            return `<div class="list-group-item d-flex align-items-center justify-content-between mb-2 rounded-3 p-3" style="background: rgba(255,255,255,0.05); border: 1px solid var(--surface-border);">
                <div class="d-flex align-items-center">
                    <img src="${imgSrc}" class="rounded-3 me-3" style="width: 48px; height: 48px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">
                    <div class="fw-bold text-white">${g.name}</div>
                </div>
                <button class="btn btn-sm btn-outline-success rounded-pill fw-bold" onclick="moveToCollection(${g.id})">Kaufen ➡️</button>
            </div>`;
        }).join('');
    }
};

window.moveToCollection = async function(gameId) {
    try {
        const res = await authFetch(`/game/${gameId}/wishlist`, { method: 'PATCH' });
        if (!res.ok) throw new Error();
        loadCollection();
        switchCollectionTab('games');
        document.getElementById('btn-col-games').checked = true;
    } catch(e) { alert("Fehler beim Verschieben."); }
};

window.switchCollectionTab = function(tabName) {
    if (tabName === 'wishlist') {
        document.getElementById('collectionMainContainer').classList.add('d-none');
        document.getElementById('wishlistMainContainer').classList.remove('d-none');
    } else {
        document.getElementById('wishlistMainContainer').classList.add('d-none');
        document.getElementById('collectionMainContainer').classList.remove('d-none');
    }
};

window.filterCollection = function() {
    const q = document.getElementById('collectionFilter').value.toLowerCase();
    let hasVisible = false;
    
    document.querySelectorAll('#collectionList .list-group-item').forEach(el => {
        const title = el.querySelector('.fw-bold').innerText.toLowerCase();
        if (title.includes(q)) {
            el.classList.remove('d-none');
            el.classList.add('d-flex');
            hasVisible = true;
        } else {
            el.classList.remove('d-flex');
            el.classList.add('d-none');
        }
    });

    document.querySelectorAll('#collectionList .accordion-item').forEach(acc => {
        const visibleItems = acc.querySelectorAll('.list-group-item.d-flex');
        if (visibleItems.length > 0) {
            acc.style.display = 'block';
        } else {
            acc.style.display = 'none';
        }
    });

    const notFound = document.getElementById('collectionNotFound');
    if (!hasVisible && q.length > 0) {
        notFound.classList.remove('d-none');
    } else {
        notFound.classList.add('d-none');
    }
};

window.searchMissingGame = function() {
    const q = document.getElementById('collectionFilter').value;
    document.getElementById('collectionFilter').value = '';
    filterCollection();
    
    const searchCol = document.getElementById('searchCol');
    if (!searchCol.classList.contains('show')) {
        new bootstrap.Collapse(searchCol, {toggle: true});
    }
    document.getElementById('searchInput').value = q;
    if (typeof searchBGG === 'function') searchBGG();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
