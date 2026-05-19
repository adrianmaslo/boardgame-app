/**
 * ui-groups.js — Gruppen-Wizard, Gruppen-Switcher & Einladungs-Code
 */

// ─── Gruppen-Setup-Wizard ─────────────────────────────────────────────────────

window.initGroupWizard = function(user) {
    document.getElementById('wizardStep1').classList.remove('d-none');
    document.getElementById('wizardStep2').classList.add('d-none');
    document.getElementById('wizardTitle').textContent = `Willkommen, ${user.username}! 👋`;
    window._wizardUser = user;
    window._wizardGroup = null;
};

window.wizardCreateGroup = async function() {
    const groupName = document.getElementById('wizardGroupName').value.trim();
    const displayName = document.getElementById('wizardDisplayName').value.trim() || window._wizardUser.username;
    const btn = document.getElementById('wizardCreateBtn');
    const errorEl = document.getElementById('wizardError');

    if (!groupName) {
        errorEl.textContent = 'Bitte einen Gruppennamen eingeben.';
        errorEl.classList.remove('d-none');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>';
    errorEl.classList.add('d-none');

    try {
        const res = await authFetch('/groups/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: groupName, display_name: displayName })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.detail || 'Fehler beim Erstellen der Gruppe.';
            errorEl.classList.remove('d-none');
            return;
        }

        window._wizardGroup = data;
        Auth.setActiveGroup(data);

        // Weiter zu Schritt 2 (Mitglieder einladen)
        document.getElementById('wizardStep1').classList.add('d-none');
        document.getElementById('wizardStep2').classList.remove('d-none');
        document.getElementById('wizardInviteCode').textContent = data.invite_code;
        document.getElementById('wizardGroupNameDisplay').textContent = data.name;

        // Mitglieder-Liste rendern
        renderWizardMembers(data.members);
    } catch(e) {
        errorEl.textContent = 'Verbindungsfehler.';
        errorEl.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Gruppe erstellen';
    }
};

window.wizardJoinGroup = async function() {
    const code = document.getElementById('wizardJoinCode').value.trim().toUpperCase();
    const displayName = document.getElementById('wizardJoinDisplayName').value.trim();
    const btn = document.getElementById('wizardJoinBtn');
    const errorEl = document.getElementById('wizardJoinError');

    if (!code) {
        errorEl.textContent = 'Bitte den Einladungs-Code eingeben.';
        errorEl.classList.remove('d-none');
        return;
    }

    btn.disabled = true;
    errorEl.classList.add('d-none');

    try {
        const res = await authFetch('/groups/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invite_code: code, display_name: displayName || null })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.detail || 'Ungültiger Code.';
            errorEl.classList.remove('d-none');
            return;
        }

        Auth.setActiveGroup(data);
        await loadUserAndStart();
    } catch(e) {
        errorEl.textContent = 'Verbindungsfehler.';
        errorEl.classList.remove('d-none');
    } finally {
        btn.disabled = false;
    }
};

window.wizardDone = function() {
    if (window._wizardGroup) {
        loadUserAndStart();
    }
};

window.copyInviteCode = function(code) {
    const c = code || document.getElementById('wizardInviteCode')?.textContent
           || document.getElementById('groupInviteCode')?.textContent;
    if (!c) return;
    navigator.clipboard.writeText(c).then(() => {
        showToast('Code kopiert! 📋');
    });
};

function renderWizardMembers(members) {
    const el = document.getElementById('wizardMemberList');
    if (!el) return;
    el.innerHTML = members.map(m => `
        <div class="d-flex align-items-center gap-2 py-1">
            <div class="avatar-dot" style="background:${m.avatar_color || '#6366f1'}"></div>
            <span class="text-white small">${m.display_name}</span>
            ${m.is_admin ? '<span class="badge bg-primary rounded-pill" style="font-size:0.6rem">Admin</span>' : ''}
        </div>
    `).join('');
}

// ─── Gruppen-Switcher (im Header) ────────────────────────────────────────────

window.renderGroupSwitcher = function(groups, activeGroupId) {
    const el = document.getElementById('groupSwitcherItems');
    if (!el) return;

    el.innerHTML = groups.map(g => `
        <li>
            <a class="dropdown-item d-flex align-items-center gap-2 ${g.id === activeGroupId ? 'active' : ''}"
               href="#" onclick="switchGroup(${g.id}); return false;">
                <span class="small fw-bold">${g.name}</span>
                <span class="ms-auto badge bg-secondary">${g.members.length} Mitglieder</span>
            </a>
        </li>
    `).join('') + `
        <li><hr class="dropdown-divider" style="border-color:rgba(255,255,255,0.1)"></li>
        <li>
            <a class="dropdown-item small text-primary" href="#" 
               data-bs-toggle="modal" data-bs-target="#groupManageModal" onclick="openGroupManageModal(); return false;">
                ⚙️ Gruppe verwalten
            </a>
        </li>
        <li>
            <a class="dropdown-item small text-info" href="#"
               onclick="showCreateGroupModal(); return false;">
                ➕ Neue Gruppe
            </a>
        </li>
    `;
};

window.switchGroup = async function(groupId) {
    try {
        const res = await authFetch('/auth/me');
        const me = await res.json();
        const group = me.groups.find(g => g.id === groupId);
        if (group) {
            Auth.setActiveGroup(group);
            // App neu laden
            if (typeof initApp === 'function') initApp(group);
            showToast(`Gruppe gewechselt: ${group.name}`);
        }
    } catch(e) {
        console.error('Fehler beim Gruppenwechsel:', e);
    }
};

// ─── Gruppe verwalten (Modal) ─────────────────────────────────────────────────

window.openGroupManageModal = async function() {
    const group = Auth.getActiveGroup();
    if (!group) return;

    document.getElementById('manageGroupName').textContent = group.name;
    document.getElementById('groupInviteCode').textContent = group.invite_code;
    document.getElementById('manageIsAdmin').classList.toggle('d-none', !group.is_admin);

    // Mitglieder laden
    try {
        const res = await authFetch(`/groups/${group.id}/members`);
        const data = await res.json();
        renderManageMembers(data.members, group);
    } catch(e) {
        console.error(e);
    }
};

function renderManageMembers(members, group) {
    const el = document.getElementById('manageMemberList');
    if (!el) return;
    const user = Auth.getUser();

    el.innerHTML = members.map(m => `
        <div class="d-flex align-items-center gap-2 p-2 rounded-3 mb-2" style="background:rgba(255,255,255,0.05)">
            <div class="avatar-dot" style="background:${m.avatar_color || '#6366f1'}"></div>
            <div class="flex-grow-1">
                <div class="small fw-bold text-white">${m.display_name}</div>
                <div class="text-muted" style="font-size:0.65rem">@${m.username}</div>
            </div>
            ${m.is_admin ? '<span class="badge bg-primary" style="font-size:0.6rem">Admin</span>' : ''}
            ${(group.is_admin && !m.is_admin) ? `
                <button class="btn btn-sm btn-outline-danger" style="font-size:0.7rem; padding:2px 8px"
                    onclick="removeMember(${group.id}, ${m.id})">Entfernen</button>
            ` : ''}
        </div>
    `).join('');
}

window.removeMember = async function(groupId, userId) {
    if (!confirm('Mitglied wirklich entfernen?')) return;
    try {
        const res = await authFetch(`/groups/${groupId}/member/${userId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Mitglied entfernt.');
            openGroupManageModal();
        }
    } catch(e) {
        showToast('Fehler beim Entfernen.');
    }
};

window.regenerateCode = async function() {
    const group = Auth.getActiveGroup();
    if (!group) return;
    try {
        const res = await authFetch(`/groups/${group.id}/new-code`, { method: 'POST' });
        const data = await res.json();
        document.getElementById('groupInviteCode').textContent = data.invite_code;
        // Aktive Gruppe aktualisieren
        group.invite_code = data.invite_code;
        Auth.setActiveGroup(group);
        showToast('Neuer Code generiert! ✅');
    } catch(e) {
        showToast('Fehler.');
    }
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function showToast(msg) {
    const toast = document.getElementById('appToast');
    if (!toast) { alert(msg); return; }
    document.getElementById('appToastMsg').textContent = msg;
    const bsToast = new bootstrap.Toast(toast, { delay: 2500 });
    bsToast.show();
}

window.showCreateGroupModal = function() {
    const modalEl = document.getElementById('createGroupModal');
    if (modalEl) {
        document.getElementById('newGroupName').value = '';
        document.getElementById('newGroupDisplayName').value = Auth.getUser()?.username || '';
        document.getElementById('createGroupError').classList.add('d-none');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
};

window.createNewGroupFromModal = async function() {
    const name = document.getElementById('newGroupName').value.trim();
    const displayName = document.getElementById('newGroupDisplayName').value.trim();
    const errorEl = document.getElementById('createGroupError');

    if (!name) {
        errorEl.textContent = 'Bitte einen Gruppennamen eingeben.';
        errorEl.classList.remove('d-none');
        return;
    }

    try {
        const res = await authFetch('/groups/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, display_name: displayName || null })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.detail || 'Fehler beim Erstellen.';
            errorEl.classList.remove('d-none');
            return;
        }

        const modalEl = document.getElementById('createGroupModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        Auth.setActiveGroup(data);
        await loadUserAndStart();
        showToast(`Gruppe '${data.name}' erstellt! 🎉`);
    } catch(e) {
        errorEl.textContent = 'Fehler beim Verbinden.';
        errorEl.classList.remove('d-none');
    }
};

