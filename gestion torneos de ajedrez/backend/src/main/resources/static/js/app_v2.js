/**
 * app_v2.js - LOGICA MAESTRA (BANNER DE CAMPEÓN AL FINAL)
 */

let currentTournamentId = null;

document.addEventListener('DOMContentLoaded', () => {
    window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.error('Error: ' + msg + '\nScript: ' + url + '\nLine: ' + lineNo);
        return false;
    };

    checkAuthStatus();
    initNavigation();
    initModals();
    initForms();
    renderDashboard();
    renderTournamentList();
});

function checkAuthStatus() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
        document.getElementById('login-overlay').style.display = 'flex';
    } else {
        const user = JSON.parse(userStr);
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('current-username').textContent = user.username;
        const roleBadge = document.getElementById('user-role-badge');
        const isAdmin = String(user.role).toUpperCase() === 'ADMIN';
        if (isAdmin) {
            roleBadge.textContent = 'ADMINISTRADOR';
            roleBadge.style.color = '#eab308'; 
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        } else {
            roleBadge.textContent = 'JUGADOR';
            roleBadge.style.color = '#94a3b8';
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }
    }
}

function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            showView(target);
            if(target === 'dashboard-view') renderDashboard();
            if(target === 'tournaments-view') renderTournamentList();
            if(target === 'users-view') renderUsers();
            if(target === 'players-view') renderPlayersView();
            if(target === 'ranking-view') renderGlobalRanking();
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.currentTarget.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
};

window.openModal = function(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active'); 
};

window.closeModal = function(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active'); 
};

function initModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    });
}

function initForms() {
    const errorDiv = document.getElementById('login-error');
    const toggleLink = document.getElementById('toggle-auth-mode');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    
    if(toggleLink) {
        toggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            errorDiv.style.display = 'none';
            if(formLogin.style.display === 'none') {
                formLogin.style.display = 'block'; formRegister.style.display = 'none';
                toggleLink.textContent = '¿No tienes cuenta? Regístrate';
            } else {
                formLogin.style.display = 'none'; formRegister.style.display = 'block';
                toggleLink.textContent = '¿Ya tienes cuenta? Inicia sesión';
            }
        });
    }

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('login-user').value;
            const pass = document.getElementById('login-pass').value;
            const recaptchaToken = grecaptcha.getResponse(0);
            if(!recaptchaToken) { alert('Marca el reCAPTCHA'); return; }
            const res = await API.login(user, pass, recaptchaToken);
            if (res && res.token) {
                localStorage.setItem('jwt_token', res.token);
                localStorage.setItem('currentUser', JSON.stringify(res.usuario));
                checkAuthStatus(); connectWebSocket(); renderDashboard();
            } else {
                errorDiv.textContent = 'Error de login'; errorDiv.style.display = 'block';
            }
        });
    }

    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('reg-user').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-pass').value;
            const elo = parseInt(document.getElementById('reg-elo').value) || 1200;
            const recaptchaToken = grecaptcha.getResponse(1);
            if(!recaptchaToken) { alert('Marca el reCAPTCHA'); return; }
            const res = await API.register(user, pass, email, 'ADMIN', elo, recaptchaToken); 
            if (res) { alert("Cuenta creada."); toggleLink.click(); }
        });
    }

    const formCreate = document.getElementById('form-create-tournament');
    if (formCreate) {
        formCreate.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formCreate.querySelector('button[type="submit"]');
            btn.disabled = true; btn.innerHTML = 'Creando...';
            try {
                const nombre = document.getElementById('form-t-name').value;
                const sistemaJuego = document.getElementById('form-t-sistema').value;
                const maxRondas = sistemaJuego === 'SUIZO' ? parseInt(document.getElementById('form-t-rondas').value) : null;
                const t = await API.createTorneo({ nombre, descripcion: "Torneo de Ajedrez", sistemaJuego, maxRondas });
                if(t) { closeModal('create-tournament-modal'); renderDashboard(); renderTournamentList(); openTournamentDetail(t.id); }
            } catch (err) { alert("Error al crear"); } finally { btn.disabled = false; btn.innerHTML = 'Crear Torneo'; }
        });
    }

    const formAddPlayer = document.getElementById('form-add-player');
    if (formAddPlayer) {
        formAddPlayer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mode = document.getElementById('add-player-mode').value;
            let data = {};
            if (mode === 'existente') {
                const select = document.getElementById('form-p-select');
                if(select.selectedIndex === -1) { alert("Selecciona un jugador"); return; }
                data.nombre = select.options[select.selectedIndex].text.split(' [ELO:')[0].trim();
            } else {
                data.nombre = document.getElementById('form-p-name').value;
                data.email = document.getElementById('form-p-email').value;
                data.elo = document.getElementById('form-p-elo').value;
                const recaptchaToken = grecaptcha.getResponse(2) || grecaptcha.getResponse(1);
                if(!recaptchaToken) { alert("Marca el reCAPTCHA"); return; }
                data.recaptchaToken = recaptchaToken;
            }
            const res = await API.inscribirJugador(currentTournamentId, data);
            if (res && res.id) { closeModal('add-player-modal'); renderTournamentDetail(currentTournamentId); }
            else { alert("Error: " + (res?.message || "Inscripción fallida")); }
        });
    }

    const formEditElo = document.getElementById('form-edit-elo');
    if (formEditElo) {
        formEditElo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('edit-elo-userid').value;
            const newElo = document.getElementById('edit-elo-input').value;
            await fetchWithAuth(`${window.API_BASE}/usuarios/${userId}`, {
                method: 'PUT', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ eloRating: parseInt(newElo) })
            });
            closeModal('edit-elo-modal'); renderUsers(); renderPlayersView(); renderGlobalRanking();
        });
    }
}

