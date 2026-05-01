/**
 * app.js - LOGICA PRINCIPAL DEL FRONTEND
 * Gestiona la interfaz, navegación, formularios y comunicación WebSockets.
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

/**
 * Alterna la visibilidad de la contraseña entre texto plano y asteriscos.
 */
window.togglePassword = function(inputId) {
    const input = document.getElementById(inputId);
    const btn = input.nextElementSibling;
    if (input.type === "password") {
        input.type = "text";
        btn.innerHTML = "&#128064;"; // Ojo abierto
    } else {
        input.type = "password";
        btn.innerHTML = "&#128065;"; // Ojo cerrado
    }
};

function checkAuthStatus() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
        document.getElementById('login-overlay').style.display = 'flex';
    } else {
        const user = JSON.parse(userStr);
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('current-username').textContent = user.username;
        const roleBadge = document.getElementById('user-role-badge');
        
        const isAdmin = user.role === 'ADMIN';
        if (isAdmin) {
            roleBadge.textContent = 'ADMINISTRADOR';
            roleBadge.style.color = '#eab308'; 
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        } else {
            roleBadge.textContent = 'JUGADOR / LEYENDA';
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
                formLogin.style.display = 'block';
                formRegister.style.display = 'none';
                toggleLink.textContent = '¿No tienes cuenta? Regístrate';
            } else {
                formLogin.style.display = 'none';
                formRegister.style.display = 'block';
                toggleLink.textContent = '¿Ya tienes cuenta? Inicia sesión';
            }
        });
    }

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.style.display = 'none';
            const user = document.getElementById('login-user').value;
            const pass = document.getElementById('login-pass').value;
            const recaptchaToken = grecaptcha.getResponse(0);
            if(!recaptchaToken) { alert('Marca el reCAPTCHA'); return; }
            const res = await API.login(user, pass, recaptchaToken);
            if (res && res.token) {
                localStorage.setItem('jwt_token', res.token);
                localStorage.setItem('currentUser', JSON.stringify(res.usuario));
                checkAuthStatus(); 
                connectWebSocket();
                renderDashboard();
            } else {
                errorDiv.textContent = 'Error de login';
                errorDiv.style.display = 'block';
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
            if (res) {
                alert("Cuenta creada.");
                toggleLink.click(); 
            }
        });
    }

    const formCreate = document.getElementById('form-create-tournament');
    if (formCreate) {
        formCreate.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formCreate.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            
            // Evitar doble envío
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creando...';
            
            try {
                const nombre = document.getElementById('form-t-name').value;
                const sistemaJuego = document.getElementById('form-t-sistema').value;
                const t = await API.createTorneo({ nombre, descripcion: "Torneo de Ajedrez", sistemaJuego });
                if(t) {
                    closeModal('create-tournament-modal');
                    renderDashboard();
                    renderTournamentList();
                    openTournamentDetail(t.id);
                }
            } catch (err) {
                console.error(err);
                alert("Error al crear el torneo");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }

    const formAddPlayer = document.getElementById('form-add-player');
    if (formAddPlayer) {
        formAddPlayer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mode = document.getElementById('add-player-mode').value;
            const recaptchaToken = grecaptcha.getResponse(2) || "test-token"; // El index depende de cuantos hay
            
            let data = { recaptchaToken };
        if (mode === 'existente') {
            const select = document.getElementById('form-p-select');
            const selectedUserId = select.value;
            // Buscar el usuario en el caché local o volver a pedirlo (mejor guardarlo al abrir el modal)
            data.nombre = select.options[select.selectedIndex].text;
            // No enviamos ELO para no sobreescribir el actual del jugador existente
        } else {
            data.nombre = document.getElementById('form-p-name').value;
            data.email = document.getElementById('form-p-email').value;
            data.elo = document.getElementById('form-p-elo').value;
            data.pass = "1234";
        }
            
            const res = await API.inscribirJugador(currentTournamentId, data);
            if (res && res.id) {
                closeModal('add-player-modal');
                renderTournamentDetail(currentTournamentId);
            } else {
                alert("Error al inscribir: " + (res?.message || "Verifica los datos"));
            }
        });
    }

    const formEditElo = document.getElementById('form-edit-elo');
    if (formEditElo) {
        formEditElo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('edit-elo-userid').value;
            const newElo = document.getElementById('edit-elo-input').value;
            // Usamos el endpoint PUT existente en UsuarioController
            await fetchWithAuth(`${window.API_BASE}/usuarios/${userId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ eloRating: parseInt(newElo) })
            });
            closeModal('edit-elo-modal');
            renderUsers();
            renderPlayersView();
            renderGlobalRanking();
        });
    }
}

window.logout = function() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('currentUser');
    location.reload();
};

window.openAddPlayerModal = async function(mode) {
    console.log("Abriendo modal para añadir jugador, modo:", mode);
    const modal = document.getElementById('add-player-modal');
    if (!modal) { console.error("No se encontró el modal add-player-modal"); return; }
    
    document.getElementById('add-player-mode').value = mode;
    togglePlayerTab(mode);
    
    if (mode === 'existente') {
        try {
            const users = await API.getUsuarios();
            // Filtro estricto: excluimos a cualquiera que sea ADMIN
            const playersOnly = users.filter(u => {
                const role = String(u.role || '').toUpperCase().trim();
                return role !== 'ADMIN'; 
            });
            
            const select = document.getElementById('form-p-select');
            if (select) {
                if (playersOnly.length === 0) {
                    select.innerHTML = '<option value="">No hay jugadores registrados</option>';
                } else {
                    // Mostramos el nombre y el rol para saber qué estamos filtrando
                    select.innerHTML = playersOnly.map(u => `<option value="${u.id}">${u.username} [${u.role || 'Sin Rol'}]</option>`).join('');
                }
            }
        } catch (err) {
            console.error("Error al cargar usuarios para la lista:", err);
        }
    }
    
    modal.classList.add('active');
};

window.togglePlayerTab = function(tab) {
    const exContent = document.getElementById('tab-existente-content');
    const nuContent = document.getElementById('tab-nuevo-content');
    const exBtn = document.getElementById('tab-btn-existente');
    const nuBtn = document.getElementById('tab-btn-nuevo');
    
    if (tab === 'existente') {
        exContent.style.display = 'block';
        nuContent.style.display = 'none';
        exBtn.classList.add('active');
        nuBtn.classList.remove('active');
        document.getElementById('add-player-mode').value = 'existente';
    } else {
        exContent.style.display = 'none';
        nuContent.style.display = 'block';
        exBtn.classList.remove('active');
        nuBtn.classList.add('active');
        document.getElementById('add-player-mode').value = 'nuevo';
    }
};

window.deleteTournament = async function(id) {
    if (confirm("¿Seguro que deseas eliminar este torneo?")) {
        await API.deleteTorneo(id);
        showView('tournaments-view');
        renderTournamentList();
        renderDashboard();
    }
};

window.completeTournament = async function(id) {
    if (confirm("¿Deseas finalizar el torneo? No se podrán registrar más resultados.")) {
        await API.finalizarTorneo(id);
        renderTournamentDetail(id);
    }
};

async function renderUsers() {
    const users = await API.getUsuarios();
    const admins = users.filter(u => u.role === 'ADMIN');
    const tbody = document.querySelector('#global-users-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    admins.forEach(u => {
        const isAdmin = u.role === 'ADMIN';
        tbody.innerHTML += `
            <tr>
                <td>${u.username} ${isAdmin ? '<i class="fa-solid fa-crown" style="color: #eab308;" title="Admin"></i>' : ''}</td>
                <td>${u.email}</td>
                <td>${u.eloRating}</td>
                <td><span class="status-badge ${isAdmin ? 'status-active' : 'status-pending'}">${u.role}</span></td>
                <td>
                    <button class="btn btn-secondary" onclick="openEditEloModal('${u.id}', '${u.username}', ${u.eloRating})">Editar ELO</button>
                </td>
            </tr>
        `;
    });
}

async function renderPlayersView() {
    const users = await API.getUsuarios();
    const players = users.filter(u => u.role === 'PLAYER');
    const tbody = document.querySelector('#global-players-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    players.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td>${p.username}</td>
                <td>${p.email}</td>
                <td>${p.eloRating}</td>
                <td><span class="status-badge status-pending">PLAYER</span></td>
                <td>
                    <button class="btn btn-secondary" onclick="openEditEloModal('${p.id}', '${p.username}', ${p.eloRating})">ELO</button>
                </td>
            </tr>
        `;
    });
}

