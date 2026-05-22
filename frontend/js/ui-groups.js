/**
 * ui-groups.js — Gruppen-Wizard, Gruppen-Switcher & Einladungs-Code
 */

// ─── Gruppen-Setup-Wizard ─────────────────────────────────────────────────────

window.initGroupWizard = function(user) {
    document.getElementById('wizardStep1').classList.remove('d-none');
    document.getElementById('wizardStep2').classList.add('d-none');
    document.getElementById('wizardTitle').textContent = `${t('wizard_welcome_user', 'Willkommen')}, ${user.username}! 👋`;
    window._wizardUser = user;
    window._wizardGroup = null;
};

window.wizardCreateGroup = async function() {
    const groupName = document.getElementById('wizardGroupName').value.trim();
    const displayName = document.getElementById('wizardDisplayName').value.trim() || window._wizardUser.username;
    const btn = document.getElementById('wizardCreateBtn');
    const errorEl = document.getElementById('wizardError');

    if (!groupName) {
        errorEl.textContent = t('msg_enter_group_name', 'Bitte einen Gruppennamen eingeben.');
        errorEl.classList.remove('d-none');
        return;
    }

    const dsgvoChecked = document.getElementById('wizardCreateDsgvo').checked;
    if (!dsgvoChecked) {
        errorEl.textContent = t('msg_agree_dsgvo', 'Bitte stimme den Datenschutzbestimmungen (DSGVO Disclaimer) zu.');
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
            errorEl.textContent = data.detail || t('msg_error_create_group', 'Fehler beim Erstellen der Gruppe.');
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
        errorEl.textContent = t('msg_connection_error', 'Verbindungsfehler.');
        errorEl.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.innerHTML = t('wizard_btn_create', 'Gruppe erstellen');
    }
};

window.wizardJoinGroup = async function() {
    const code = document.getElementById('wizardJoinCode').value.trim().toUpperCase();
    const displayName = document.getElementById('wizardJoinDisplayName').value.trim();
    const btn = document.getElementById('wizardJoinBtn');
    const errorEl = document.getElementById('wizardJoinError');

    if (!code) {
        errorEl.textContent = t('msg_enter_invite_code', 'Bitte den Einladungs-Code eingeben.');
        errorEl.classList.remove('d-none');
        return;
    }

    const dsgvoChecked = document.getElementById('wizardJoinDsgvo').checked;
    if (!dsgvoChecked) {
        errorEl.textContent = t('msg_agree_dsgvo', 'Bitte stimme den Datenschutzbestimmungen (DSGVO Disclaimer) zu.');
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
            errorEl.textContent = data.detail || t('msg_invalid_code', 'Ungültiger Code.');
            errorEl.classList.remove('d-none');
            return;
        }

        Auth.setActiveGroup(data);
        await loadUserAndStart();
    } catch(e) {
        errorEl.textContent = t('msg_connection_error', 'Verbindungsfehler.');
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
        showToast(t('msg_code_copied', 'Code kopiert! 📋'));
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
                <span class="ms-auto badge bg-secondary">${g.members.length} ${g.members.length === 1 ? t('label_member_singular', 'Mitglied') : t('label_members_plural', 'Mitglieder')}</span>
            </a>
        </li>
    `).join('') + `
        <li><hr class="dropdown-divider" style="border-color:rgba(255,255,255,0.1)"></li>
        <li>
            <a class="dropdown-item small text-primary" href="#" 
               data-bs-toggle="modal" data-bs-target="#groupManageModal" onclick="openGroupManageModal(); return false;">
                ⚙️ ${t('title_manage_group', 'Gruppe verwalten')}
            </a>
        </li>
        <li>
            <a class="dropdown-item small text-info" href="#"
               onclick="showCreateGroupModal(); return false;">
                ➕ ${t('title_create_group', 'Neue Gruppe')}
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
            showToast(`${t('msg_group_switched', 'Gruppe gewechselt')}: ${group.name}`);
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
    const editBtn = document.getElementById('manageGroupNameEditBtn');
    if (editBtn) editBtn.classList.toggle('d-none', !group.is_admin);
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

    // Gäste laden
    try {
        const res = await authFetch('/guests');
        const data = await res.json();
        renderManageGuests(data.guests, group);
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
                    onclick="removeMember(${group.id}, ${m.id})">${t('btn_remove', 'Entfernen')}</button>
            ` : ''}
        </div>
    `).join('');
}

