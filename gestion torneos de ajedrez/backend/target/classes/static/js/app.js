/**
 * app.js - REFACTORED FOR CLIENT-SERVER ARCHITECTURE
 * Consumes Java Spring Boot API (H2 Database)
 */

let currentTournamentId = null;

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initModals();
    initForms();
    renderDashboard();
    renderTournamentList();
});

function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            showView(target);
            if(target === 'dashboard-view') renderDashboard();
            if(target === 'tournaments-view') renderTournamentList();
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
        }
    });

    document.getElementById('form-add-player').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentTournamentId) return;
        const nombre = document.getElementById('form-p-name').value;
        const elo = document.getElementById('form-p-elo').value;
        
        // Custom API method added to api.js (I need to make sure it matches the new controller)
        await fetch(`http://localhost:8080/api/torneos/${currentTournamentId}/inscripciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, elo: elo || 1200 })
        });

        document.getElementById('form-p-name').value = '';
        document.getElementById('form-p-elo').value = '';
        closeModal('add-player-modal');
        renderTournamentDetail(currentTournamentId);
    });
}

async function renderDashboard() {
    const tournaments = await API.getTorneos();
    
    // Stats
    const activeT = tournaments.filter(t => t.estado === 'EN_CURSO').length;
    document.getElementById('stat-active-tournaments').textContent = activeT;
    
    // For large stats, we'd need more specific endpoints, but for now we calculate
    let totalP = 0;
    // Note: To get total players efficiently we'd need a backend count, 
    // but for the demo we'll just sum what we have or set a placeholder
    document.getElementById('stat-total-players').textContent = "...";
    document.getElementById('stat-active-matches').textContent = "...";

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
    const inscripciones = await (await fetch(`http://localhost:8080/api/torneos/${id}/inscripciones`)).json();

    const btnGenRounds = document.getElementById('btn-generate-rounds');
    if(t.estado === 'PENDIENTE' && inscripciones.length >= 2) {
        btnGenRounds.classList.remove('hidden');
    } else {
        btnGenRounds.classList.add('hidden');
    }

    const actionsContainer = document.getElementById('detail-t-actions');
    actionsContainer.innerHTML = '';
    if(t.estado === 'PENDIENTE') {
        document.getElementById('btn-add-player').style.display = 'inline-flex';
    } else if (t.estado === 'EN_CURSO') {
        const btnFinish = document.createElement('button');
        btnFinish.className = 'btn btn-primary';
        btnFinish.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Concluir Torneo';
        btnFinish.onclick = () => finishTournament(t.id);
        actionsContainer.appendChild(btnFinish);
        document.getElementById('btn-add-player').style.display = 'none';
    } else {
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
    if(inscripciones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay jugadores</td></tr>'; return;
    }
    inscripciones.forEach(ins => {
        const p = ins.usuario;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; color:var(--primary-color)">${p.username}</td>
            <td><span class="elo-tag" style="background:var(--accent-light); color:var(--primary-color)">${p.eloRating}</span></td>
            <td>${estado === 'PENDIENTE' ? `<button class="btn btn-danger" onclick="removeInscripcion('${ins.id}')"><i class="fa-solid fa-trash"></i></button>` : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.startTournament = async function(tId) {
    await API.startTorneo(tId);
    renderDashboard();
    renderTournamentDetail(tId);
};

// Simplified result handling for the new API
window.handleResultChange = async function(partidaId, value, tId) {
    if(!value) return; 
    await fetch(`http://localhost:8080/api/partidas/${partidaId}/resultado`, {
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
            <td style="font-weight:bold; font-size:1.2rem; color:var(--accent-color)">${ins.puntosAcumulados}</td>
            <td>${ins.partidasJugadas}</td>
            <td>-</td>
        `;
        tbody.appendChild(row);
    });
}
