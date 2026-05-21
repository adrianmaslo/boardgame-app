/**
 * auth.js — Authentifizierung & API-Wrapper für Game-Log Pro v1.1
 */

const AUTH_TOKEN_KEY = 'glp_token';
const AUTH_USER_KEY  = 'glp_user';
const AUTH_GROUP_KEY = 'glp_active_group';

// ─── Token Management ─────────────────────────────────────────────────────────

window.Auth = {
    getToken() {
        return localStorage.getItem(AUTH_TOKEN_KEY);
    },
    getUser() {
        const u = localStorage.getItem(AUTH_USER_KEY);
        return u ? JSON.parse(u) : null;
    },
    getActiveGroup() {
        const g = localStorage.getItem(AUTH_GROUP_KEY);
        return g ? JSON.parse(g) : null;
    },
    setActiveGroup(group) {
        localStorage.setItem(AUTH_GROUP_KEY, JSON.stringify(group));
        window.dispatchEvent(new CustomEvent('groupChanged', { detail: group }));
    },
    isLoggedIn() {
        return !!this.getToken();
    },
    _save(token, user) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    },
    logout() {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_GROUP_KEY);
        localStorage.removeItem('activeTimer');
        showAuthView();
    }
};

// ─── Auth-gesicherter fetch-Wrapper ──────────────────────────────────────────

window.authFetch = async function(url, options = {}) {
    const token = Auth.getToken();
    const activeGroup = Auth.getActiveGroup();

    // group_id als Query-Parameter anhängen wenn vorhanden und GET-Request
    if (activeGroup && (!options.method || options.method === 'GET')) {
        const separator = url.includes('?') ? '&' : '?';
        if (!url.includes('group_id')) {
            url = `${url}${separator}group_id=${activeGroup.id}`;
        }
    }

    const headers = {
        ...(options.headers || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        Auth.logout();
        return null;
    }
    return response;
};

// ─── Login ────────────────────────────────────────────────────────────────────

let _loginInProgress = false;
window.doLogin = async function() {
    if (_loginInProgress) return;
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    const errorEl = document.getElementById('loginError');

    if (!username || !password) {
        errorEl.textContent = 'Bitte Username und Passwort eingeben.';
        errorEl.classList.remove('d-none');
        return;
    }

    _loginInProgress = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Einloggen...';
    errorEl.classList.add('d-none');

    try {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.detail || 'Login fehlgeschlagen.';
            errorEl.classList.remove('d-none');
            return;
        }

        Auth._save(data.access_token, data.user);
        await loadUserAndStart();
    } catch (e) {
        errorEl.textContent = 'Verbindungsfehler. Ist der Server erreichbar?';
        errorEl.classList.remove('d-none');
    } finally {
        _loginInProgress = false;
        btn.disabled = false;
        btn.innerHTML = 'Einloggen';
    }
};

// ─── Registrierung ────────────────────────────────────────────────────────────

window.doRegister = async function() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;
    const email = document.getElementById('regEmail').value.trim();
    const btn = document.getElementById('registerBtn');
    const errorEl = document.getElementById('registerError');

    errorEl.classList.add('d-none');

    if (!username || !password) {
        errorEl.textContent = 'Bitte Username und Passwort eingeben.';
        errorEl.classList.remove('d-none');
        return;
    }
    if (password !== password2) {
        errorEl.textContent = 'Passwörter stimmen nicht überein.';
        errorEl.classList.remove('d-none');
        return;
    }
    if (password.length < 6) {
        errorEl.textContent = 'Passwort muss mindestens 6 Zeichen haben.';
        errorEl.classList.remove('d-none');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registrieren...';

    try {
        const res = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email: email || null })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.detail || 'Registrierung fehlgeschlagen.';
            errorEl.classList.remove('d-none');
            return;
        }

        Auth._save(data.access_token, data.user);
        await loadUserAndStart();
    } catch (e) {
        errorEl.textContent = 'Verbindungsfehler.';
        errorEl.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Konto erstellen';
    }
};

// ─── App-Start nach Login ─────────────────────────────────────────────────────

window.loadUserAndStart = async function() {
    try {
        const res = await authFetch('/auth/me');
        if (!res) return; // 401 → logout bereits ausgelöst
        const me = await res.json();

        // User-Daten aktualisieren
        Auth._save(Auth.getToken(), {
            id: me.id, username: me.username,
            email: me.email, avatar_color: me.avatar_color
        });

        if (me.groups.length === 0) {
            // Keine Gruppe → Gruppen-Setup-Wizard zeigen
            showGroupSetupWizard(me);
        } else {
            // Aktive Gruppe setzen (erste oder gespeicherte)
            const savedGroup = Auth.getActiveGroup();
            const activeGroup = savedGroup && me.groups.find(g => g.id === savedGroup.id)
                ? me.groups.find(g => g.id === savedGroup.id)
                : me.groups[0];

            Auth.setActiveGroup(activeGroup);
            showMainApp(me, activeGroup);
        }
    } catch (e) {
        console.error('Fehler beim Laden des Users:', e);
        Auth.logout();
    }
};

// ─── View-Switcher ────────────────────────────────────────────────────────────

