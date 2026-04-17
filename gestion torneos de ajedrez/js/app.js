/**
 * app.js - REFACTORED FOR CLIENT-SERVER ARCHITECTURE
 * Consumes Java Spring Boot API (H2 Database)
 */

let currentTournamentId = null;
// API_BASE is declared in api.js globally

document.addEventListener('DOMContentLoaded', () => {
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
        
        // Update Sidebar Profile
        document.getElementById('current-username').textContent = user.username;
        const roleBadge = document.getElementById('user-role-badge');
        
        // True Role distinction from Database
        const isAdmin = user.role === 'ADMIN';
        if (isAdmin) {
            roleBadge.textContent = 'ADMINISTRADOR';
            roleBadge.style.color = '#eab308'; // Gold
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        } else {
            roleBadge.textContent = 'JUGADOR / LEYENDA';
            roleBadge.style.color = '#94a3b8'; // Silver/Gray
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

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function openModal(modalId) { document.getElementById(modalId).classList.add('active'); }
function closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }
function initModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    });
}

function initForms() {
    // Auth Form Logic
    const errorDiv = document.getElementById('login-error');
    
    // Toggle Login/Register
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
            const res = await API.login(user, pass);
            if (res) {
                localStorage.setItem('currentUser', JSON.stringify(res));
                // Force check and UI update
                checkAuthStatus(); 
                renderDashboard();
            } else {
                errorDiv.textContent = 'Credenciales inválidas o error de red';
                errorDiv.style.display = 'block';
            }
        });
    }

    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.style.display = 'none';
            const user = document.getElementById('reg-user').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-pass').value;
            
            // All new registrations from management are ADMIN
            const res = await API.register(user, pass, email, 'ADMIN'); 
            
            if (res) {
                alert("Cuenta creada con éxito. Ya puedes iniciar sesión.");
                // Toggle back to login form
                toggleLink.click(); 
                // Clear fields
                formRegister.reset();
            } else {
                errorDiv.textContent = 'Error al registrar, nombre usuario puede estar en uso';
                errorDiv.style.display = 'block';
            }
        });
    }

    document.getElementById('form-create-tournament').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('form-t-name').value;
        const t = await API.createTorneo({ nombre, descripcion: "Torneo de Ajedrez", sistemaJuego: "ROUND_ROBIN" });
        if(t) {
            document.getElementById('form-t-name').value = '';
            closeModal('create-tournament-modal');
            renderDashboard();
            renderTournamentList();
            openTournamentDetail(t.id);
        } else {
            alert("Error al crear el torneo. Asegúrate de que el servidor (backend) esté en ejecución en el puerto 8080.");
        }
    });

    document.getElementById('form-add-player').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentTournamentId) return;
        const nombre = document.getElementById('form-p-name').value;
        const elo = document.getElementById('form-p-elo').value;
        
        // Custom API method added to api.js (I need to make sure it matches the new controller)
        await fetch(`${window.API_BASE}/torneos/${currentTournamentId}/inscripciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, elo: elo || 1200 })
        }).catch(err => {
            console.error("Error inscripciones:", err);
            alert("Error: no se pudo conectar con el servidor.");
        });

        document.getElementById('form-p-name').value = '';
        document.getElementById('form-p-elo').value = '';
        closeModal('add-player-modal');
        renderTournamentDetail(currentTournamentId);
    });

    document.getElementById('form-edit-tournament').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-t-id').value;
        const nombre = document.getElementById('edit-t-name').value;
        const ubicacion = document.getElementById('edit-t-location').value;
        const descripcion = document.getElementById('edit-t-desc').value;
        
        await fetch(`${window.API_BASE}/torneos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, ubicacion, descripcion })
        });
        
        closeModal('edit-tournament-modal');
        renderTournamentDetail(id);
        renderDashboard();
        renderTournamentList();
    });


}

async function renderDashboard() {
    const tournaments = await API.getTorneos();
    
    // Stats
    const activeT = tournaments.filter(t => t.estado === 'EN_CURSO').length;
    document.getElementById('stat-active-tournaments').textContent = activeT;
    
    let totalP = 0;
    let activeM = 0;

    for (const t of tournaments) {
        try {
            const inscRes = await fetch(`${API_BASE}/torneos/${t.id}/inscripciones`);
            const insc = await inscRes.json();
            if(insc) totalP += insc.length;

            if (t.estado === 'EN_CURSO') {
                const partidas = await API.getPartidas(t.id);
                if(partidas) activeM += partidas.filter(p => !p.resultado || p.resultado === 'P' || p.resultado === '').length;
            }
        } catch (e) {
            console.error("No se pudieron cargar estadisticas completas para", t.id);
        }
    }

    document.getElementById('stat-total-players').textContent = totalP;
    document.getElementById('stat-active-matches').textContent = activeM;

    // Upcoming list
    const recentList = document.getElementById('recent-tournaments-list');
    recentList.innerHTML = '';
    const recent = [...tournaments].reverse().slice(0, 4);
    if(recent.length === 0) recentList.innerHTML = '<p class="text-muted">No hay torneos próximos.</p>';
    else recent.forEach(t => recentList.appendChild(createTournamentUIItem(t)));
}

