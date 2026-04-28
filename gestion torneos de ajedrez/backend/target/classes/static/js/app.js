/**
 * app.js - REFACTORED FOR CLIENT-SERVER ARCHITECTURE
 * Consumes Java Spring Boot API (H2 Database)
 */

let currentTournamentId = null;
// API_BASE is declared in api.js globally

document.addEventListener('DOMContentLoaded', () => {
    // Global error handling for better debugging
    window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.error('Error: ' + msg + '\nScript: ' + url + '\nLine: ' + lineNo + '\nColumn: ' + columnNo + '\nStackTrace: ' + (error ? error.stack : ''));
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
            const recaptchaToken = grecaptcha.getResponse(0); // 0 es el primer widget (login)
            
            if(!recaptchaToken) {
                errorDiv.textContent = 'Por favor, marca la casilla "No soy un robot"';
                errorDiv.style.display = 'block';
                return;
            }
            
            const res = await API.login(user, pass, recaptchaToken);
            if (res && res.token) {
                localStorage.setItem('jwt_token', res.token);
                localStorage.setItem('currentUser', JSON.stringify(res.usuario));
                // Force check and UI update
                checkAuthStatus(); 
                connectWebSocket();
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
            const elo = parseInt(document.getElementById('reg-elo').value) || 1200;
            const recaptchaToken = grecaptcha.getResponse(1); // 1 es el segundo widget (register)
            
            if(!recaptchaToken) {
                errorDiv.textContent = 'Por favor, marca la casilla "No soy un robot"';
                errorDiv.style.display = 'block';
                return;
            }
            
            // All new registrations from management are ADMIN
            const res = await API.register(user, pass, email, 'ADMIN', elo, recaptchaToken); 
            
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

    const formCreate = document.getElementById('form-create-tournament');
    if (formCreate) {
        formCreate.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if(submitBtn.disabled) return;
            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';
            
            const nombre = document.getElementById('form-t-name').value;
            const t = await API.createTorneo({ nombre, descripcion: "Torneo de Ajedrez", sistemaJuego: "ROUND_ROBIN" });
            
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;

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
    }

    const formAddPlayer = document.getElementById('form-add-player');
    if (formAddPlayer) {
        formAddPlayer.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!currentTournamentId) return;
            
            const mode = document.getElementById('add-player-mode').value;
            let email = "";
            let pass = "";

            if (mode === 'existente') {
                const selectedVal = document.getElementById('form-p-select').value;
                if (!selectedVal) {
                    alert("Por favor seleccione un jugador.");
                    return;
                }
                const playerData = JSON.parse(selectedVal);
                nombre = playerData.nombre;
                elo = playerData.elo;
            } else {
                nombre = document.getElementById('form-p-name').value;
                email = document.getElementById('form-p-email').value;
                pass = "1234"; // Password default ya que no es necesaria en UI manual
                elo = parseInt(document.getElementById('form-p-elo').value) || 1200;
                
                const recaptchaToken = grecaptcha.getResponse(3);
                if (!nombre) {
                    alert("Por favor escribe el Nombre del usuario.");
                    return;
                }
                if(!recaptchaToken) {
                    alert('Por favor, marca la casilla "No soy un robot"');
                    return;
                }
                
                // Si el email está vacío, el backend lo generará o podemos mandarlo vacío
                const res = await fetchWithAuth(`${window.API_BASE}/torneos/${currentTournamentId}/inscripciones`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, elo, email, pass, recaptchaToken })
                });
                
                if (res.ok) {
                    closeModal('add-player-modal');
                    renderTournamentDetail(currentTournamentId);
                } else {
                    const err = await res.json().catch(() => ({ message: "Error desconocido" }));
                    alert("Error: " + (err.message || "No se pudo realizar la inscripción."));
                }
                return;
            }
            
            await fetchWithAuth(`${window.API_BASE}/torneos/${currentTournamentId}/inscripciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, elo })
            }).catch(err => {
                console.error("Error inscripciones:", err);
                alert("Error: no se pudo conectar con el servidor.");
            });
            
            closeModal('add-player-modal');
            renderTournamentDetail(currentTournamentId);
        });
    }

    const formCreatePlayer = document.getElementById('form-create-player');
    if (formCreatePlayer) {
        formCreatePlayer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('create-p-name').value;
            const email = document.getElementById('create-p-email').value;
            const password = document.getElementById('create-p-pass').value;
            const elo = parseInt(document.getElementById('create-p-elo').value) || 1200;
            
            const recaptchaToken = grecaptcha.getResponse(2);
            if(!recaptchaToken) {
                alert('Por favor, marca la casilla "No soy un robot"');
                return;
            }
            
            const res = await API.register(username, password, email, 'PLAYER', elo, recaptchaToken);
            if (res) {
                alert("Jugador creado exitosamente.");
                document.getElementById('form-create-player').reset();
                closeModal('create-player-modal');
                renderPlayersView();
            } else {
                alert("Error al crear jugador. Es posible que el nombre de usuario ya exista.");
            }
        });
    }

    const formEditElo = document.getElementById('form-edit-elo');
    if (formEditElo) {
        formEditElo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-elo-userid').value;
            const newElo = document.getElementById('edit-elo-input').value;
            await window.updateUserElo(id, parseInt(newElo));
            closeModal('edit-elo-modal');
        });
    }

    const formEdit = document.getElementById('form-edit-tournament');
    if (formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-t-id').value;
            const nombre = document.getElementById('edit-t-name').value;
            const ubicacion = document.getElementById('edit-t-location').value;
            const descripcion = document.getElementById('edit-t-desc').value;
            
            await fetchWithAuth(`${window.API_BASE}/torneos/${id}`, {
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


}

async function renderDashboard() {
    const tournaments = await API.getTorneos();
    
    // Stats
    const activeT = tournaments.filter(t => t.estado === 'EN_CURSO').length;
    document.getElementById('stat-active-tournaments').textContent = activeT;
    
    const users = await API.getUsuarios();
    const totalP = users.filter(u => u.role !== 'ADMIN').length;
    document.getElementById('stat-total-players').textContent = totalP;
    
    let activeM = 0;

    for (const t of tournaments) {
        try {
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
    const recent = [...tournaments].reverse().slice(0, 10);
    if(recent.length === 0) recentList.innerHTML = '<p class="text-muted">No hay torneos próximos.</p>';
    else recent.forEach(t => recentList.appendChild(createTournamentUIItem(t)));

    // Ranking Global
    renderGlobalRanking();
}

async function renderGlobalRanking() {
    const users = await API.getUsuarios();
    const tbody = document.querySelector('#global-ranking-table tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    // Ordenar por ELO descendente
    const sortedUsers = [...users].sort((a, b) => (b.eloRating || 0) - (a.eloRating || 0));
    
    sortedUsers.forEach((u, index) => {
        const tr = document.createElement('tr');
        // Asignar colores/estilos según posición
        let posStyle = '';
        if(index === 0) posStyle = 'color: #d4af37; font-weight: bold; font-size: 1.2rem;'; // Oro
        else if(index === 1) posStyle = 'color: #c0c0c0; font-weight: bold;'; // Plata
        else if(index === 2) posStyle = 'color: #cd7f32; font-weight: bold;'; // Bronce

        const roleIcon = u.role === 'ADMIN' ? '<i class="fa-solid fa-crown" title="Administrador" style="color:#d4af37; margin-right:5px;"></i>' : '<i class="fa-solid fa-chess-pawn" style="color:var(--text-muted); margin-right:5px;"></i>';
        const roleLabel = u.role === 'ADMIN' ? 'Admin' : 'Jugador';
        const displayName = u.username ? u.username : 'Usuario Desconocido';

        tr.innerHTML = `
            <td style="${posStyle}">#${index + 1}</td>
            <td style="font-weight:600;">${displayName}</td>
            <td>${roleIcon} ${roleLabel}</td>
            <td style="text-align: right; font-weight: 800; color: #8b5a2b; font-size: 1.1rem;">${u.eloRating || 1200}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function renderTournamentList() {
    const tList = await API.getTorneos();
    const lc = document.getElementById('all-tournaments-list');
    lc.innerHTML = '';
    
    let misTorneos = tList;
    
    if(!misTorneos || misTorneos.length === 0) {
        lc.innerHTML = '<p class="text-muted mt-4">Lista vacía. Crea un torneo para comenzar.</p>';
    } else {
        [...misTorneos].reverse().forEach(t => lc.appendChild(createTournamentUIItem(t)));
    }
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

window.openAddPlayerModal = async function(mode = 'existente') {
    const select = document.getElementById('form-p-select');
    select.innerHTML = '<option value="">Cargando jugadores...</option>';
    
    // Set title and mode
    const titleEl = document.getElementById('add-player-modal-title');
    if (mode === 'existente') {
        titleEl.textContent = 'Elegir de la Lista';
    } else {
        titleEl.textContent = 'Inscripción Manual';
    }
    
    window.togglePlayerTab(mode);
    openModal('add-player-modal');
    
    try {
        const users = await API.getUsuarios();
        const players = users.filter(u => u.role !== 'ADMIN'); // everyone not an admin is a player
        
        select.innerHTML = '<option value="">Seleccione un jugador</option>';
        players.forEach(p => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify({ nombre: p.username, elo: p.eloRating || 1200 });
            opt.textContent = `${p.username || 'Desconocido'} (ELO: ${p.eloRating || 1200})`;
            select.appendChild(opt);
        });
        
        if (players.length === 0) {
            select.innerHTML = '<option value="">No hay jugadores registrados</option>';
        }
    } catch (e) {
        select.innerHTML = '<option value="">Error al cargar</option>';
    }
};



window.togglePlayerTab = function(mode) {
    document.getElementById('add-player-mode').value = mode;
    document.getElementById('tab-btn-existente').classList.remove('active');
    document.getElementById('tab-btn-nuevo').classList.remove('active');
    document.getElementById('tab-existente-content').style.display = 'none';
    document.getElementById('tab-nuevo-content').style.display = 'none';
    
    document.getElementById('tab-btn-' + mode).classList.add('active');
    document.getElementById('tab-' + mode + '-content').style.display = 'block';
};

window.openEditEloModal = function(id, username, elo) {
    document.getElementById('edit-elo-userid').value = id;
    document.getElementById('edit-elo-username').textContent = username || 'Sin Nombre';
    document.getElementById('edit-elo-input').value = elo || 1200;
    openModal('edit-elo-modal');
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
    const inscRes = await fetchWithAuth(`${window.API_BASE}/torneos/${id}/inscripciones`);
    const inscripciones = await inscRes.json();

    const partidas = await API.getPartidas(id);

    const btnGenRounds = document.getElementById('btn-generate-rounds');
    btnGenRounds.classList.add('hidden'); // Ocultar por defecto

    if (t.sistemaJuego === 'SUIZO') {
        btnGenRounds.innerHTML = '<i class="fa-solid fa-bolt"></i> Generar Siguiente Ronda';
        if (t.estado === 'PENDIENTE' && inscripciones.length >= 2) {
            btnGenRounds.classList.remove('hidden');
        } else if (t.estado === 'EN_CURSO') {
            const pendingMatches = partidas.filter(p => p.resultado === 'P' || !p.resultado);
            if (pendingMatches.length === 0 && partidas.length > 0) {
                // Check if max rounds reached
                const maxRondas = inscripciones.length % 2 === 0 ? inscripciones.length - 1 : inscripciones.length;
                let currentMaxRound = 0;
                partidas.forEach(p => { if(p.rondaNumero > currentMaxRound) currentMaxRound = p.rondaNumero; });
                
                if (currentMaxRound < maxRondas) {
                    btnGenRounds.classList.remove('hidden');
                }
            }
        }
    } else {
        btnGenRounds.innerHTML = '<i class="fa-solid fa-bolt"></i> Generar Rondas Automáticamente';
        if(t.estado === 'PENDIENTE' && inscripciones.length >= 2) {
            btnGenRounds.classList.remove('hidden');
        }
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

        document.getElementById('btn-add-player-group').style.display = 'flex';
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
        document.getElementById('btn-add-player-group').style.display = 'none';
    } else {
        // FINALIZADO
        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'btn btn-danger';
        btnDelete.style.marginRight = '0.5rem';
        btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i> Eliminar Histórico';
        btnDelete.onclick = () => deleteTournament(t.id);
        actionsContainer.appendChild(btnDelete);
        
        document.getElementById('btn-add-player-group').style.display = 'none';
    }

    renderPlayers(inscripciones, t.estado);
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
    localStorage.removeItem('jwt_token');
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
        const response = await fetchWithAuth(`${window.API_BASE}/torneos/${tId}/finalizar`, { 
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
    await fetchWithAuth(`${window.API_BASE}/partidas/${partidaId}/resultado`, {
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
    if(estado === 'PENDIENTE') { tbody.innerHTML = '<tr><td colspan="6" class="text-center">El torneo no ha iniciado.</td></tr>'; return;}
    
    const sortedInscripciones = [...inscripciones].sort((a, b) => {
        if(b.puntosAcumulados !== a.puntosAcumulados) return b.puntosAcumulados - a.puntosAcumulados;
        if(b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
        return b.sonnebornBerger - a.sonnebornBerger;
    });
    
    sortedInscripciones.forEach((ins, index) => {
        const row = document.createElement('tr');
        
        // Estilo tipo Ranking Global
        let posStyle = '';
        let posContent = `#${index + 1}`;
        
        if(index === 0) { 
            posStyle = 'color: #d4af37; font-weight: bold; font-size: 1.2rem;'; 
            posContent = '<i class="fa-solid fa-medal" title="Oro"></i>';
        } else if(index === 1) { 
            posStyle = 'color: #c0c0c0; font-weight: bold;'; 
            posContent = '<i class="fa-solid fa-medal" title="Plata"></i>';
        } else if(index === 2) { 
            posStyle = 'color: #cd7f32; font-weight: bold;'; 
            posContent = '<i class="fa-solid fa-medal" title="Bronce"></i>';
        }

        row.innerHTML = `
            <td style="${posStyle}">${posContent}</td>
            <td style="font-weight:600; color:var(--primary-color)">${ins.usuario.username}</td>
            <td style="font-weight:bold; font-size:1.2rem; color:var(--accent-color)">${ins.puntosAcumulados || 0.0}</td>
            <td>${ins.buchholz || 0.0}</td>
            <td>${ins.sonnebornBerger || 0.0}</td>
            <td>${ins.partidasJugadas || 0}</td>
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
    const res = await fetchWithAuth(`${window.API_BASE}/usuarios`);
    const users = await res.json();
    const tbody = document.querySelector('#global-users-table tbody');
    tbody.innerHTML = '';
    
    // Solo mostrar administradores en esta vista
    const admins = users.filter(u => u.role === 'ADMIN');
    
    admins.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${u.username || 'Sin Nombre'}</strong></td>
            <td>${u.email || '-'}</td>
            <td>
                <span class="elo-tag" style="background:var(--accent-light); color:var(--primary-color); display:inline-block; margin-right:5px; width:45px; text-align:center;">${u.eloRating}</span>
                <button class="btn btn-secondary btn-sm" onclick="openEditEloModal(${u.id}, '${u.username || ''}', ${u.eloRating})" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-pen"></i></button>
            </td>
            <td><span class="status-badge status-active">${u.role}</span></td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function renderPlayersView() {
    const res = await fetchWithAuth(`${window.API_BASE}/usuarios`);
    const users = await res.json();
    const tbody = document.querySelector('#global-players-table tbody');
    tbody.innerHTML = '';
    
    // Solo mostrar jugadores
    const players = users.filter(u => u.role !== 'ADMIN');
    
    players.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${u.username || 'Sin Nombre'}</strong></td>
            <td>${u.email || '-'}</td>
            <td>
                <span class="elo-tag" style="background:var(--accent-light); color:var(--primary-color); display:inline-block; margin-right:5px; width:45px; text-align:center;">${u.eloRating}</span>
                <button class="btn btn-secondary btn-sm" onclick="openEditEloModal(${u.id}, '${u.username || ''}', ${u.eloRating})" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-pen"></i></button>
            </td>
            <td><span class="status-badge">${u.role || 'PLAYER'}</span></td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateUserElo = async function(id, elo) {
    if (elo < 0 || elo > 4000) {
        alert("Error: El ELO debe estar entre 0 y 4000.");
        return;
    }
    await fetchWithAuth(`${window.API_BASE}/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eloRating: elo })
    }).catch(e => alert("Error al actualizar ELO"));
    alert("ELO actualizado con éxito");
    renderUsers();
    renderPlayersView();
};

window.deleteUser = async function(id) {
    if(!confirm('¿Estás seguro de eliminar a este usuario del sistema?')) return;
    await fetchWithAuth(`${window.API_BASE}/usuarios/${id}`, { method: 'DELETE' });
    renderUsers();
};

// --- WebSockets & Notifications ---
let stompClient = null;

function connectWebSocket() {
    const socket = new SockJS('http://localhost:8080/ws-chess');
    stompClient = Stomp.over(socket);
    stompClient.debug = null; // Disable console spam

    stompClient.connect({}, function (frame) {
        console.log('WebSocket Conectado: ' + frame);
        stompClient.subscribe('/topic/notifications', function (notification) {
            showNotification(notification.body);
            // Si el admin está viendo el dashboard o detalle, refrescar
            if (document.getElementById('dashboard-view').classList.contains('active')) renderDashboard();
            if (document.getElementById('tournament-detail-view').classList.contains('active')) renderTournamentDetail(currentTournamentId);
        });
    }, function(error) {
        console.log('Error WebSocket, reintentando en 5s...');
        setTimeout(connectWebSocket, 5000);
    });
}

function showNotification(message) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'card';
    toast.style.cssText = `
        background: var(--primary-color);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: var(--shadow-heavy);
        display: flex;
        align-items: center;
        gap: 1rem;
        min-width: 300px;
        animation: slideIn 0.5s ease forwards;
        border-left: 5px solid var(--accent-color);
    `;
    
    toast.innerHTML = `
        <i class="fa-solid fa-bell" style="font-size: 1.5rem; color: var(--accent-color);"></i>
        <div>
            <strong style="display:block; font-size:0.9rem; opacity:0.8;">Aviso del Sistema</strong>
            <span>${message}</span>
        </div>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// Add animations for notifications if not in CSS
if (!document.getElementById('notif-styles')) {
    const style = document.createElement('style');
    style.id = 'notif-styles';
    style.innerHTML = `
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    `;
    document.head.appendChild(style);
}

// Initialize on load
if (localStorage.getItem('jwt_token')) {
    connectWebSocket();
}