// DASHBOARD
async function renderDashboard() {
    const tournaments = await API.getTorneos();
    const users = await API.getUsuarios();
    document.getElementById('stat-active-tournaments').textContent = tournaments.filter(t => t.estado === 'EN_CURSO').length;
    document.getElementById('stat-total-players').textContent = users.filter(u => String(u.role || '').toUpperCase() !== 'ADMIN').length;
    const activeMatches = await API.getActiveMatchesCount();
    document.getElementById('stat-active-matches').textContent = activeMatches;
    const recentList = document.getElementById('recent-tournaments-list');
    recentList.innerHTML = '';
    [...tournaments].reverse().slice(0, 10).forEach(t => recentList.appendChild(createTournamentUIItem(t)));
    renderGlobalRanking();
}

async function renderGlobalRanking() {
    const users = await API.getUsuarios();
    const tbody = document.querySelector('#global-ranking-table tbody');
    if(!tbody) return;
    const sorted = [...users].sort((a, b) => (b.eloRating || 0) - (a.eloRating || 0));
    tbody.innerHTML = sorted.map((u, i) => {
        let pos = `#${i+1}`;
        let style = '';
        if(i === 0) { pos = '🥇 Oro'; style = 'background:rgba(251,191,36,0.15); border-left:5px solid #fbbf24; font-weight:bold;'; }
        else if(i === 1) { pos = '🥈 Plata'; style = 'background:rgba(148,163,184,0.15); border-left:5px solid #94a3b8;'; }
        else if(i === 2) { pos = '🥉 Bronce'; style = 'background:rgba(180,83,9,0.15); border-left:5px solid #b45309;'; }
        const crown = String(u.role).toUpperCase() === 'ADMIN' ? '👑' : '';
        return `<tr style="${style}"><td style="font-weight:700">${pos}</td><td>${u.username} ${crown}</td><td>${u.role || 'PLAYER'}</td><td style="text-align:right"><strong>${u.eloRating}</strong></td></tr>`;
    }).join('');
}

async function renderTournamentList() {
    const tList = await API.getTorneos();
    const lc = document.getElementById('all-tournaments-list');
    lc.innerHTML = '';
    [...tList].reverse().forEach(t => lc.appendChild(createTournamentUIItem(t)));
}