window.openEditEloModal = function(id, name, elo) {
    document.getElementById('edit-elo-userid').value = id;
    document.getElementById('edit-elo-username').textContent = name;
    document.getElementById('edit-elo-input').value = elo;
    openModal('edit-elo-modal');
};

async function renderDashboard() {
    const tournaments = await API.getTorneos();
    document.getElementById('stat-active-tournaments').textContent = tournaments.filter(t => t.estado === 'EN_CURSO').length;
    const users = await API.getUsuarios();
    document.getElementById('stat-total-players').textContent = users.filter(u => u.role !== 'ADMIN').length;
    
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
    tbody.innerHTML = '';
    const sorted = [...users].sort((a, b) => (b.eloRating || 0) - (a.eloRating || 0));
    sorted.forEach((u, i) => {
        const crown = u.role === 'ADMIN' ? '<i class="fa-solid fa-crown" style="color: #eab308; margin-left: 5px;"></i>' : '';
        tbody.innerHTML += `<tr><td>#${i+1}</td><td>${u.username}${crown}</td><td>${u.role}</td><td style="text-align:right">${u.eloRating}</td></tr>`;
    });
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
    let sLabel = t.estado === 'EN_CURSO' ? 'En curso' : (t.estado === 'FINALIZADO' ? 'Finalizado' : 'Pendiente');
    let sClass = t.estado === 'EN_CURSO' ? 'status-active' : (t.estado === 'FINALIZADO' ? 'status-completed' : 'status-pending');
    
    div.innerHTML = `
        <div class="tournament-info">
            <h4>${t.nombre}</h4>
            <span class="text-muted">${t.sistemaJuego}</span>
        </div>
        <div style="display:flex; align-items:center; gap: 1rem;">
            <span class="status-badge ${sClass}">${sLabel}</span>
            <button class="btn btn-secondary" onclick="openTournamentDetail('${t.id}')">Ver</button>
        </div>
    `;
    return div;
}