function showAuthView() {
    document.getElementById('authView').classList.remove('d-none');
    document.getElementById('mainApp').classList.add('d-none');
    document.getElementById('groupWizard').classList.add('d-none');
}

function showMainApp(user, group) {
    document.getElementById('authView').classList.add('d-none');
    document.getElementById('groupWizard').classList.add('d-none');
    document.getElementById('mainApp').classList.remove('d-none');

    // Header aktualisieren
    const headerUser = document.getElementById('headerUsername');
    if (headerUser) headerUser.textContent = user.username;

    // App initialisieren
    if (typeof initApp === 'function') initApp(group);
}

function showGroupSetupWizard(user) {
    document.getElementById('authView').classList.add('d-none');
    document.getElementById('mainApp').classList.add('d-none');
    document.getElementById('groupWizard').classList.remove('d-none');
    if (typeof initGroupWizard === 'function') initGroupWizard(user);
}

// ─── Tab-Switch zwischen Login & Register ────────────────────────────────────

window.showLoginTab = function() {
    document.getElementById('loginTab').classList.remove('d-none');
    document.getElementById('registerTab').classList.add('d-none');
    document.getElementById('authTabLogin').classList.add('active');
    document.getElementById('authTabRegister').classList.remove('active');
};

window.showRegisterTab = function() {
    document.getElementById('loginTab').classList.add('d-none');
    document.getElementById('registerTab').classList.remove('d-none');
    document.getElementById('authTabLogin').classList.remove('active');
    document.getElementById('authTabRegister').classList.add('active');
};

// Enter-Taste im Login-Formular
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const authView = document.getElementById('authView');
            if (authView && !authView.classList.contains('d-none')) {
                e.preventDefault();
                e.stopPropagation();
                const loginTab = document.getElementById('loginTab');
                if (!loginTab.classList.contains('d-none')) {
                    doLogin();
                } else {
                    doRegister();
                }
            }
        }
    });
});


window.confirmAccountDeletion = function() {
    console.log("confirmAccountDeletion: Clicked");
    const user = Auth.getUser();
    if (!user) {
        console.error("confirmAccountDeletion: No user logged in.");
        return;
    }

    // Reset modal fields
    const hintEl = document.getElementById('deleteConfirmUsernameHint');
    if (hintEl) hintEl.textContent = user.username;
    
    const inputEl = document.getElementById('deleteConfirmUsername');
    if (inputEl) inputEl.value = '';

    const alertEl = document.getElementById('deleteAccountAlert');
    if (alertEl) {
        alertEl.classList.add('d-none');
        alertEl.textContent = '';
    }

    const modalEl = document.getElementById('deleteAccountModal');
    if (modalEl) {
        console.log("confirmAccountDeletion: Showing modal");
        window.deleteAccountModalInstance = new bootstrap.Modal(modalEl);
        window.deleteAccountModalInstance.show();
    } else {
        console.error("confirmAccountDeletion: deleteAccountModal element not found!");
    }
};

window.deleteAccountSubmit = async function() {
    console.log("deleteAccountSubmit: Initiated");
    const user = Auth.getUser();
    if (!user) return;

    const typedUsername = document.getElementById('deleteConfirmUsername').value.trim();
    const alertEl = document.getElementById('deleteAccountAlert');
    const btn = document.getElementById('deleteAccountBtn');

    if (typedUsername.toLowerCase() !== user.username.toLowerCase()) {
        alertEl.textContent = `Fehler: Bitte gib exakt den Namen "${user.username}" ein.`;
        alertEl.className = 'alert alert-danger rounded-3 small py-2 px-3 mb-3';
        alertEl.classList.remove('d-none');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Wird gelöscht...';
    alertEl.classList.add('d-none');

    try {
        const res = await authFetch('/auth/me', { method: 'DELETE' });
        if (!res) {
            btn.disabled = false;
            btn.textContent = '🔥 Konto endgültig löschen';
            return;
        }
        
        const data = await res.json();
        
        if (res.ok) {
            alertEl.textContent = '✅ Dein Konto wurde erfolgreich gelöscht.';
            alertEl.className = 'alert alert-success rounded-3 small py-2 px-3 mb-3';
            alertEl.classList.remove('d-none');
            
            setTimeout(() => {
                if (window.deleteAccountModalInstance) {
                    window.deleteAccountModalInstance.hide();
                }
                Auth.logout();
            }, 2000);
        } else {
            alertEl.textContent = data.detail || 'Fehler beim Löschen des Kontos.';
            alertEl.className = 'alert alert-danger rounded-3 small py-2 px-3 mb-3';
            alertEl.classList.remove('d-none');
            btn.disabled = false;
            btn.textContent = '🔥 Konto endgültig löschen';
        }
    } catch (e) {
        console.error("deleteAccountSubmit: Error during deletion", e);
        alertEl.textContent = 'Verbindungsfehler beim Versuch, das Konto zu löschen.';
        alertEl.className = 'alert alert-danger rounded-3 small py-2 px-3 mb-3';
        alertEl.classList.remove('d-none');
        btn.disabled = false;
        btn.textContent = '🔥 Konto endgültig löschen';
    }
};

