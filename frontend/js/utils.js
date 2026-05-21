window.switchTab = function(tabName) {
    document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`nav-${tabName}`).classList.add('active');
    window.scrollTo(0, 0);
    
    if (tabName === 'stats' && typeof loadGlobalStats === 'function') {
        loadGlobalStats();
    }
};

window.toggleSearch = () => bootstrap.Collapse.getOrCreateInstance(document.getElementById('searchCol')).toggle();
window.toggleComment = () => document.getElementById('comment').classList.toggle('d-none');

function formatSeconds(s) {
    const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
    const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

window.showConfirmModal = function(title, message, onConfirm) {
    const modalEl = document.getElementById('confirmActionModal');
    if (!modalEl) {
        // Fallback if modal HTML is not yet loaded
        if (confirm(message)) onConfirm();
        return;
    }
    document.getElementById('confirmActionTitle').innerText = title;
    document.getElementById('confirmActionMessage').innerText = message;
    
    const confirmBtn = document.getElementById('confirmActionBtn');
    if (confirmBtn) {
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        const modal = new bootstrap.Modal(modalEl);
        newConfirmBtn.addEventListener('click', () => {
            modal.hide();
            onConfirm();
        });
        modal.show();
    }
};