window.openTournamentDetail = async function(id) {
    currentTournamentId = id;
    showView('tournament-detail-view');
    renderTournamentDetail(id);
};

async function renderTournamentDetail(id) {
    const t = await API.getTorneo(id);
    document.getElementById('detail-t-name').textContent = t.nombre;
    const sBadge = document.getElementById('detail-t-status');
    sBadge.textContent = t.estado;
    
    // Titulo dinámico según sistema
    const standingsTitle = document.querySelector('#tab-standings h3');
    if (standingsTitle) {
        let label = "Clasificación";
        let color = "#7c3aed";
        if(t.sistemaJuego === 'SUIZO') label = "Sistema Suizo";
        if(t.sistemaJuego === 'ELIMINATORIA') { label = "Eliminatoria Directa"; color = "#dc2626"; }
        if(t.sistemaJuego === 'DOBLE_ELIMINATORIA') { label = "Doble Eliminación"; color = "#1e40af"; }
        if(t.sistemaJuego === 'ROUND_ROBIN') { label = "Round Robin"; color = "#0369a1"; }
        
        standingsTitle.innerHTML = `Clasificación <span style="background:${color}; color:white; padding:2px 8px; border-radius:10px; font-size:12px;">${label}</span>`;
    }

    const exp = document.getElementById('standings-explanation');
    if (exp) {
        if (t.sistemaJuego === 'SUIZO' || t.sistemaJuego === 'ROUND_ROBIN') {
            exp.innerHTML = `<i class="fa-solid fa-circle-info"></i> En caso de empate a puntos, la posición se decide primero por el sistema <strong>Buchholz</strong> y luego por <strong>Sonneborn-Berger</strong>.`;
        } else {
            exp.innerHTML = `<i class="fa-solid fa-circle-info"></i> En modos de eliminación, los puntos reflejan el avance en las llaves.`;
        }
    }

    try {
        const inscRes = await fetchWithAuth(`${window.API_BASE}/torneos/${id}/inscripciones`);
        const inscripciones = await inscRes.json();
        const partidas = await API.getPartidas(id);

        // Acciones del torneo según estado
        const actions = document.getElementById('detail-t-actions');
        if (actions) {
            actions.innerHTML = '';
            if (t.estado === 'PENDIENTE') {
                actions.innerHTML = `
                    <button class="btn btn-primary" onclick="startTournament('${id}')">
                        <i class="fa-solid fa-play"></i> Iniciar Torneo
                    </button>
                    <button class="btn btn-secondary" onclick="deleteTournament('${id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
                document.getElementById('btn-add-player-group').style.display = 'flex';
            } else if (t.estado === 'EN_CURSO') {
                actions.innerHTML = `
                    <button class="btn btn-primary" onclick="startTournament('${id}')">
                        <i class="fa-solid fa-forward"></i> Siguiente Ronda
                    </button>
                    <button class="btn btn-secondary" onclick="completeTournament('${id}')">
                        <i class="fa-solid fa-check-double"></i> Finalizar
                    </button>
                `;
                document.getElementById('btn-add-player-group').style.display = 'none';
            } else {
                const sorted = sortInscripciones([...inscripciones]);
                const winner = sorted[0];
                if (winner) {
                    actions.innerHTML = `
                        <div style="text-align: right;">
                            <span class="status-badge status-completed" style="margin-bottom: 0.5rem; display: inline-block;">TORNEO FINALIZADO</span><br>
                            <span style="font-size: 1.2rem; font-weight: bold; color: #92400e; background: #fef9c3; padding: 4px 12px; border-radius: 8px; border: 1px solid #fde047;">
                                <i class="fa-solid fa-trophy" style="color: #eab308;"></i> Campeón: ${winner.usuario.username}
                            </span>
                        </div>
                    `;
                } else {
                    actions.innerHTML = `<span class="status-badge status-completed">TORNEO FINALIZADO</span>`;
                }
                document.getElementById('btn-add-player-group').style.display = 'none';
            }
        }

        renderPlayers(inscripciones, t.estado, id);
        renderRounds(partidas, t.estado, id);
        renderStandings(inscripciones, t.estado, t.sistemaJuego);
    } catch (err) {
        console.error("Error al renderizar detalles del torneo:", err);
    }
}

function renderPlayers(inscripciones, estado, tId) {
    const tbody = document.querySelector('#players-table tbody');
    tbody.innerHTML = '';
    inscripciones.forEach(ins => {
        let actionsHtml = '';
        if (estado === 'PENDIENTE') {
            actionsHtml = `<button class="btn btn-danger" onclick="removePlayer('${tId}', '${ins.id}')"><i class="fa-solid fa-user-minus"></i></button>`;
        }
        tbody.innerHTML += `<tr><td>${ins.usuario.username}</td><td>${ins.usuario.eloRating}</td><td>${actionsHtml}</td></tr>`;
    });
}

window.removePlayer = async function(tId, insId) {
    if (confirm("¿Remover jugador del torneo?")) {
        await API.deleteInscripcion(tId, insId);
        renderTournamentDetail(tId);
    }
};

function renderRounds(partidas, estado, tId) {
    const container = document.getElementById('rounds-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!partidas || partidas.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);"><i class="fa-solid fa-ghost" style="font-size:2rem; margin-bottom:1rem; display:block;"></i> No hay partidas generadas para este torneo aún.</div>';
        return;
    }

    console.log("Renderizando partidas:", partidas);
    
    // Agrupar por ronda
    const rounds = {};
    partidas.forEach(p => {
        const rKey = p.rondaNumero || 1;
        if (!rounds[rKey]) rounds[rKey] = [];
        rounds[rKey].push(p);
    });

    Object.keys(rounds).sort((a, b) => b - a).forEach(rNum => {
        const div = document.createElement('div');
        div.className = 'round-section mt-4';
        div.style = 'margin-bottom: 2rem; border: 1px solid var(--accent-light); border-radius: 8px; padding: 1rem; background: #fff;';
        div.innerHTML = `<h4 class="mb-2" style="border-bottom: 2px solid var(--accent-light); padding-bottom: 0.5rem;">Ronda ${rNum}</h4>`;
        
        rounds[rNum].forEach(p => {
            const row = document.createElement('div');
            row.className = 'pairing-row';
            row.style = 'display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid #f0eade;';
            
            const resultDisplay = (p.resultado && p.resultado !== 'P') ? p.resultado : 'Pendiente';
            const cleanEstado = (estado || '').trim().toUpperCase();
            
            // Si no hay resultado definitivo, permitimos editar
            const canEdit = !p.resultado || p.resultado === 'P' || p.resultado === 'null' || p.resultado === '';
            
            row.innerHTML = `
                <div style="flex: 2;">
                    <button onclick="alert('DIAGNÓSTICO:\\nID: ${p.id}\\nEstado Torneo: ${cleanEstado}\\nResultado Actual: ${p.resultado}\\nBlancas: ${p.blancas ? p.blancas.username : 'NULL'}\\nNegras: ${p.negras ? p.negras.username : 'NULL'}')" 
                            style="background:#3b82f6; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:10px; margin-right:5px;">i</button>
                    <span style="font-weight: 600;">${p.blancas ? p.blancas.username : '???'}</span> 
                    <span style="color: var(--accent-color); margin: 0 0.5rem;">vs</span> 
                    <span style="font-weight: 600;">${p.negras ? p.negras.username : 'BYE'}</span>
                </div>
                <div style="flex: 1; text-align: center;">
                    <span class="status-badge ${p.resultado && p.resultado !== 'P' ? 'status-completed' : 'status-pending'}">${resultDisplay}</span>
                </div>
                <div style="flex: 1; text-align: right;">
                    ${canEdit ? `
                        <div style="display: flex; gap: 4px; justify-content: flex-end;">
                            <button class="btn" style="padding: 4px 8px; font-size: 0.75rem; background: #16a34a; color: white; border-radius:4px;" onclick="setResult('${p.id}', '1-0')">1-0</button>
                            <button class="btn" style="padding: 4px 8px; font-size: 0.75rem; background: #94a3b8; color: white; border-radius:4px;" onclick="setResult('${p.id}', '0.5-0.5')">½</button>
                            <button class="btn" style="padding: 4px 8px; font-size: 0.75rem; background: #dc2626; color: white; border-radius:4px;" onclick="setResult('${p.id}', '0-1')">0-1</button>
                        </div>
                    ` : '<span style="color:gray; font-size:12px;">Finalizada</span>'}
                </div>
            `;
            div.appendChild(row);
        });
        container.appendChild(div);
    });
}

window.setResult = async function(partidaId, resultado) {
    await fetchWithAuth(`${window.API_BASE}/partidas/${partidaId}/resultado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado })
    });
    renderTournamentDetail(currentTournamentId);
};