async function renderTournamentList() {
    const tList = await API.getTorneos();
    const lc = document.getElementById('all-tournaments-list');
    lc.innerHTML = '';
    if(!tList || tList.length === 0) lc.innerHTML = '<p class="text-muted mt-4">Lista vacía.</p>';
    else [...tList].reverse().forEach(t => lc.appendChild(createTournamentUIItem(t)));
}

function createTournamentUIItem(t) {
    const div = document.createElement('div');
    div.className = 'tournament-item';
    let statusLabel = 'Pendiente', statusClass = 'status-pending';
    if(t.estado === 'EN_CURSO') { statusLabel = 'En curso'; statusClass = 'status-active'; }
    if(t.estado === 'FINALIZADO') { statusLabel = 'Finalizado'; statusClass = 'status-completed'; }
    
    div.innerHTML = `
        <div class="tournament-info">
            <h4>${t.nombre}</h4>
            <span class="text-muted" style="font-size: 0.9rem;">${t.sistemaJuego} | ${t.ubicacion}</span>
        </div>
        <div style="display:flex; align-items:center; gap: 1rem;">
            <span class="status-badge ${statusClass}">${statusLabel}</span>
            <button class="btn btn-secondary" onclick="openTournamentDetail('${t.id}')">Administrar</button>
        </div>
    `;
    return div;
}

window.openTournamentDetail = async function(id) {
    currentTournamentId = id;
    showView('tournament-detail-view');
    document.querySelector('.tab-btn[data-tab="tab-players"]').click();
    renderTournamentDetail(id);
};



window.removeInscripcion = async function(insId) {
    if(!currentTournamentId) return;
    if(confirm('¿Seguro que deseas sacar a este jugador del torneo?')) {
        await API.deleteInscripcion(currentTournamentId, insId);
        renderTournamentDetail(currentTournamentId);
    }
};

async function renderTournamentDetail(id) {
    const t = await API.getTorneo(id);
    if(!t) return;

    document.getElementById('detail-t-name').textContent = t.nombre;
    const sBadge = document.getElementById('detail-t-status');
    sBadge.className = 'status-badge';
    let sLabel = 'Pendiente';
    if(t.estado === 'EN_CURSO') { sLabel = 'En curso'; sBadge.classList.add('status-active'); }
    else if(t.estado === 'FINALIZADO') { sLabel = 'Finalizado'; sBadge.classList.add('status-completed'); }
    else { sBadge.classList.add('status-pending'); }
    sBadge.textContent = sLabel;

    // Get inscriptions to check player count
    const inscRes = await fetch(`${API_BASE}/torneos/${id}/inscripciones`);
    const inscripciones = await inscRes.json();

    const btnGenRounds = document.getElementById('btn-generate-rounds');
    if(t.estado === 'PENDIENTE' && inscripciones.length >= 2) {
        btnGenRounds.classList.remove('hidden');
    } else {
        btnGenRounds.classList.add('hidden');
    }

    const actionsContainer = document.getElementById('detail-t-actions');
    actionsContainer.innerHTML = '';
    
    // Add delete button if pending
    if(t.estado === 'PENDIENTE') {
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-danger';
        btnDelete.style.marginRight = '0.5rem';
        btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i> Eliminar Torneo';
        btnDelete.onclick = () => deleteTournament(t.id);
        actionsContainer.appendChild(btnDelete);
        
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-secondary';
        btnEdit.style.background = '#e2d2c1';
        btnEdit.style.color = '#4a3018';
        btnEdit.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar';
        btnEdit.onclick = () => openEditTournamentModal(t);
        actionsContainer.appendChild(btnEdit);

        document.getElementById('btn-add-player').style.display = 'inline-flex';
    } else if (t.estado === 'EN_CURSO') {
        const btnFinish = document.createElement('button');
        btnFinish.type = 'button';
        btnFinish.className = 'btn btn-primary';
        btnFinish.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Concluir Torneo';
        btnFinish.onclick = () => {
             console.log("Concluir Torneo clickeado para ID:", t.id);
             finishTournament(t.id);
        };
        actionsContainer.appendChild(btnFinish);
        document.getElementById('btn-add-player').style.display = 'none';
    } else {
        // FINALIZADO
        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'btn btn-danger';
        btnDelete.style.marginRight = '0.5rem';
        btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i> Eliminar Histórico';
        btnDelete.onclick = () => deleteTournament(t.id);
        actionsContainer.appendChild(btnDelete);
        
        document.getElementById('btn-add-player').style.display = 'none';
    }

    renderPlayers(inscripciones, t.estado);
    const partidas = await API.getPartidas(id);
    renderRounds(partidas, t.estado, id);
    renderStandings(inscripciones, t.estado);
}