function createTournamentUIItem(t) {
    const div = document.createElement('div');
    div.className = 'tournament-item';
    div.style = 'display:flex; justify-content:space-between; align-items:center; background:white; padding:1.2rem; border-radius:12px; margin-bottom:0.8rem; box-shadow:0 2px 4px rgba(0,0,0,0.05); border-left:4px solid var(--accent-color);';
    let badgeClass = t.estado === 'EN_CURSO' ? 'status-active' : (t.estado === 'FINALIZADO' ? 'status-completed' : 'status-pending');
    div.innerHTML = `
        <div><h4 style="margin:0">${t.nombre}</h4><small>${t.sistemaJuego} • <span class="status-badge ${badgeClass}" style="padding:1px 6px; font-size:10px;">${t.estado}</span></small></div>
        <button class="btn btn-primary" onclick="openTournamentDetail('${t.id}')">ENTRAR</button>`;
    return div;
}

window.openTournamentDetail = async function(id) {
    currentTournamentId = id; showView('tournament-detail-view'); renderTournamentDetail(id);
};

async function renderTournamentDetail(id) {
    const t = await API.getTorneo(id);
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isAdmin = String(user.role).toUpperCase() === 'ADMIN';

    // TITULO Y ESTADO A LA IZQUIERDA (HEADER NORMAL)
    const header = document.querySelector('#tournament-detail-view .view-header');
    if(header) {
        header.style = 'display: flex; justify-content: space-between; align-items: center; width: 100%;';
    }

    document.getElementById('detail-t-name').textContent = t.nombre;
    document.getElementById('detail-t-status').textContent = t.estado;
    
    const inscRes = await fetchWithAuth(`${window.API_BASE}/torneos/${id}/inscripciones`);
    const inscripciones = await inscRes.json();
    const partidas = await API.getPartidas(id);

    const detailContainer = document.getElementById('tournament-detail-view');
    const oldBanner = document.getElementById('champion-banner-global');
    if(oldBanner) oldBanner.remove();

    if (t.estado === 'FINALIZADO') {
        const winner = [...inscripciones].sort((a,b) => b.puntosAcumulados - a.puntosAcumulados)[0];
        if(winner) {
            const bannerWrapper = document.createElement('div');
            bannerWrapper.id = 'champion-banner-global';
            bannerWrapper.style = 'width: 100%; display: flex; justify-content: center; margin: 20px 0; clear: both;';
            
            const banner = document.createElement('div');
            banner.style = [
                'background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                'color: white',
                'padding: 20px 40px',
                'border-radius: 15px',
                'text-align: center',
                'font-weight: 800',
                'font-size: 1.8rem',
                'box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4)',
                'border: 3px solid white',
                'display: inline-block'
            ].join(';');
            
            banner.innerHTML = `🏆 &nbsp; ¡EL GRAN CAMPEÓN ES: ${winner.usuario.username.toUpperCase()}! &nbsp; 🏆`;
            bannerWrapper.appendChild(banner);
            header.insertAdjacentElement('afterend', bannerWrapper);
        }
    }

    const actions = document.getElementById('detail-t-actions');
    const addPlayerGroup = document.getElementById('btn-add-player-group');

    if (actions) {
        actions.style = 'display: flex; justify-content: flex-end; align-items: center; gap: 10px; width: 100%;';
        actions.innerHTML = '';
        
        const yaIniciado = partidas.length > 0 || t.estado === 'EN_CURSO';
        
        if (t.estado === 'PENDIENTE' && !yaIniciado) {
            actions.innerHTML = `<button class="btn btn-primary" onclick="startTournament('${id}')"><i class="fa-solid fa-play"></i> INICIAR TORNEO</button>`;
            if(addPlayerGroup) addPlayerGroup.style.display = 'flex';
        } else if (t.estado !== 'FINALIZADO') {
            
            // Detectar si la ronda actual tiene partidas pendientes ('P')
            const maxRound = partidas.length > 0 ? Math.max(...partidas.map(p => p.rondaNumero || 1)) : 0;
            const currentRoundMatches = partidas.filter(p => (p.rondaNumero || 1) === maxRound);
            const rondaActualCompleta = currentRoundMatches.length > 0 && currentRoundMatches.every(p => p.resultado !== 'P');
            
            let isFinal = false;
            let actionButtons = '';

            if (t.sistemaJuego === 'ROUND_ROBIN') {
                const allMatchesFinished = partidas.length > 0 && partidas.every(p => p.resultado !== 'P');
                isFinal = allMatchesFinished;
            } else if (t.sistemaJuego === 'SUIZO') {
                const nJugadores = inscripciones.length;
                const rondasEsperadas = t.maxRondas || Math.ceil(Math.log2(Math.max(nJugadores, 2)));
                isFinal = rondaActualCompleta && maxRound >= rondasEsperadas;
                
                // Si es suizo y la ronda terminó pero no es la final, mostramos ambos
                if (rondaActualCompleta && !isFinal) {
                    actionButtons = `
                        <button class="btn" style="background:#dc2626; color:white; padding:10px 20px; border-radius:8px;" onclick="completeTournament('${id}')"><i class="fa-solid fa-trophy"></i> FINALIZAR YA</button>
                        <button class="btn btn-primary" onclick="startTournament('${id}')"><i class="fa-solid fa-forward"></i> SIGUIENTE RONDA</button>
                    `;
                }
            } else if (t.sistemaJuego.includes('ELIMINATORIA')) {
                if (currentRoundMatches.length === 1 && currentRoundMatches[0].resultado !== 'P') isFinal = true;
            }

            if (!actionButtons) {
                if (isFinal) {
                    actionButtons = `<button class="btn btn-primary" style="background:#dc2626;" onclick="completeTournament('${id}')"><i class="fa-solid fa-trophy"></i> FINALIZAR TORNEO</button>`;
                } else if (rondaActualCompleta) {
                    actionButtons = `<button class="btn btn-primary" onclick="startTournament('${id}')"><i class="fa-solid fa-forward"></i> SIGUIENTE RONDA</button>`;
                } else {
                    actionButtons = `<span style="color:var(--text-muted); font-size:0.9rem;"><i class="fa-solid fa-clock"></i> Ronda ${maxRound} en curso — completa todos los resultados</span>`;
                }
            }

            actions.innerHTML = actionButtons;
            if(addPlayerGroup) addPlayerGroup.style.display = 'none';
        } else {
            actions.innerHTML = '<span class="status-badge status-completed">TORNEO FINALIZADO</span>';
            if(addPlayerGroup) addPlayerGroup.style.display = 'none';
        }
        
        if (isAdmin) {
            actions.innerHTML += `<button class="btn" style="background:#dc2626; color:white; padding:10px 20px; border-radius:8px;" onclick="deleteTournament('${id}')"><i class="fa-solid fa-trash-can"></i> ELIMINAR</button>`;
        }
    }
    
    renderPlayers(inscripciones, t.estado, id);
    renderRounds(partidas, t.estado, id, t.sistemaJuego, inscripciones);
    renderStandings(inscripciones, t.estado);
}