function renderManageGuests(guests, group) {
    const el = document.getElementById('manageGuestList');
    if (!el) return;

    if (guests.length === 0) {
        el.innerHTML = `<div class="text-muted small ps-1">${t('msg_no_guests_group', 'Keine Gäste in dieser Gruppe.')}</div>`;
        return;
    }

    el.innerHTML = guests.map(g => `
        <div class="d-flex align-items-center gap-2 p-2 rounded-3 mb-2" style="background:rgba(255,255,255,0.05)">
            <div class="avatar-dot" style="background:#94a3b8"></div>
            <div class="flex-grow-1">
                <div class="small fw-bold text-white">${g.name}</div>
                <div class="text-muted" style="font-size:0.65rem">${t('label_guest_singular', 'Gast')}</div>
            </div>
            <button class="btn btn-sm btn-outline-danger" style="font-size:0.7rem; padding:2px 8px"
                onclick="removeGuest(${g.id})">${t('btn_remove', 'Entfernen')}</button>
        </div>
    `).join('');
}

window.promptEditGroupName = async function() {
    const group = Auth.getActiveGroup();
    if (!group || !group.is_admin) return;

    const newName = prompt(t('prompt_new_group_name', 'Neuer Gruppenname:'), group.name);
    if (!newName || newName.trim() === '' || newName.trim() === group.name) return;

    try {
        const res = await authFetch(`/groups/${group.id}/name`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
        });

        if (res.ok) {
            const data = await res.json();
            group.name = data.name;
            Auth.setActiveGroup(group);
            document.getElementById('manageGroupName').textContent = group.name;
            showToast(t('msg_group_name_updated', 'Gruppenname aktualisiert! ✅'));
            
            // UI neu laden falls nötig (z.B. den Switcher aktualisieren)
            if (typeof initApp === 'function') initApp(group);
        } else {
            const err = await res.json();
            showToast(err.detail || t('msg_error', 'Fehler'));
        }
    } catch(e) {
        showToast(t('msg_connection_error', 'Verbindungsfehler'));
    }
};

window.removeMember = async function(groupId, userId) {
    showConfirmModal(t('title_remove_member', "Mitglied entfernen"), t('confirm_remove_member', "Willst du dieses Mitglied wirklich aus der Gruppe entfernen?"), async () => {
        try {
            const res = await authFetch(`/groups/${groupId}/member/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast(t('msg_member_removed', 'Mitglied entfernt.'));
                openGroupManageModal();
            }
        } catch(e) {
            showToast(t('msg_error_removing', 'Fehler beim Entfernen.'));
        }
    });
};

window.removeGuest = async function(guestId) {
    showConfirmModal(t('title_remove_guest', "Gast entfernen"), t('confirm_remove_guest', "Willst du diesen Gast wirklich aus der Gruppe entfernen?"), async () => {
        try {
            const res = await authFetch(`/guests/${guestId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast(t('msg_guest_removed', 'Gast entfernt.'));
                openGroupManageModal();
            } else {
                const data = await res.json();
                showToast(data.detail || t('msg_error_removing', 'Fehler beim Entfernen.'));
            }
        } catch(e) {
            showToast(t('msg_error_removing', 'Fehler beim Entfernen.'));
        }
    });
};

window.addGuestFromManage = async function() {
    const input = document.getElementById('manageNewGuestNameInput');
    const name = input ? input.value.trim() : '';
    if (!name) {
        showToast(t('msg_enter_name', 'Bitte einen Namen eingeben.'));
        return;
    }
    
    try {
        const res = await authFetch('/guests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            showToast(t('msg_guest_added', 'Gast hinzugefügt.'));
            if (input) input.value = '';
            openGroupManageModal();
        } else {
            const data = await res.json();
            showToast(data.detail || t('msg_error_adding', 'Fehler beim Hinzufügen.'));
        }
    } catch(e) {
        showToast(t('msg_connection_error', 'Verbindungsfehler.'));
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
        showToast(t('msg_new_code_generated', 'Neuer Code generiert! ✅'));
    } catch(e) {
        showToast(t('msg_error', 'Fehler.'));
    }
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

window.showToast = function(msg) {
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
        errorEl.textContent = t('msg_enter_group_name', 'Bitte einen Gruppennamen eingeben.');
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
            errorEl.textContent = data.detail || t('msg_error_creating', 'Fehler beim Erstellen.');
            errorEl.classList.remove('d-none');
            return;
        }

        const modalEl = document.getElementById('createGroupModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        Auth.setActiveGroup(data);
        await loadUserAndStart();
        showToast(t('msg_group_created', "Gruppe '{name}' erstellt! 🎉").replace('{name}', data.name));
    } catch(e) {
        errorEl.textContent = t('msg_connection_error', 'Fehler beim Verbinden.');
        errorEl.classList.remove('d-none');
    }
};