function renderPlayers(inscripciones, estado) {
    const tbody = document.querySelector('#players-table tbody');
    tbody.innerHTML = '';
    if(!inscripciones || inscripciones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay jugadores</td></tr>'; return;
    }
    inscripciones.forEach(ins => {
        const p = ins.usuario;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; color:var(--primary-color)"><a href="#" onclick="openPlayerStats('${ins.id}', '${p.id}', '${p.username}', '${p.eloRating}', '${ins.puntosAcumulados || 0.0}', ${ins.victorias || 0}, ${ins.empates || 0}, ${ins.derrotas || 0})" style="text-decoration:none; color:inherit;">${p.username}</a></td>
            <td><span class="elo-tag" style="background:var(--accent-light); color:var(--primary-color)">${p.eloRating}</span></td>
            <td>${estado === 'PENDIENTE' ? `<button class="btn btn-danger" onclick="removeInscripcion('${ins.id}')"><i class="fa-solid fa-trash"></i></button>` : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.openPlayerStats = function(insId, userId, username, elo, points, wins, draws, losses) {
    document.getElementById('stats-player-name').innerHTML = `<i class="fa-solid fa-user-astronaut"></i> ${username}`;
    document.getElementById('stats-player-elo').textContent = elo || 'N/A';
    document.getElementById('stats-player-points').textContent = points || '0.0';
    
    document.getElementById('stats-player-wins').textContent = wins || 0;
    document.getElementById('stats-player-draws').textContent = draws || 0;
    document.getElementById('stats-player-losses').textContent = losses || 0;
    
    openModal('player-stats-modal');
}

window.logout = function() {
    localStorage.removeItem('currentUser');
    location.reload(); // Refresh to clear all state and show login
};

window.startTournament = async function(tId) {
    await API.startTorneo(tId);
    renderDashboard();
    renderTournamentDetail(tId);
};

window.deleteTournament = async function(tId) {
    if(!confirm('¿Estás seguro de que deseas eliminar este torneo? Esta acción no se puede deshacer.')) return;
    try {
        await API.deleteTorneo(tId);
        showView('dashboard-view');
        renderDashboard();
    } catch (e) {
        alert("Error al eliminar el torneo.");
    }
};

window.finishTournament = async function(tId) {
    if(!confirm('¿Estás seguro de que deseas finalizar este torneo? Los resultados serán definitivos.')) return;
    try {
        const response = await fetch(`${API_BASE}/torneos/${tId}/finalizar`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            alert("Torneo finalizado con éxito.");
            renderDashboard();
            renderTournamentDetail(tId);
        } else {
            const errorData = await response.json().catch(() => ({}));
            alert("Error del servidor: " + (errorData.message || "No se pudo finalizar el torneo."));
        }
    } catch (e) {
        console.error("Error finishTournament:", e);
        alert("Error de red: no se pudo contactar con el servidor.");
    }
};

// Simplified result handling for the new API
window.handleResultChange = async function(partidaId, value, tId) {
    if(!value) return; 
    await fetch(`${window.API_BASE}/partidas/${partidaId}/resultado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado: value })
    });
    renderTournamentDetail(tId);
};

function renderRounds(partidas, estado, tId) {
    const container = document.getElementById('rounds-container');
    container.innerHTML = '';
    
    if(partidas.length === 0) {
        container.style.border = "none";
        container.innerHTML = '<div style="text-align:center; padding: 3rem; background: var(--surface-card); border-radius:var(--radius-soft);"><i class="fa-solid fa-chess-board" style="font-size:3rem; color:var(--accent-light); margin-bottom:1rem;"></i><p>Aún no hay emparejamientos.</p></div>';
        return;
    }
    container.style.border = "1px solid var(--accent-light)";

    // Group by round
    const roundsMap = {};
    partidas.forEach(p => {
        if(!roundsMap[p.rondaNumero]) roundsMap[p.rondaNumero] = [];
        roundsMap[p.rondaNumero].push(p);
    });

    Object.keys(roundsMap).forEach(rNum => {
        const round = roundsMap[rNum];
        const rHeader = document.createElement('div');
        rHeader.className = 'pairing-header';
        rHeader.textContent = `Lista de Partidas - Ronda ${rNum}`;
        container.appendChild(rHeader);
        
        round.forEach((match, mIndex) => {
            const row = document.createElement('div');
            row.className = 'pairing-row';
            
            const isBye = match.resultado === 'BYE';
            if(isBye) {
                row.innerHTML = `<div class="col-table">-</div><div class="col-white" style="justify-content:center; flex:3;">${match.blancas.username} descansa en esta ronda.</div>`;
            } else {
                let controlsHost = '';
                if(estado === 'EN_CURSO') {
                    controlsHost = `
                        <select class="result-select" onchange="handleResultChange('${match.id}', this.value, '${tId}')">
                            <option value="P" ${match.resultado === 'P' ? 'selected' : ''}>[ - - - ]</option>
                            <option value="1-0" ${match.resultado === '1-0' ? 'selected' : ''}>1 - 0</option>
                            <option value="0-1" ${match.resultado === '0-1' ? 'selected' : ''}>0 - 1</option>
                            <option value="0.5-0.5" ${match.resultado === '0.5-0.5' ? 'selected' : ''}>½ - ½</option>
                        </select>
                    `;
                } else {
                    controlsHost = `<span style="font-weight:bold; font-size:1.1rem; border:1px solid var(--accent-color); padding:0.4rem 1rem; border-radius:4px;">${match.resultado === 'P' ? 'N/A' : match.resultado}</span>`;
                }

                row.innerHTML = `
                    <div class="col-table">Mesa ${mIndex + 1}</div>
                    <div class="col-white">
                        ${match.blancas.username}
                        <span class="elo-small">${match.blancas.eloRating}</span>
                        <i class="fa-regular fa-chess-pawn"></i>
                    </div>
                    <div class="col-vs">VS</div>
                    <div class="col-black">
                        <i class="fa-solid fa-chess-pawn"></i>
                        <span class="elo-small">${match.negras ? match.negras.eloRating : 'N/A'}</span>
                        ${match.negras ? match.negras.username : 'BYE'}
                    </div>
                    <div class="col-result">${controlsHost}</div>
                `;
            }
            container.appendChild(row);
        });
    });
}

function renderStandings(inscripciones, estado) {
    const tbody = document.querySelector('#standings-table tbody');
    tbody.innerHTML = '';
    if(estado === 'PENDIENTE') { tbody.innerHTML = '<tr><td colspan="5" class="text-center">El torneo no ha iniciado.</td></tr>'; return;}
    
    const sortedInscripciones = [...inscripciones].sort((a, b) => b.puntosAcumulados - a.puntosAcumulados);
    
    sortedInscripciones.forEach((ins, index) => {
        const row = document.createElement('tr');
        let posCell = `<td>${index + 1}</td>`;
        if(index === 0) posCell = `<td><i class="fa-solid fa-medal" style="color:#FFD700; font-size:1.2rem;"></i></td>`;
        
        row.innerHTML = `
            ${posCell}
            <td style="font-weight:600; color:var(--primary-color)">${ins.usuario.username}</td>
            <td style="font-weight:bold; font-size:1.2rem; color:var(--accent-color)">${ins.puntosAcumulados || 0.0}</td>
            <td>${ins.partidasJugadas || 0}</td>
            <td>${ins.victorias || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

window.openEditTournamentModal = function(t) {
    document.getElementById('edit-t-id').value = t.id;
    document.getElementById('edit-t-name').value = t.nombre;
    document.getElementById('edit-t-location').value = t.ubicacion || '';
    document.getElementById('edit-t-desc').value = t.descripcion || '';
    openModal('edit-tournament-modal');
};

async function renderUsers() {
    const res = await fetch(`${window.API_BASE}/usuarios`);
    const users = await res.json();
    const tbody = document.querySelector('#global-users-table tbody');
    tbody.innerHTML = '';
    
    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${u.username}</strong></td>
            <td>${u.email}</td>
            <td><input type="number" value="${u.eloRating}" class="form-control" style="width:80px" onchange="updateUserElo(${u.id}, this.value)"></td>
            <td><span class="status-badge ${u.role === 'ADMIN' ? 'status-active' : ''}">${u.role}</span></td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateUserElo = async function(id, elo) {
    await fetch(`http://localhost:8080/api/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eloRating: elo })
    });
    alert("ELO actualizado con éxito");
    renderUsers();
};

window.deleteUser = async function(id) {
    if(!confirm('¿Estás seguro de eliminar a este usuario del sistema?')) return;
    await fetch(`${window.API_BASE}/usuarios/${id}`, { method: 'DELETE' });
    renderUsers();
};