window.deleteTournament = async function(id) {
    if (confirm("¿Eliminar este torneo?")) { await fetchWithAuth(`${window.API_BASE}/torneos/${id}`, { method: 'DELETE' }); showView('dashboard-view'); renderDashboard(); renderTournamentList(); }
};

function renderPlayers(inscripciones, estado, tId) {
    const tbody = document.querySelector('#players-table tbody');
    if(!tbody) return;
    tbody.innerHTML = inscripciones.map(ins => `
        <tr><td><strong>${ins.usuario.username}</strong></td><td>${ins.usuario.eloRating}</td>
            <td style="text-align:right">${estado === 'PENDIENTE' ? `<button class="btn" style="color:red; background:none;" onclick="removePlayer('${tId}', '${ins.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}</td>
        </tr>`).join('');
}

window.removePlayer = async function(tId, insId) {
    if (confirm("¿Eliminar?")) { await API.deleteInscripcion(tId, insId); renderTournamentDetail(tId); }
};

function renderRounds(partidas, estado, tId, sistema, inscripciones) {
    const container = document.getElementById('rounds-container');
    if (!container) return; container.innerHTML = '';
    if (!partidas.length) { container.innerHTML = '<div style="text-align:center; padding:2rem; color:gray;">No hay partidas aún.</div>'; return; }
    const rounds = {};
    partidas.forEach(p => { const r = p.rondaNumero || 1; if (!rounds[r]) rounds[r] = []; rounds[r].push(p); });
    Object.keys(rounds).sort((a, b) => b - a).forEach(rNum => {
        const div = document.createElement('div');
        div.className = 'round-section mt-4';
        div.style = 'background:white; padding:1.2rem; border-radius:12px; margin-bottom:1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border:1px solid var(--accent-light);';
        div.innerHTML = `<h4 style="color:var(--accent-color); border-bottom:2px solid var(--accent-light); padding-bottom:0.5rem; margin-bottom:1rem;">Ronda ${rNum}</h4>`;
        rounds[rNum].forEach(p => {
            let bracketInfo = '';
            let rowStyle = '';
            if (sistema === 'DOBLE_ELIMINATORIA') {
                const bLosses = inscripciones.find(ins => ins.usuario.id === p.blancas?.id)?.derrotas || 0;
                const nLosses = inscripciones.find(ins => ins.usuario.id === p.negras?.id)?.derrotas || 0;
                if (bLosses === 0 && nLosses === 0) bracketInfo = '<span style="color:#16a34a; font-size:10px;">[GANADORES]</span>';
                else if (bLosses === 1 && nLosses === 1) { bracketInfo = '<span style="color:#dc2626; font-size:10px;">[PERDEDORES]</span>'; rowStyle = 'background:#fff7f7;'; }
                else { bracketInfo = '<span style="color:#7c3aed; font-size:10px;">[GRAN FINAL]</span>'; rowStyle = 'background:#f5f3ff;'; }
            }
            div.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee; ${rowStyle}">
                    <div style="flex:2;">
                        <div>${bracketInfo}</div>
                        <span style="font-weight:600; color:${p.resultado==='1-0'?'#16a34a':'inherit'}">${p.blancas?.username || '?'}</span> vs 
                        <span style="font-weight:600; color:${p.resultado==='0-1'?'#16a34a':'inherit'}">${p.negras?.username || 'ESPERANDO...'}</span>
                    </div>
                    <div style="flex:1; text-align:right;">
                        <select onchange="setResult('${p.id}', this.value)" style="padding:4px; border-radius:6px; font-weight:bold; cursor:pointer;">
                            <option value="P" ${p.resultado==='P'?'selected':''}>P</option>
                            <option value="1-0" ${p.resultado==='1-0'?'selected':''}>1-0</option>
                            <option value="0.5-0.5" ${p.resultado==='0.5-0.5'?'selected':''}>½</option>
                            <option value="0-1" ${p.resultado==='0-1'?'selected':''}>0-1</option>
                        </select>
                    </div>
                </div>`;
        });
        container.appendChild(div);
    });
}