function sortInscripciones(list) {
    return list.sort((a, b) => {
        if (b.puntosAcumulados !== a.puntosAcumulados) {
            return b.puntosAcumulados - a.puntosAcumulados;
        }
        if ((b.buchholz || 0) !== (a.buchholz || 0)) {
            return (b.buchholz || 0) - (a.buchholz || 0);
        }
        return (b.sonnebornBerger || 0) - (a.sonnebornBerger || 0);
    });
}

function renderStandings(inscripciones, estado, sistema) {
    const tbody = document.querySelector('#standings-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const sorted = sortInscripciones([...inscripciones]);

    sorted.forEach((ins, i) => {
        let posDisplay = `#${i+1}`;
        let rowStyle = '';
        
        if (estado === 'FINALIZADO') {
            if (i === 0) {
                posDisplay = `<i class="fa-solid fa-medal" style="color: #fbbf24;"></i> Oro`;
                rowStyle = 'background: #fffbeb; font-weight: 600;';
            } else if (i === 1) {
                posDisplay = `<i class="fa-solid fa-medal" style="color: #94a3b8;"></i> Plata`;
                rowStyle = 'background: #f8fafc;';
            } else if (i === 2) {
                posDisplay = `<i class="fa-solid fa-medal" style="color: #b45309;"></i> Bronce`;
                rowStyle = 'background: #fff7ed;';
            }
        }

        tbody.innerHTML += `<tr style="${rowStyle}">
            <td>${posDisplay}</td>
            <td>${ins.usuario.username}</td>
            <td><strong>${ins.puntosAcumulados}</strong></td>
            <td>${ins.buchholz || 0}</td>
            <td>${ins.sonnebornBerger || 0}</td>
            <td>${ins.partidasJugadas}</td>
        </tr>`;
    });
}

window.startTournament = async function(tId) {
    await API.startTorneo(tId);
    renderTournamentDetail(tId);
};

// WebSockets
let stompClient = null;
function connectWebSocket() {
    // Generar la URL de WebSocket dinámicamente basada en la base de la API
    const wsUrl = window.API_BASE ? window.API_BASE.replace('/api', '') + '/ws-chess' : 'http://localhost:8080/ws-chess';
    console.log("Conectando WebSocket a:", wsUrl);
    const socket = new SockJS(wsUrl);
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        stompClient.subscribe('/topic/notifications', function (notification) {
            alert("Notificación: " + notification.body);
            if (currentTournamentId) renderTournamentDetail(currentTournamentId);
        });
    });
}