window.setResult = async function(partidaId, resultado) {
    await fetchWithAuth(`${window.API_BASE}/partidas/${partidaId}/resultado`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resultado }) });
    renderTournamentDetail(currentTournamentId);
};

function renderStandings(inscripciones, estado) {
    const table = document.getElementById('standings-table');
    if (!table) return;
    const exp = document.getElementById('standings-explanation');
    if(exp) exp.innerHTML = `<i class="fa-solid fa-circle-info"></i> Desempates: 1º <strong>Buchholz</strong>, 2º <strong>Sonneborn-Berger</strong>.`;
    const thead = table.querySelector('thead');
    thead.innerHTML = `<tr><th>Pos</th><th>Jugador</th><th>Pts</th><th>Buchholz</th><th>S-B</th><th>Partidas</th></tr>`;
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    const sorted = [...inscripciones].sort((a, b) => {
        if (b.puntosAcumulados !== a.puntosAcumulados) return b.puntosAcumulados - a.puntosAcumulados;
        if ((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
        return (b.sonnebornBerger || 0) - (a.sonnebornBerger || 0);
    });
    tbody.innerHTML = sorted.map((ins, i) => {
        let pos = `#${i+1}`;
        let style = '';
        if(i === 0) { pos = '🥇 Oro'; style = 'background:rgba(251,191,36,0.15); border-left:5px solid #fbbf24; font-weight:bold;'; }
        else if(i === 1) { pos = '🥈 Plata'; style = 'background:rgba(148,163,184,0.15); border-left:5px solid #94a3b8;'; }
        else if(i === 2) { pos = '🥉 Bronce'; style = 'background:rgba(180,83,9,0.15); border-left:5px solid #b45309;'; }
        return `<tr style="${style}"><td>${pos}</td><td><strong>${ins.usuario.username}</strong></td><td><span style="color:var(--accent-color); font-weight:800;">${ins.puntosAcumulados}</span></td><td>${ins.buchholz || 0}</td><td>${ins.sonnebornBerger || 0}</td><td>${ins.partidasJugadas}</td></tr>`;
    }).join('');
}

window.openAddPlayerModal = async function(mode) {
    const modal = document.getElementById('add-player-modal');
    if (!modal) return;
    document.getElementById('add-player-mode').value = mode;
    togglePlayerTab(mode);
    if (mode === 'existente') {
        const users = await API.getUsuarios();
        const playersOnly = users.filter(u => String(u.role || '').toUpperCase() !== 'ADMIN');
        const select = document.getElementById('form-p-select');
        if (select) select.innerHTML = playersOnly.map(u => `<option value="${u.id}">${u.username} [ELO: ${u.eloRating}]</option>`).join('');
    }
    modal.classList.add('active');
};

window.togglePlayerTab = function(tab) {
    document.getElementById('tab-existente-content').style.display = (tab === 'existente') ? 'block' : 'none';
    document.getElementById('tab-nuevo-content').style.display = (tab === 'nuevo') ? 'block' : 'none';
};

async function renderUsers() {
    const users = await API.getUsuarios();
    const admins = users.filter(u => String(u.role).toUpperCase() === 'ADMIN');
    const tbody = document.querySelector('#global-users-table tbody');
    if(tbody) tbody.innerHTML = admins.map(u => `<tr><td>${u.username} 👑</td><td>${u.email}</td><td>${u.eloRating}</td><td>ADMIN</td><td><div style="display:flex; gap:5px;"><button class="btn btn-secondary" onclick="openEditEloModal('${u.id}', '${u.username}', ${u.eloRating})">ELO</button><button class="btn" style="background:#dc2626; color:white; padding:4px 8px; border-radius:6px;" onclick="deleteUser('${u.id}', '${u.username}')"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>`).join('');
}

async function renderPlayersView() {
    const users = await API.getUsuarios();
    const players = users.filter(u => String(u.role).toUpperCase() !== 'ADMIN');
    const tbody = document.querySelector('#global-players-table tbody');
    if(tbody) tbody.innerHTML = players.map(p => `<tr><td>${p.username}</td><td>${p.email}</td><td>${p.eloRating}</td><td>${p.role || 'PLAYER'}</td><td><div style="display:flex; gap:5px;"><button class="btn btn-secondary" onclick="openEditEloModal('${p.id}', '${p.username}', ${p.eloRating})">ELO</button><button class="btn" style="background:#dc2626; color:white; padding:4px 8px; border-radius:6px;" onclick="deleteUser('${p.id}', '${p.username}')"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>`).join('');
}

window.deleteUser = async function(id, name) {
    if (confirm(`¿Eliminar a "${name}"?`)) { await fetchWithAuth(`${window.API_BASE}/usuarios/${id}`, { method: 'DELETE' }); renderUsers(); renderPlayersView(); renderDashboard(); }
};

window.openEditEloModal = function(id, name, elo) {
    document.getElementById('edit-elo-userid').value = id;
    document.getElementById('edit-elo-username').textContent = name;
    document.getElementById('edit-elo-input').value = elo;
    openModal('edit-elo-modal');
};

window.startTournament = async function(tId) { await API.startTorneo(tId); renderTournamentDetail(tId); };
window.completeTournament = async function(id) { if (confirm("¿Finalizar?")) { await API.finalizarTorneo(id); renderTournamentDetail(id); } };
window.logout = function() { localStorage.removeItem('jwt_token'); localStorage.removeItem('currentUser'); location.reload(); };

function connectWebSocket() {
    const wsUrl = window.API_BASE ? window.API_BASE.replace('/api', '') + '/ws-chess' : 'http://localhost:8080/ws-chess';
    const socket = new SockJS(wsUrl);
    const client = Stomp.over(socket);
    client.connect({}, () => {
        client.subscribe('/topic/notifications', () => { if(currentTournamentId) renderTournamentDetail(currentTournamentId); });
    });
}

window.toggleRoundsInput = function(val) {
    const group = document.getElementById('group-t-rondas');
    if (group) group.style.display = (val === 'SUIZO') ? 'block' : 'none';
};
