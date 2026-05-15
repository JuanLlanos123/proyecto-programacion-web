/**
 * app_v2.js - LOGICA MAESTRA (BANNER DE CAMPEÓN AL FINAL)
 */

window.currentTournamentId = null;
var currentTournamentId = null; // Para compatibilidad dual
var currentView = 'dashboard-view'; // Tracking de la vista activa

/**
 * Muestra una notificación tipo toast en la esquina superior derecha.
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - 'success' (por defecto) | 'error' | 'warning'
 */
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.warn('Notificación:', message);
        return;
    }
    const colors = {
        success: { bg: '#16a34a', icon: 'fa-circle-check' },
        error:   { bg: '#dc2626', icon: 'fa-circle-xmark' },
        warning: { bg: '#d97706', icon: 'fa-triangle-exclamation' }
    };
    const c = colors[type] || colors.success;
    const toast = document.createElement('div');
    toast.style.cssText = [
        `background: ${c.bg}`,
        'color: white',
        'padding: 12px 20px',
        'border-radius: 10px',
        'box-shadow: 0 4px 15px rgba(0,0,0,0.2)',
        'display: flex',
        'align-items: center',
        'gap: 10px',
        'font-weight: 600',
        'font-size: 0.9rem',
        'min-width: 280px',
        'max-width: 400px',
        'animation: slideInRight 0.3s ease',
        'cursor: pointer'
    ].join(';');
    toast.innerHTML = `<i class="fa-solid ${c.icon}"></i> ${message}`;
    toast.onclick = () => toast.remove();
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}
window.showNotification = showNotification;


document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded ejecutado');
    window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.error('Error: ' + msg + '\nScript: ' + url + '\nLine: ' + lineNo);
        alert('Error detectado: ' + msg + '\nEn línea: ' + lineNo);
        return false;
    };

    checkAuthStatus();
    initNavigation();
    initModals();
    initForms();
    initSearchFilters();
    initTheme();
    initFAB(); // Initialize FAB menu
    
    // Auto-load dashboard if logged in
    const user = localStorage.getItem('jwt_token');
    if (user) {
        showView('dashboard-view');
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }

    initAchievementManagement(); 
    if (typeof renderAchievements === 'function') renderAchievements(); 
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

window.exportFide = async function(id) {
    if(!id) return;
    const btn = event.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exportando...';
    const success = await API.exportFide(id);
    if(success) {
        alert("Archivo TRF generado con éxito.");
    } else {
        alert("Error al generar el reporte FIDE.");
    }
    btn.disabled = false;
    btn.innerHTML = originalHtml;
};

let html5QrScanner = null;

window.startQrScanner = function() {
    openModal('qr-scanner-modal');
    const resultsDiv = document.getElementById('qr-reader-results');
    resultsDiv.textContent = 'Buscando cámara...';
    resultsDiv.style.color = 'var(--text-muted)';

    html5QrScanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrScanner.start({ facingMode: "environment" }, config, async (decodedText) => {
        // Formato esperado: "CHESS_CHECKIN:TORNEO_ID:INS_ID"
        console.log("QR Scaneado:", decodedText);
        if (decodedText.startsWith("CHESS_CHECKIN:")) {
            const parts = decodedText.split(":");
            const tId = parts[1];
            const insId = parts[2];
            
            resultsDiv.textContent = "¡Código detectado! Procesando...";
            resultsDiv.style.color = "var(--win-color)";
            
            try {
                const res = await fetchWithAuth(`${window.API_BASE}/torneos/${tId}/inscripciones/${insId}/checkin`, { method: 'POST' });
                if (res.ok) {
                    resultsDiv.textContent = "✅ ASISTENCIA REGISTRADA";
                    playChessSound('move'); // Feedback auditivo
                    setTimeout(stopQrScanner, 2000);
                    if(window.currentTournamentId === tId) renderTournamentDetail(tId);
                } else {
                    resultsDiv.textContent = "❌ Error en registro";
                    resultsDiv.style.color = "var(--loss-color)";
                }
            } catch (e) {
                resultsDiv.textContent = "❌ Error de conexión";
            }
        } else {
            resultsDiv.textContent = "⚠️ Código no válido";
            resultsDiv.style.color = "#eab308";
        }
    });
};

window.stopQrScanner = function() {
    if (html5QrScanner) {
        html5QrScanner.stop().then(() => {
            html5QrScanner = null;
            closeModal('qr-scanner-modal');
        }).catch(() => {
            closeModal('qr-scanner-modal');
        });
    } else {
        closeModal('qr-scanner-modal');
    }
};

function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            // Show the view
            showView(target);

            // Trigger specific renders
            if(target === 'tournaments-view') renderTournamentList();
            if(target === 'users-view') renderUsers();
            if(target === 'players-view') renderPlayersView();
            if(target === 'teams-management-view') renderTeamsManagementView();
            if(target === 'ranking-view') renderGlobalRanking();
            if(target === 'compare-view') populateCompareSelects();
            if(target === 'analysis-view') setTimeout(initAnalysisBoard, 500);
            if(target === 'achievements-view') renderAchievements();
            
            // Cerrar sidebar en móvil al navegar
            if (window.innerWidth <= 768) {
                toggleSidebar();
            }
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

let compareChartInstance = null;

window.populateCompareSelects = async function() {
    const users = await API.getUsuarios();
    const players = users.filter(u => String(u.role).toUpperCase() !== 'ADMIN');
    const s1 = document.getElementById('compare-p1');
    const s2 = document.getElementById('compare-p2');
    
    if (s1 && s2) {
        const options = '<option value="">Seleccionar jugador...</option>' + 
            players.map(u => `<option value="${u.id}">${u.username} (${u.eloRating})</option>`).join('');
        s1.innerHTML = options;
        s2.innerHTML = options;
    }
};

window.runComparison = async function() {
    const u1 = document.getElementById('compare-p1').value;
    const u2 = document.getElementById('compare-p2').value;
    const results = document.getElementById('compare-results');

    if (!u1 || !u2 || u1 === u2) {
        results.style.display = 'none';
        return;
    }

    const data = await fetchWithAuth(`${window.API_BASE}/usuarios/compare?u1=${u1}&u2=${u2}`).then(r => r.json());
    results.style.display = 'block';

    // Stats
    let w1 = 0, w2 = 0, d = 0;
    data.matches.forEach(p => {
        const isWhite1 = p.blancas && String(p.blancas.id) === String(u1);
        if (p.resultado === '1-0') isWhite1 ? w1++ : w2++;
        else if (p.resultado === '0-1') isWhite1 ? w2++ : w1++;
        else d++;
    });

    document.getElementById('compare-w1').textContent = w1;
    document.getElementById('compare-w2').textContent = w2;
    document.getElementById('compare-draws').textContent = d;
    document.getElementById('compare-n1').textContent = data.user1.username;
    document.getElementById('compare-n2').textContent = data.user2.username;

    // Win Rate Bar
    const total = Math.max(w1 + w2 + d, 1);
    document.getElementById('bar-p1').style.width = (w1 / total * 100) + '%';
    document.getElementById('bar-p2').style.width = (w2 / total * 100) + '%';
    document.getElementById('bar-draw').style.width = (d / total * 100) + '%';

    // Matches Table
    const tbody = document.querySelector('#compare-matches-table tbody');
    tbody.innerHTML = data.matches.map(p => `
        <tr>
            <td>${p.torneo ? p.torneo.nombre : 'Amistoso'}</td>
            <td style="font-weight:bold;">${p.resultado}</td>
        </tr>
    `).join('');

    renderCompareChart(data.history1, data.history2, data.user1.username, data.user2.username);
    renderStyleRadar(data.user1, data.user2, data.matches);
};

let styleRadarInstance = null;
function renderStyleRadar(u1, u2, matches) {
    const canvas = document.getElementById('styleRadarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (styleRadarInstance) styleRadarInstance.destroy();

    const getStats = (user, matches) => {
        const uMatches = matches.filter(m => (m.blancas && m.blancas.id === user.id) || (m.negras && m.negras.id === user.id));
        const total = uMatches.length || 1;
        const wins = uMatches.filter(m => (m.blancas?.id === user.id && m.resultado === '1-0') || (m.negras?.id === user.id && m.resultado === '0-1')).length;
        const draws = uMatches.filter(m => m.resultado === '0.5-0.5').length;
        
        // Solidness: 0 to 100
        const solidness = Math.min(100, (draws / total * 200) + 40); 
        // Aggression: Win rate as white
        const whiteWins = uMatches.filter(m => m.blancas?.id === user.id && m.resultado === '1-0').length;
        const aggression = Math.min(100, (whiteWins / Math.max(uMatches.filter(m => m.blancas?.id === user.id).length, 1) * 100) + 20);
        // Precision: Based on ELO
        const precision = Math.min(95, (user.eloRating / 30) + 20);
        // Form: Wins in last 5 matches
        const last5 = uMatches.slice(-5);
        const form = (last5.filter(m => (m.blancas?.id === user.id && m.resultado === '1-0') || (m.negras?.id === user.id && m.resultado === '0-1')).length / 5) * 100;
        // Experience
        const experience = Math.min(100, total * 5);

        return [solidness, aggression, precision, form, experience];
    };

    const s1 = getStats(u1, matches);
    const s2 = getStats(u2, matches);

    // Update Text Insights
    const solidText = s1[0] > s2[0] ? `${u1.username} es más sólido defensivamente.` : `${u2.username} tiene una defensa más férrea.`;
    const aggrText = s1[1] > s2[1] ? `${u1.username} busca más la iniciativa desde la apertura.` : `${u2.username} es más agresivo con piezas blancas.`;
    const formText = s1[3] > s2[3] ? `${u1.username} llega en mejor racha ganadora.` : `${u2.username} está en mejor forma competitiva.`;
    
    document.getElementById('solidness-text').textContent = solidText;
    document.getElementById('aggression-text').textContent = aggrText;
    document.getElementById('form-text').textContent = formText;

    styleRadarInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Solidez', 'Agresividad', 'Precisión', 'Forma', 'Experiencia'],
            datasets: [
                {
                    label: u1.username,
                    data: s1,
                    backgroundColor: 'rgba(139, 90, 43, 0.2)',
                    borderColor: '#8b5a2b',
                    pointBackgroundColor: '#8b5a2b'
                },
                {
                    label: u2.username,
                    data: s2,
                    backgroundColor: 'rgba(22, 163, 74, 0.2)',
                    borderColor: '#16a34a',
                    pointBackgroundColor: '#16a34a'
                }
            ]
        },
        options: {
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { display: false }
                }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
}

function renderCompareChart(h1, h2, n1, n2) {
    const canvas = document.getElementById('compareEloChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (compareChartInstance) compareChartInstance.destroy();

    const allDates = [...new Set([...h1, ...h2].map(h => new Date(h.fecha).toLocaleDateString()))].sort((a,b) => new Date(a) - new Date(b));

    const getEloAt = (history, dateStr) => {
        const entry = history.find(h => new Date(h.fecha).toLocaleDateString() === dateStr);
        return entry ? entry.elo : null;
    };

    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#f0eade' : '#2D2C2A';
    const gridColor = isDark ? '#2d1f1a' : '#f1f5f9';

    compareChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allDates,
            datasets: [
                {
                    label: n1,
                    data: allDates.map(d => getEloAt(h1, d)),
                    borderColor: '#8b5a2b',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    tension: 0.3,
                    spanGaps: true
                },
                {
                    label: n2,
                    data: allDates.map(d => getEloAt(h2, d)),
                    borderColor: '#16a34a',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    tension: 0.3,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: textColor } } },
            scales: {
                y: { grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
}


window.showView = function(viewId) {
    console.log('Mostrando vista:', viewId);
    if (!localStorage.getItem('currentUser') && viewId !== 'login-view') {
        document.getElementById('login-overlay').style.display = 'flex';
        return;
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (!target) {
        console.error('Vista no encontrada:', viewId);
        return;
    }

    target.classList.add('active');
    currentView = viewId; // <- Track current view

    // Scroll main content to top
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;

    // Trigger renders for specific views
    if (viewId === 'dashboard-view') {
        console.log('showView rendering Dashboard');
        renderDashboard();
    }
    if (viewId === 'achievements-view') renderAchievements();
    if (viewId === 'analysis-view') {
        if (typeof initAnalysisBoard === 'function') initAnalysisBoard();
        if (typeof renderSavedAnalysisList === 'function') renderSavedAnalysisList();
    }
    if (viewId === 'teams-management-view') {
        renderTeamsManagementView();
    }
};

window.openModal = function(modalId) { 
    console.log('Opening modal:', modalId);
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error('Modal not found:', modalId);
        return;
    }
    
    // Refresh player list if opening team modal
    if (modalId === 'create-team-modal') {
        refreshTeamPlayerList();
    }
    
    modal.classList.add('active'); 
    document.body.style.overflow = 'hidden'; // Prevent scroll
};

async function refreshTeamPlayerList() {
    const checkboxContainer = document.getElementById('team-player-checkboxes');
    if (!checkboxContainer) return;
    
    checkboxContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--accent-color);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><small>Cargando jugadores...</small></div>';
    
    try {
        const users = await API.getUsuarios();
        const players = users.filter(u => String(u.role).toUpperCase() !== 'ADMIN');
        
        // Sort: Free agents first
        players.sort((a, b) => {
            if (!a.nombreEquipo && b.nombreEquipo) return -1;
            if (a.nombreEquipo && !b.nombreEquipo) return 1;
            return a.username.localeCompare(b.username);
        });

        // Extract existing teams for the dropdown
        const teamSelect = document.getElementById('select-existing-team');
        if (teamSelect) {
            const teamNames = [...new Set(players.filter(p => p.nombreEquipo).map(p => p.nombreEquipo))].sort();
            teamSelect.innerHTML = '<option value="">-- Nuevo Equipo --</option>' + 
                teamNames.map(t => `<option value="${t}">${t}</option>`).join('');
            
            teamSelect.onchange = (e) => {
                const input = document.getElementById('form-team-name');
                if (input) {
                    input.value = e.target.value;
                    input.disabled = !!e.target.value;
                }
            };
        }

        checkboxContainer.innerHTML = players.map(p => `
            <label style="display: flex; align-items: center; gap: 12px; padding: 10px; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.05); transition: background 0.2s;" class="player-checkbox-item">
                <input type="checkbox" name="team-players" value="${p.id}" style="width: 20px; height: 20px; accent-color: var(--accent-color);">
                <div style="display:flex; flex-direction:column; flex:1;">
                    <span style="font-size: 0.95rem; font-weight:700; color:var(--text-main);">${p.username}</span>
                    <span style="font-size: 0.8rem; color: ${p.nombreEquipo ? 'var(--accent-color)' : 'var(--text-muted)'};">
                        <i class="fa-solid ${p.nombreEquipo ? 'fa-users' : 'fa-user-slash'}"></i> 
                        ${p.nombreEquipo || 'Agente Libre'} • ELO: ${p.eloRating}
                    </span>
                </div>
            </label>
        `).join('') || '<div style="color: var(--text-muted); text-align: center; padding:30px;">No hay jugadores para asignar</div>';
    } catch (err) {
        console.error('Error refreshTeamPlayerList:', err);
        checkboxContainer.innerHTML = '<div style="color: red; text-align: center; padding:20px;">Error al cargar jugadores.</div>';
    }
}

window.closeModal = function(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active'); 
    document.body.style.overflow = ''; // Restore scroll
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
};

window.toggleSidebarCollapse = function() {
    const sidebar = document.getElementById('main-sidebar');
    const icon = document.getElementById('collapse-icon');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    if (icon) icon.className = isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
    const btn = document.getElementById('sidebar-collapse-btn');
    if (btn) btn.title = isCollapsed ? 'Mostrar menú' : 'Ocultar menú';
};

window.toggleFab = function() {
    const main = document.getElementById('fab-main');
    const options = document.getElementById('fab-options');
    if (main) main.classList.toggle('active');
    if (options) options.classList.toggle('active');
};

window.renderAchievements = function() {
    console.log('Iniciando render de logros...');
    const list = document.getElementById('full-achievements-list');
    if (!list) {
        console.error('No se encontró el contenedor full-achievements-list');
        return;
    }
    
    const allAchievements = [
        // --- HITOS DE ELO ---
        { name: "Aspirante",          desc: "Alcanza un ELO de 1400",            icon: "fa-solid fa-chess-knight",    category: "ELO",        color: "#94a3b8" },
        { name: "Estratega",          desc: "Alcanza un ELO de 1600",            icon: "fa-solid fa-chess-bishop",    category: "ELO",        color: "#64748b" },
        { name: "Maestro Local",       desc: "Alcanza un ELO de 1800",            icon: "fa-solid fa-chess-rook",      category: "ELO",        color: "#475569" },
        { name: "Candidato a Maestro", desc: "Alcanza un ELO de 2000",            icon: "fa-solid fa-chess-queen",     category: "ELO",        color: "#7c3aed" },
        { name: "Gran Maestro GM",     desc: "Alcanza un ELO de 2300",            icon: "fa-solid fa-crown",           category: "ELO",        color: "#d97706" },
        { name: "Super GM",           desc: "Alcanza un ELO de 2600",            icon: "fa-solid fa-gem",             category: "ELO",        color: "#be185d" },

        // --- EXPERIENCIA (Partidas) ---
        { name: "Iniciado",           desc: "Juega 10 partidas totales",         icon: "fa-solid fa-pawn",            category: "Partidas",   color: "#10b981" },
        { name: "Veterano",           desc: "Juega 50 partidas totales",         icon: "fa-solid fa-shield-halved",   category: "Partidas",   color: "#059669" },
        { name: "Guerrero del Tablero",desc: "Juega 100 partidas totales",        icon: "fa-solid fa-swords",          category: "Partidas",   color: "#047857" },
        { name: "Incansable",         desc: "Juega 250 partidas totales",        icon: "fa-solid fa-hourglass-half",   category: "Partidas",   color: "#065f46" },
        { name: "Leyenda Activa",     desc: "Juega 500 partidas totales",        icon: "fa-solid fa-infinity",        category: "Partidas",   color: "#064e3b" },

        // --- GLORIA (Torneos Ganados) ---
        { name: "Primera Victoria",    desc: "Gana tu primer torneo",             icon: "fa-solid fa-trophy",          category: "Torneos",    color: "#fbbf24" },
        { name: "Triunfador",         desc: "Gana 3 torneos en total",           icon: "fa-solid fa-award",           category: "Torneos",    color: "#f59e0b" },
        { name: "Coleccionista de Oro",desc: "Gana 5 torneos en total",           icon: "fa-solid fa-medal",           category: "Torneos",    color: "#d97706" },
        { name: "Dominador Absoluto",  desc: "Gana 10 torneos en total",          icon: "fa-solid fa-ranking-star",    category: "Torneos",    color: "#92400e" },
        { name: "Inmortal",           desc: "Gana 25 torneos en total",          icon: "fa-solid fa-mountain",        category: "Torneos",    color: "#451a03" }
    ];

    list.innerHTML = allAchievements.map(a => `
        <div class="card achievement-card-main" style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:12px; padding:1.5rem; border-top: 4px solid ${a.color}; background: var(--surface-card); box-shadow: var(--shadow-card); transition: transform 0.3s ease; border-radius: 12px;">
            <div style="background:${a.color}20; color:${a.color}; width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.8rem; flex-shrink:0; border: 2px solid ${a.color}40;">
                <i class="${a.icon}"></i>
            </div>
            <div style="flex:1;">
                <h4 style="margin:0 0 6px; font-size:1.1rem; color:var(--text-main); font-weight:700;">${a.name}</h4>
                <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.5; margin:0;">${a.desc}</p>
            </div>
            <span style="font-size:0.75rem; font-weight:800; letter-spacing:1px; color:${a.color}; background:${a.color}15; padding:4px 14px; border-radius:20px; text-transform: uppercase;">${a.category}</span>
        </div>
    `).join('');
};

let eloChartInstance = null;

window.showPlayerStats = async function(userId) {
    const data = await API.getUsuarioStats(userId);
    if (!data) return;

    document.getElementById('stat-player-name-new').textContent = data.usuario.username;
    document.getElementById('stat-player-email').textContent = data.usuario.email;
    document.getElementById('stat-nemesis').textContent = data.nemesis || 'Ninguno';

    // Calcular victorias/tablas/derrotas
    let wins = 0, draws = 0, losses = 0;
    data.partidas.forEach(p => {
        const isWhite = p.blancas && p.blancas.id === userId;
        if (p.resultado === '1-0') isWhite ? wins++ : losses++;
        else if (p.resultado === '0-1') isWhite ? losses++ : wins++;
        else if (p.resultado === '0.5-0.5') draws++;
    });

    document.getElementById('stat-win').textContent = wins;
    document.getElementById('stat-draw').textContent = draws;
    document.getElementById('stat-loss').textContent = losses;

    const tbody = document.querySelector('#stat-matches-table tbody');
    tbody.innerHTML = data.partidas.map(p => {
        const isWhite = p.blancas && p.blancas.id === userId;
        const opponent = isWhite ? (p.negras ? p.negras.username : 'BYE') : (p.blancas ? p.blancas.username : 'BYE');
        let resClass = 'text-muted';
        let resText = p.resultado;
        if ((isWhite && p.resultado === '1-0') || (!isWhite && p.resultado === '0-1')) resClass = 'text-win';
        else if ((isWhite && p.resultado === '0-1') || (!isWhite && p.resultado === '1-0')) resClass = 'text-loss';

        return `<tr>
            <td style="padding:8px;">${p.torneo ? p.torneo.nombre : '---'}</td>
            <td>${opponent}</td>
            <td class="${resClass}" style="font-weight:bold;">${resText}</td>
            <td>${p.rondaNumero || 1}</td>
        </tr>`;
    }).join('');

    renderEloChart(data.eloHistory);

    // Renderizar Trofeos
    const trophyContainer = document.getElementById('stat-trophies-container');
    if (trophyContainer) {
        trophyContainer.innerHTML = '';
        if (data.trofeos && data.trofeos.length > 0) {
            data.trofeos.forEach(t => {
                const medal = t.rank == '1' ? '🥇' : (t.rank == '2' ? '🥈' : '🥉');
                const color = t.rank == '1' ? '#fbbf24' : (t.rank == '2' ? '#94a3b8' : '#b45309');
                const label = t.rank == '1' ? 'Campeón' : (t.rank == '2' ? 'Subcampeón' : '3er Lugar');
                
                const div = document.createElement('div');
                div.style = `background: var(--surface-card); border: 1.5px solid ${color}; padding: 8px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);`;
                div.innerHTML = `<span>${medal}</span> <div style="display:flex; flex-direction:column;"><strong style="color:${color}">${label}</strong><small style="font-size:0.7rem; color:var(--text-muted);">${t.torneo || 'Torneo'}</small></div>`;
                trophyContainer.appendChild(div);
            });
            document.getElementById('trophy-section').style.display = 'block';
        } else {
            trophyContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">Aún no ha ganado trofeos.</div>';
        }
    }

    // Renderizar Logros
    const achievementContainer = document.getElementById('stat-achievements-container');
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isAdmin = String(user.role).toUpperCase() === 'ADMIN';

    // Mostrar botón de otorgar logro solo a admins
    const btnGrant = document.getElementById('btn-open-grant-achievement');
    if (btnGrant) {
        btnGrant.style.display = isAdmin ? 'block' : 'none';
        btnGrant.onclick = () => {
            document.getElementById('grant-achievement-userid').value = userId;
            openModal('grant-achievement-modal');
        };
    }

    if (achievementContainer) {
        achievementContainer.innerHTML = '';
        if (data.logros && data.logros.length > 0) {
            data.logros.forEach(logro => {
                const div = document.createElement('div');
                div.className = 'achievement-badge';
                div.style = `background: var(--surface-card); border: 1.5px solid var(--primary-color); padding: 8px 12px; border-radius: 12px; display: flex; align-items: center; gap: 10px; font-size: 0.85rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); position:relative;`;
                div.title = logro.description;
                
                let deleteHtml = '';
                if (isAdmin) {
                    deleteHtml = `<button onclick="confirmDeleteAchievement(${logro.id}, ${userId})" style="position:absolute; top:-8px; right:-8px; background:#dc2626; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.2);">&times;</button>`;
                }

                div.innerHTML = `
                    <i class="${logro.icon}" style="color:var(--primary-color); font-size:1.1rem;"></i> 
                    <strong>${logro.name}</strong>
                    ${deleteHtml}
                `;
                achievementContainer.appendChild(div);
            });
            document.getElementById('achievement-section').style.display = 'block';
        } else {
            achievementContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">Aún no ha desbloqueado insignias.</div>';
        }
    }

    // Renderizar gráfico de ELO
    renderEloChart(data.partidas.map(p => ({
        fecha: p.fecha,
        elo: p.nuevoElo || 1200
    })));

    openModal('player-stats-modal');
}

function renderEloChart(history) {
    const canvas = document.getElementById('eloChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (eloChartInstance) eloChartInstance.destroy();

    // Si no hay historial, mostrar un punto base
    const dataPoints = history.length > 0 ? history.map(h => h.elo) : [1200];
    const labels = history.length > 0 ? history.map((_, i) => `Juego ${i + 1}`) : ['Inicio'];

    eloChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Variación de ELO',
                data: dataPoints,
                borderColor: '#8d6e63',
                backgroundColor: 'rgba(141, 110, 99, 0.1)',
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#5d4037',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(45, 44, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff'
                }
            },
            scales: {
                y: { 
                    beginAtZero: false, 
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { font: { weight: 'bold' } }
                },
                x: { 
                    grid: { display: false } 
                }
            }
        }
    });
}

function initSearchFilters() {
    const searchT = document.getElementById('search-tournaments');
    const filterSys = document.getElementById('filter-system');
    const filterStatus = document.getElementById('filter-status');

    if (searchT) searchT.addEventListener('input', () => renderTournamentList());
    if (filterSys) filterSys.addEventListener('change', () => renderTournamentList());
    if (filterStatus) filterStatus.addEventListener('change', () => renderTournamentList());

    const searchU = document.getElementById('search-users');
    if (searchU) searchU.addEventListener('input', () => renderUsers());

    const searchP = document.getElementById('search-players');
    if (searchP) searchP.addEventListener('input', () => renderPlayersView());
}

function initModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    });
}

window.toggleAuthMode = function() {
    const login = document.getElementById('form-login');
    const register = document.getElementById('form-register');
    const btn = document.getElementById('toggle-auth-mode');
    
    if (!login || !register || !btn) {
        console.error('Toggle elements not found');
        return;
    }

    const isLoginHidden = login.style.display === 'none';
    
    if (isLoginHidden) {
        // Show login
        login.style.display = 'block';
        register.style.display = 'none';
        btn.innerHTML = '¿No tienes cuenta? <b>Regístrate</b>';
    } else {
        // Show register
        login.style.display = 'none';
        register.style.display = 'block';
        btn.innerHTML = '¿Ya tienes cuenta? <b>Inicia sesión</b>';
    }
};

function initForms() {
    console.log('initForms() ejecutado');
    const errorDiv = document.getElementById('login-error');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const formAddPlayer = document.getElementById('form-add-player');
    const formCreatePlayer = document.getElementById('form-create-player');
    
    // Also init team players checkbox list in team modal
    API.getUsuarios().then(users => {
        const players = users.filter(u => String(u.role).toUpperCase() !== 'ADMIN');
        const checkboxContainer = document.getElementById('team-player-checkboxes');
        if(checkboxContainer) {
            checkboxContainer.innerHTML = players.map(p => `
                <label style="display: flex; align-items: center; gap: 10px; padding: 5px; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <input type="checkbox" name="team-players" value="${p.id}" style="width: 18px; height: 18px;">
                    <span style="font-size: 0.9rem;">${p.username} <small style="color: var(--text-muted);">(${p.nombreEquipo || 'Sin Equipo'})</small></span>
                </label>
            `).join('') || '<div style="color: var(--text-muted); text-align: center;">No hay jugadores disponibles</div>';
        }
    });

    // PGN Input Listener for manual analysis
    const pgnArea = document.getElementById('pgn-input');
    if (pgnArea) {
        pgnArea.addEventListener('input', () => {
            const pgn = pgnArea.value;
            const tempGame = new Chess();
            if (tempGame.load_pgn(pgn)) {
                analysisGame = tempGame;
                currentHistory = analysisGame.history();
                currentMoveIndex = currentHistory.length - 1;
                moveEvaluations = new Array(currentHistory.length).fill(null);
                analysisBoard.position(analysisGame.fen());
                updateAnalysisUI();
                updateAccuracySummary();
            }
        });
    }
    
    // El toggle ya se maneja vía onclick global

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formLogin.querySelector('button[type="submit"]');
            if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...'; }
            
            try {
                const user = document.getElementById('login-user').value;
                const pass = document.getElementById('login-pass').value;
                
                let recaptchaToken = "";
                try {
                    if (typeof grecaptcha !== 'undefined' && recaptchaWidgets.login !== null) {
                        recaptchaToken = grecaptcha.getResponse(recaptchaWidgets.login);
                    }
                } catch(reErr) { console.warn("Error al obtener reCAPTCHA:", reErr); }

                if(!recaptchaToken && typeof grecaptcha !== 'undefined') { 
                    alert('Por favor, marca el cuadro del reCAPTCHA.'); 
                    if(btn) { btn.disabled = false; btn.innerHTML = 'Entrar'; }
                    return; 
                }

                const res = await API.login(user, pass, recaptchaToken);
                if (res && res.token) {
                    localStorage.setItem('jwt_token', res.token);
                    localStorage.setItem('currentUser', JSON.stringify(res.usuario));
                    if (typeof grecaptcha !== 'undefined' && recaptchaWidgets.login !== null) try { grecaptcha.reset(recaptchaWidgets.login); } catch(e){}
                    checkAuthStatus(); connectWebSocket(); renderDashboard();
                } else {
                    if (typeof grecaptcha !== 'undefined' && recaptchaWidgets.login !== null) try { grecaptcha.reset(recaptchaWidgets.login); } catch(e){}
                    errorDiv.textContent = 'Usuario o contraseña incorrectos.'; 
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                console.error("Error en login:", err);
                alert("Error de conexión con el servidor.");
            } finally {
                if(btn) { btn.disabled = false; btn.innerHTML = 'Entrar'; }
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
            let recaptchaToken = "";
            try {
                if (typeof grecaptcha !== 'undefined' && recaptchaWidgets.register !== null) {
                    recaptchaToken = grecaptcha.getResponse(recaptchaWidgets.register);
                }
            } catch(e){}

            if(!recaptchaToken && typeof grecaptcha !== 'undefined') { alert('Marca el reCAPTCHA'); return; }
            const res = await API.register(user, pass, email, 'ADMIN', elo, recaptchaToken); 
            if (typeof grecaptcha !== 'undefined' && recaptchaWidgets.register !== null) try { grecaptcha.reset(recaptchaWidgets.register); } catch(e){}
            if (res) { 
                alert("¡Cuenta creada con éxito! Ahora puedes iniciar sesión."); 
                toggleAuthMode();
            } else {
                alert("Error al crear la cuenta. Es posible que el usuario ya exista o el reCAPTCHA sea inválido.");
            }
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
                const numTableros = sistemaJuego === 'EQUIPOS' ? parseInt(document.getElementById('form-t-tableros').value) : null;
                const t = await API.createTorneo({ nombre, descripcion: "Torneo de Ajedrez", sistemaJuego, maxRondas, numTableros });
                if(t) { closeModal('create-tournament-modal'); renderDashboard(); renderTournamentList(); openTournamentDetail(t.id); }
            } catch (err) { alert("Error al crear"); } finally { btn.disabled = false; btn.innerHTML = 'Crear Torneo'; }
        });
    }

    if (formAddPlayer) {
        formAddPlayer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formAddPlayer.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Inscribiendo...'; }
            try {
                const mode = document.getElementById('add-player-mode').value;
                const targetId = window.currentTournamentId || currentTournamentId;
                
                if (!targetId) {
                    alert("Error: No hay un ID de torneo activo.");
                    return;
                }

                if (mode === 'equipos') {
                    const teamName = document.getElementById('form-team-select').value;
                    if (!teamName) { alert("Selecciona un equipo"); return; }
                    
                    showNotification("Inscribiendo equipo...");
                    const users = await API.getUsuarios();
                    const members = users.filter(u => u.nombreEquipo === teamName);
                    
                    let count = 0;
                    for (const user of members) {
                        const res = await API.inscribirJugador(targetId, {
                            nombre: user.username,
                            elo: user.eloRating,
                            nombreEquipo: teamName
                        });
                        if (res && (res.id || res.success !== false)) count++;
                    }
                    showNotification(`Equipo "${teamName}" inscrito con ${count} jugadores.`);
                    closeModal('add-player-modal');
                    renderTournamentDetail(targetId);
                    return;
                }

                let data = {};
                if (mode === 'existente') {
                    const select = document.getElementById('form-p-select');
                    if(select.selectedIndex === -1) { alert("Selecciona un jugador"); return; }
                    data.nombre = select.options[select.selectedIndex].text.split(' [ELO:')[0].trim();
                } else {
                    data.nombre = document.getElementById('form-p-name').value;
                    data.email = document.getElementById('form-p-email').value;
                    data.elo = document.getElementById('form-p-elo').value;
                    
                    // Removed team assignment from manual add as requested
                    // The captcha is not required for admin manual registration
                    data.recaptchaToken = "admin-manual-bypass"; 
                }
                
                const res = await API.inscribirJugador(targetId, data);
                // if (typeof grecaptcha !== 'undefined' && mode !== 'existente') try { grecaptcha.reset(2); } catch(e){}
                
                if (res && (res.id || res.success)) { 
                    showNotification("¡Jugador inscrito con éxito!");
                    closeModal('add-player-modal'); 
                    renderTournamentDetail(targetId); 
                } else { 
                    alert("Error: " + (res?.message || "Inscripción fallida")); 
                }
            } catch (err) {
                console.error('Error en formAddPlayer:', err);
                alert('Error crítico al inscribir: ' + err.message);
            } finally {
                if(btn) { btn.disabled = false; btn.innerHTML = 'Añadir al Torneo'; }
            }
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

    if (formCreatePlayer) {
        formCreatePlayer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formCreatePlayer.querySelector('button[type="submit"]');
            try {
                console.log('Formulario de crear jugador enviado');
                if(btn) { btn.disabled = true; btn.innerHTML = 'Creando...'; }
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';

                const username = document.getElementById('create-p-name').value;
                const email = document.getElementById('create-p-email').value;
                const password = document.getElementById('create-p-pass').value;
                const elo = parseInt(document.getElementById('create-p-elo').value) || 1200;
                
                console.log('Datos:', { username, email, elo });
                console.log('Obteniendo reCAPTCHA index 3...');
                let recaptchaToken = "";
                try {
                    if (typeof grecaptcha !== 'undefined' && recaptchaWidgets.player !== null) {
                        recaptchaToken = grecaptcha.getResponse(recaptchaWidgets.player);
                    }
                } catch(e){}
                
                if(!recaptchaToken && typeof grecaptcha !== 'undefined') { 
                    alert('Por favor, marca el reCAPTCHA de Creación de Jugador'); 
                    btn.disabled = false; 
                    btn.innerHTML = 'Crear Jugador'; 
                    return; 
                }
                
                const res = await API.register(username, password, email, 'PLAYER', elo, recaptchaToken);
                if (typeof grecaptcha !== 'undefined' && recaptchaWidgets.player !== null) try { grecaptcha.reset(recaptchaWidgets.player); } catch(e){}

                if (res) {
                    alert('¡Jugador "' + username + '" creado con éxito!');
                    closeModal('create-player-modal');
                    formCreatePlayer.reset();
                    renderPlayersView();
                    renderGlobalRanking();
                } else {
                    alert('Error al crear el jugador. Posiblemente el nombre de usuario ya existe o reCAPTCHA expiró.');
                }
            } catch (err) {
                console.error('Error en formCreatePlayer:', err);
                alert('Error crítico al crear jugador: ' + err.message);
            } finally {
                if(btn) {
                    btn.disabled = false;
                    btn.innerHTML = 'Crear Jugador';
                }
            }
        });
    } else {
        console.error('Formulario form-create-player no encontrado');
    }
}

// DASHBOARD
async function renderDashboard() {
    console.log('renderDashboard() iniciado');
    const recentList = document.getElementById('recent-tournaments-list');
    const teamRankingBody = document.querySelector('#dashboard-team-ranking-table tbody');
    
    if (recentList) recentList.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando torneos...</div>';
    if (teamRankingBody) teamRankingBody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Calculando...</td></tr>';

    try {
        const tournaments = await API.getTorneos() || [];
        const users = await API.getUsuarios() || [];
        
        document.getElementById('stat-active-tournaments').textContent = tournaments.filter(t => t.estado === 'EN_CURSO').length;
        document.getElementById('stat-total-players').textContent = users.filter(u => String(u.role || '').toUpperCase() !== 'ADMIN').length;
        
        const activeMatches = await API.getActiveMatchesCount() || 0;
        document.getElementById('stat-active-matches').textContent = activeMatches;
        
        if (recentList) {
            recentList.innerHTML = '';
            if (tournaments.length === 0) {
                recentList.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:2rem; color:gray;">No hay torneos registrados.</div>';
            } else {
                [...tournaments].reverse().slice(0, 10).forEach(t => recentList.appendChild(createTournamentUIItem(t)));
            }
        }

        // Global Team Ranking
        if (teamRankingBody) {
            const teams = {};
            users.forEach(u => {
                if (u.role === 'ADMIN') return;
                const teamName = u.nombreEquipo || 'Sin Equipo';
                if (!teams[teamName]) teams[teamName] = { name: teamName, members: 0, eloSum: 0, ptsSum: 0 };
                teams[teamName].members++;
                teams[teamName].eloSum += u.eloRating || 0;
            });

            // We need points too, but points are in inscriptions. 
            // For a global ranking, maybe just based on ELO or active tournament points?
            // User said "la clasificacion era en el dashboard". 
            // I'll use the ELO average and member count for now, or fetch all inscriptions if possible.
            // Let's stick to ELO and member count for "Global" ranking if we don't have global points.
            // Actually, I can fetch all inscriptions for all tournaments? No, too slow.
            
            const teamArray = Object.values(teams)
                .filter(t => t.name !== 'Sin Equipo')
                .sort((a, b) => (b.eloSum / b.members) - (a.eloSum / a.members));

            if (teamArray.length === 0) {
                teamRankingBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay equipos registrados aún.</td></tr>';
            } else {
                teamRankingBody.innerHTML = teamArray.map((t, i) => {
                    const avgElo = Math.round(t.eloSum / t.members);
                    let pos = `#${i+1}`;
                    if(i === 0) pos = '🥇';
                    return `<tr>
                        <td>${pos}</td>
                        <td><strong style="color:var(--accent-color);">${t.name}</strong></td>
                        <td>${t.members}</td>
                        <td>---</td>
                        <td><strong>${avgElo}</strong></td>
                    </tr>`;
                }).join('');
            }
        }

        await renderGlobalRanking();
    } catch (e) {
        console.error('Error en renderDashboard:', e);
        if (recentList) recentList.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:2rem; color:red;">Error al cargar datos del Dashboard.</div>';
    }
}

async function renderTournamentList() {
    const list = document.getElementById('all-tournaments-list');
    if (!list) return;
    
    let torneos = await API.getTorneos();
    
    // Aplicar filtros
    const search = document.getElementById('search-tournaments')?.value.toLowerCase() || '';
    const sys = document.getElementById('filter-system')?.value || '';
    const stat = document.getElementById('filter-status')?.value || '';

    torneos = torneos.filter(t => {
        const name = t.nombre || "";
        const matchesSearch = name.toLowerCase().includes(search);
        const matchesSys = !sys || t.sistemaJuego === sys;
        const matchesStat = !stat || t.estado === stat;
        return matchesSearch && matchesSys && matchesStat;
    });

    if (torneos.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:2rem; color:gray;">No se encontraron torneos con estos filtros.</div>';
        return;
    }

    list.innerHTML = torneos.map(t => {
        const date = t.fechaCreacion ? new Date(t.fechaCreacion).toLocaleDateString() : '---';
        const badgeClass = t.estado === 'PENDIENTE' ? 'status-pending' : (t.estado === 'EN_CURSO' ? 'status-active' : 'status-completed');
        return `
            <div class="tournament-item mb-2">
                <div class="tournament-info">
                    <h4>${t.nombre}</h4>
                    <div style="font-size:0.85rem; color:var(--text-muted);">
                        <i class="fa-solid fa-chess-board"></i> ${t.sistemaJuego} • <i class="fa-regular fa-calendar"></i> ${date}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span class="status-badge ${badgeClass}">${t.estado}</span>
                    <button class="btn btn-primary" onclick="openTournamentDetail('${t.id}')">Entrar</button>
                </div>
            </div>`;
    }).join('');
}

function createTournamentUIItem(t) {
    const div = document.createElement('div');
    div.className = 'tournament-item';
    let badgeClass = t.estado === 'EN_CURSO' ? 'status-active' : (t.estado === 'FINALIZADO' ? 'status-completed' : 'status-pending');
    div.innerHTML = `
        <div><h4 style="margin:0">${t.nombre}</h4><small>${t.sistemaJuego} • <span class="status-badge ${badgeClass}" style="padding:1px 6px; font-size:10px;">${t.estado}</span></small></div>
        <button class="btn btn-primary" onclick="openTournamentDetail('${t.id}')">Entrar</button>`;
    return div;
}

let currentTournamentData = null;

window.openTournamentDetail = async function(id) {
    console.log('Abriendo torneo:', id);
    window.currentTournamentId = id;
    currentTournamentId = id;
    currentTournamentData = await API.getTorneo(id);
    showView('tournament-detail-view'); 
    renderTournamentDetail(id);
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
        const winner = [...inscripciones].sort((a,b) => {
            if(b.puntosAcumulados !== a.puntosAcumulados) return b.puntosAcumulados - a.puntosAcumulados;
            if((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
            return (b.sonnebornBerger || 0) - (a.sonnebornBerger || 0);
        })[0];
        if(winner) {
            const bannerWrapper = document.createElement('div');
            bannerWrapper.id = 'champion-banner-global';
            bannerWrapper.style = 'width: 100%; display: flex; justify-content: center; margin: 20px 0; clear: both;';
            
            const banner = document.createElement('div');
            banner.style = [
                'background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                'color: white',
                'padding: 25px 50px',
                'border-radius: 20px',
                'text-align: center',
                'box-shadow: 0 15px 35px rgba(245, 158, 11, 0.4)',
                'border: 4px solid white',
                'display: flex',
                'flex-direction: column',
                'gap: 10px'
            ].join(';');
            
            if (t.sistemaJuego === 'EQUIPOS') {
                const teamName = winner.nombreEquipo || 'Sin Equipo';
                const teamMembers = inscripciones.filter(i => i.nombreEquipo === teamName).map(i => i.usuario.username).join(', ');
                banner.innerHTML = `
                    <div style="font-size: 2rem; font-weight: 800;">🏆 ¡EQUIPO CAMPEÓN: ${teamName.toUpperCase()}! 🏆</div>
                    <div style="font-size: 1rem; opacity: 0.9; font-weight: 500;">Integrantes: ${teamMembers}</div>
                `;
            } else {
                banner.innerHTML = `
                    <div style="font-size: 2rem; font-weight: 800;">🏆 ¡EL GRAN CAMPEÓN ES: ${winner.usuario.username.toUpperCase()}! 🏆</div>
                    <div style="font-size: 1rem; opacity: 0.9; font-weight: 500;">Con un total de ${winner.puntosAcumulados} puntos</div>
                `;
            }
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
            } else if (t.sistemaJuego === 'SUIZO' || t.sistemaJuego === 'EQUIPOS') {
                const nJugadores = (t.sistemaJuego === 'EQUIPOS') ? [...new Set(inscripciones.map(i => i.nombreEquipo))].length : inscripciones.length;
                const rondasEsperadas = t.maxRondas || Math.ceil(Math.log2(Math.max(nJugadores, 2)));
                isFinal = rondaActualCompleta && maxRound >= rondasEsperadas;
                
                // Si la ronda terminó pero no es la final, mostramos ambos
                if (rondaActualCompleta && !isFinal) {
                    actionButtons = `
                        <button class="btn" style="background:#dc2626; color:white; padding:10px 20px; border-radius:8px;" onclick="completeTournament('${id}')"><i class="fa-solid fa-trophy"></i> FINALIZAR YA</button>
                        <button class="btn btn-primary" onclick="startTournament('${id}')"><i class="fa-solid fa-forward"></i> SIGUIENTE RONDA</button>
                    `;
                }
            } else if (t.sistemaJuego.includes('ELIMINATORIA') || t.sistemaJuego === 'GRUPOS') {
                // En eliminatoria o grupos (fase final), es final si solo hay 1 partida en la ronda y terminó
                if (currentRoundMatches.length === 1 && currentRoundMatches[0].resultado !== 'P' && maxRound > 3) isFinal = true;
            }

            if (!actionButtons) {
                if (isFinal) {
                    actionButtons = `<button class="btn btn-primary" style="background:#dc2626;" onclick="completeTournament('${id}')"><i class="fa-solid fa-trophy"></i> FINALIZAR TORNEO</button>`;
                } else if (rondaActualCompleta) {
                    let btnText = "SIGUIENTE RONDA";
                    if (t.sistemaJuego === 'GRUPOS') {
                        // Detectar si estamos terminando la fase de grupos (3 rondas para grupos de 4)
                        if (maxRound === 3) btnText = "GENERAR FASE ELIMINATORIA";
                    }
                    actionButtons = `<button class="btn btn-primary" onclick="startTournament('${id}')"><i class="fa-solid fa-forward"></i> ${btnText}</button>`;
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
            actions.innerHTML += `<button class="btn btn-danger" style="padding:10px 20px; border-radius:10px; font-weight:700; box-shadow: 0 4px 15px rgba(229, 57, 53, 0.2);" onclick="deleteTournament('${id}')"><i class="fa-solid fa-trash-can"></i> ELIMINAR TORNEO</button>`;
            
            // Mostrar botón de exportar FIDE y pestaña de árbitro para admins
            const fideBtn = document.querySelector('button[onclick*="exportFide"]');
            if(fideBtn) fideBtn.style.display = 'block';
            
            const arbiterTab = document.querySelector('.tab-btn[data-tab="tab-arbiter"]');
            if(arbiterTab) arbiterTab.style.display = 'inline-block';
        } else {
            const fideBtn = document.querySelector('button[onclick*="exportFide"]');
            if(fideBtn) fideBtn.style.display = 'none';
            
            const arbiterTab = document.querySelector('.tab-btn[data-tab="tab-arbiter"]');
            if(arbiterTab) arbiterTab.style.display = 'none';
        }

        // Botón PDF si ya ha iniciado o terminado
        if (yaIniciado || t.estado === 'FINALIZADO') {
            const pdfBtn = `<button class="btn" style="background:#1e293b; color:white; border:none; padding:10px 15px; border-radius:8px; margin-right:5px;" onclick="exportTournamentPDF()"><i class="fa-solid fa-file-pdf"></i> PDF</button>`;
            actions.innerHTML = pdfBtn + actions.innerHTML;
        }
    }
    
    // Explicitly handle Teams and Brackets tab visibility
    const teamsTabBtn = document.getElementById('btn-tab-teams');
    const bracketsTabBtn = document.getElementById('btn-tab-bracket');

    if (teamsTabBtn) {
        teamsTabBtn.style.display = (t.sistemaJuego === 'EQUIPOS') ? 'inline-block' : 'none';
        if (t.sistemaJuego === 'EQUIPOS') {
            teamsTabBtn.innerHTML = '<i class="fa-solid fa-users-viewfinder"></i> EQUIPOS (Activo)';
            teamsTabBtn.style.background = 'rgba(161, 136, 127, 0.1)';
        }
    }

    if (bracketsTabBtn) {
        const isKnockout = ['ELIMINATORIA', 'DOBLE_ELIMINATORIA', 'GRUPOS'].includes(t.sistemaJuego);
        bracketsTabBtn.style.display = isKnockout ? 'inline-block' : 'none';
    }

    // Add "Elegir Equipo" and "Crear Equipo" buttons if EQUIPOS tournament and PENDIENTE
    if (t.sistemaJuego === 'EQUIPOS' && t.estado === 'PENDIENTE') {
        const teamButtonsHtml = `
            <div style="display:flex; gap:10px; margin-bottom:1.5rem; background: rgba(139, 90, 43, 0.05); padding: 15px; border-radius: 12px; border: 1px solid var(--accent-light);">
                <button class="btn btn-primary" style="flex:1;" onclick="openAddPlayerModal('equipos')">
                    <i class="fa-solid fa-users-rectangle"></i> Inscribir Equipo Existente
                </button>
                <button class="btn btn-secondary" style="flex:1;" onclick="openModal('create-team-modal')">
                    <i class="fa-solid fa-plus-circle"></i> Crear Nuevo Equipo
                </button>
            </div>
        `;
        const tabPlayers = document.getElementById('tab-players');
        if (tabPlayers) {
            const existingBtn = document.getElementById('team-actions-container');
            if (!existingBtn) {
                const div = document.createElement('div');
                div.id = 'team-actions-container';
                div.innerHTML = teamButtonsHtml;
                tabPlayers.prepend(div);
            }
        }
    } else {
        const existingBtn = document.getElementById('team-actions-container');
        if (existingBtn) existingBtn.remove();
    }

    renderPlayers(inscripciones, t.estado, id);
    renderTeams(inscripciones);
    renderRounds(partidas, t.estado, id, t.sistemaJuego, inscripciones);
    renderStandings(inscripciones, t.estado, t.sistemaJuego);
    renderBrackets(partidas, t.sistemaJuego);
    renderArbiterTools(id);

    // Si el usuario logueado está inscrito, mostrar su QR de presencia
    const myIns = inscripciones.find(ins => ins.usuario.id === user.id);
    const qrContainer = document.getElementById('my-qr-checkin-container');
    if (myIns && qrContainer) {
        qrContainer.style.display = 'block';
        const qrDiv = document.getElementById('player-qr-code');
        qrDiv.innerHTML = '';
        if (!myIns.presente) {
            new QRCode(qrDiv, {
                text: `CHESS_CHECKIN:${id}:${myIns.id}`,
                width: 128,
                height: 128
            });
            document.getElementById('qr-status-text').innerHTML = '<i class="fa-solid fa-clock"></i> Pendiente de escaneo por el árbitro';
            document.getElementById('qr-status-text').style.color = '#eab308';
        } else {
            qrDiv.innerHTML = '<i class="fa-solid fa-circle-check" style="font-size:4rem; color:#16a34a;"></i>';
            document.getElementById('qr-status-text').innerHTML = '✅ ASISTENCIA REGISTRADA';
            document.getElementById('qr-status-text').style.color = '#16a34a';
        }
    } else if (qrContainer) {
        qrContainer.style.display = 'none';
    }
}

function renderBrackets(partidas, sistema) {
    const container = document.getElementById('bracket-visualization');
    const tabBtn = document.getElementById('btn-tab-bracket');
    
    if (!container) return;
    
    const isKnockout = ['ELIMINATORIA', 'DOBLE_ELIMINATORIA', 'GRUPOS'].includes(sistema);
    if (!isKnockout) {
        if(tabBtn) tabBtn.style.display = 'none';
        return;
    }
    
    if(tabBtn) tabBtn.style.display = 'inline-block';
    container.innerHTML = '';

    if (!partidas || partidas.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:gray; padding:3rem;"><i class="fa-solid fa-sitemap" style="font-size:3rem; display:block; margin-bottom:1rem; opacity:0.2;"></i>El cuadro visual se generará automáticamente al iniciar la fase eliminatoria.</div>';
        return;
    }

    // Filtrar partidas de grupos en modo Mundial para no ensuciar el cuadro
    let partidasFiltradas = partidas;
    if (sistema === 'GRUPOS') {
        // En modo mundial, el cuadro empieza tras la fase de grupos. 
        // Usualmente la fase de grupos tiene 3 rondas.
        const maxGroupRound = 3; 
        partidasFiltradas = partidas.filter(p => (p.rondaNumero || 0) > maxGroupRound);
        
        if (partidasFiltradas.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:gray; padding:3rem;"><i class="fa-solid fa-trophy" style="font-size:3rem; display:block; margin-bottom:1rem; opacity:0.2;"></i>La fase eliminatoria (cuadros) se activará al finalizar la fase de grupos.<br><small>Faltan resultados en los grupos o aún no se ha generado la siguiente fase.</small></div>`;
            return;
        }
    }

    if (sistema === 'DOBLE_ELIMINATORIA') {
        const winnersSection = document.createElement('div');
        winnersSection.innerHTML = '<h3 style="margin-bottom:1rem; color:var(--win-color); border-bottom:1px solid var(--accent-light);">Cuadro de Ganadores</h3>';
        const losersSection = document.createElement('div');
        losersSection.innerHTML = '<h3 style="margin-top:2rem; margin-bottom:1rem; color:var(--loss-color); border-bottom:1px solid var(--accent-light);">Cuadro de Perdedores</h3>';
        
        container.appendChild(winnersSection);
        renderBracketType(partidasFiltradas, winnersSection, 'WINNERS');
        container.appendChild(losersSection);
        renderBracketType(partidasFiltradas, losersSection, 'LOSERS');
    } else {
        renderBracketType(partidasFiltradas, container, 'SINGLE');
    }
}

function renderBracketType(partidas, targetContainer, type) {
    // Función auxiliar para calcular derrotas de un jugador antes de una ronda específica
    const getLossesAtRound = (userId, round, allPartidas) => {
        return allPartidas.filter(p => {
            if ((p.rondaNumero || 1) >= round) return false;
            if (p.resultado === 'P' || p.resultado === 'BYE') return false;
            const isWhite = p.blancas && p.blancas.id === userId;
            const isBlack = p.negras && p.negras.id === userId;
            if (isWhite && p.resultado === '0-1') return true;
            if (isBlack && p.resultado === '1-0') return true;
            return false;
        }).length;
    };

    const rounds = {};
    partidas.forEach(p => {
        const rNum = p.rondaNumero || 1;
        
        // En doble eliminatoria, filtramos qué partidas mostrar en cada sección
        if (type === 'WINNERS' || type === 'LOSERS') {
            const bLosses = p.blancas ? getLossesAtRound(p.blancas.id, rNum, partidas) : 0;
            const nLosses = p.negras ? getLossesAtRound(p.negras.id, rNum, partidas) : 0;
            
            if (type === 'WINNERS') {
                // Ganadores: Ambos jugadores deben tener 0 derrotas al iniciar la ronda
                // O si es la Gran Final (donde uno tiene 0 y el otro 1), la mostramos en Ganadores
                const isGranFinal = (bLosses === 0 && nLosses === 1) || (bLosses === 1 && nLosses === 0);
                if (bLosses > 0 || (nLosses > 0 && !isGranFinal)) return;
            } else if (type === 'LOSERS') {
                // Perdedores: Al menos uno tiene que tener 1 derrota al iniciar la ronda
                // Pero NO mostramos la gran final aquí (esa va en Winners)
                const isGranFinal = (bLosses === 0 && nLosses === 1) || (bLosses === 1 && nLosses === 0);
                if (isGranFinal || (bLosses === 0 && (p.negras ? nLosses === 0 : true))) return;
            }
        }

        if (!rounds[rNum]) rounds[rNum] = [];
        rounds[rNum].push(p);
    });

    const bracketWrapper = document.createElement('div');
    bracketWrapper.className = 'bracket-container';

    Object.keys(rounds).sort((a,b) => a - b).forEach(rNum => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'bracket-round';
        
        const title = document.createElement('div');
        title.className = 'bracket-round-title';
        title.innerHTML = `<i class="fa-solid fa-circle"></i> Ronda ${rNum}`;
        roundDiv.appendChild(title);

        rounds[rNum].forEach(p => {
            const matchDiv = document.createElement('div');
            matchDiv.className = 'bracket-match';
            
            const p1Winner = p.resultado === '1-0' || p.resultado === 'BYE';
            const p2Winner = p.resultado === '0-1';
            const isDraw = p.resultado === '0.5-0.5';
            const isBye = p.resultado === 'BYE';

            matchDiv.innerHTML = `
        <div class="bracket-player ${p1Winner ? 'winner' : ''}" onclick="if('${p.blancas?.id}') showPlayerStats('${p.blancas?.id}')" style="cursor:pointer; ${p1Winner && (p.resultado!=='BYE') ? 'background:rgba(85, 139, 47, 0.15); color:var(--win-color); font-weight:700;' : ''}">
            <span style="display:flex; align-items:center; gap:8px;">
                <i class="fa-regular fa-user" style="font-size:0.7rem; opacity:0.5;"></i>
                ${p.blancas ? p.blancas.username : '<span class="bracket-empty">?</span>'}
            </span>
            <span class="bracket-score">${p.resultado === 'BYE' ? 'W' : (p1Winner ? '1' : (isDraw ? '½' : '0'))}</span>
        </div>
        <div class="bracket-player ${p2Winner ? 'winner' : ''}" onclick="if('${p.negras?.id}') showPlayerStats('${p.negras?.id}')" style="cursor:pointer; ${p2Winner ? 'background:rgba(85, 139, 47, 0.15); color:var(--win-color); font-weight:700;' : ''}">
            <span style="display:flex; align-items:center; gap:8px;">
                <i class="fa-regular fa-user" style="font-size:0.7rem; opacity:0.5;"></i>
                ${p.negras ? p.negras.username : (isBye ? '<span class="bracket-empty">DESCANSA (BYE)</span>' : '<span class="bracket-empty">ESPERANDO...</span>')}
            </span>
            <span class="bracket-score">${p2Winner ? '1' : (isDraw ? '½' : '0')}</span>
        </div>
            `;
            roundDiv.appendChild(matchDiv);
        });
        bracketWrapper.appendChild(roundDiv);
    });
    targetContainer.appendChild(bracketWrapper);
}

window.deleteTournament = async function(id) {
    if (!id) return;
    if (confirm("¿Estás seguro de que deseas eliminar este torneo permanentemente? Esta acción no se puede deshacer.")) {
        try {
            const res = await fetchWithAuth(`${window.API_BASE}/torneos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showNotification("Torneo eliminado con éxito");
                showView('dashboard-view');
                renderTournamentList();
            } else {
                alert("No se pudo eliminar el torneo. Es posible que no tengas permisos.");
            }
        } catch (e) {
            console.error("Error deleting tournament:", e);
        }
    }
};

function renderArbiterTools(id) {
    const arbiterTab = document.querySelector('#tab-arbiter');
    if (!arbiterTab) return;

    const toolsHtml = `
        <div class="card" style="border-left: 5px solid var(--accent-color); margin-bottom: 2rem;">
            <h3><i class="fa-solid fa-screwdriver-wrench"></i> Herramientas de Mantenimiento</h3>
            <p class="text-muted">Utilice estas herramientas si detecta inconsistencias en los puntos o desempates.</p>
            <div style="display:flex; gap:15px; margin-top:1rem;">
                <button class="btn btn-secondary" onclick="recalculateTournamentPoints('${id}')">
                    <i class="fa-solid fa-sync"></i> Recalcular Puntos y Desempates
                </button>
            </div>
        </div>
    `;
    // Solo añadir si no existe
    if (!arbiterTab.querySelector('.arbiter-tools-container')) {
        const div = document.createElement('div');
        div.className = 'arbiter-tools-container';
        div.innerHTML = toolsHtml;
        arbiterTab.prepend(div);
    }
}

window.recalculateTournamentPoints = async function(id) {
    if (!confirm("¿Deseas recalcular todos los puntos del torneo? Esto sincronizará la tabla de posiciones con los resultados de las partidas.")) return;
    try {
        const res = await fetchWithAuth(`${window.API_BASE}/torneos/${id}/recalculate`, { method: 'POST' });
        if (res.ok) {
            showNotification("Puntos recalculados con éxito");
            renderTournamentDetail(id);
        } else {
            showNotification("Error al recalcular puntos", "error");
        }
    } catch (e) {
        console.error("Error recalculate:", e);
    }
};

function renderPlayers(inscripciones, estado, tId) {
    const tbody = document.querySelector('#players-table tbody');
    if(!tbody) return;
    tbody.innerHTML = inscripciones.map(ins => `
        <tr><td><a href="javascript:void(0)" onclick="showPlayerStats('${ins.usuario.id}')" style="text-decoration:none; color:var(--accent-color); font-weight:600;">${ins.usuario.username}</a></td><td>${ins.usuario.eloRating}</td>
            <td style="text-align:right">${estado === 'PENDIENTE' ? `<button class="btn" style="color:red; background:none;" onclick="removePlayer('${tId}', '${ins.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}</td>
        </tr>`).join('');
}

window.removePlayer = async function(tId, insId) {
    if (confirm("¿Eliminar?")) { await API.deleteInscripcion(tId, insId); renderTournamentDetail(tId); }
};

function renderTeams(inscripciones) {
    const container = document.getElementById('teams-list-container');
    const standingsTable = document.getElementById('team-standings-table');
    if (!container) return;
    
    const teams = {};
    inscripciones.forEach(ins => {
        const teamName = ins.usuario?.equipo?.nombre || ins.nombreEquipo || 'Sin Equipo';
        if (!teams[teamName]) teams[teamName] = { name: teamName, members: [], pts: 0, eloSum: 0 };
        teams[teamName].members.push(ins);
        teams[teamName].pts += (ins.puntosAcumulados || 0);
        teams[teamName].eloSum += (ins.usuario?.eloRating || 0);
    });

    const teamArray = Object.values(teams).sort((a, b) => b.pts - a.pts);

    if (teamArray.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:2rem; color:gray;">No hay equipos registrados aún.</div>';
        if (standingsTable) standingsTable.querySelector('tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay datos</td></tr>';
        return;
    }

    // Populate Standings Table
    if (standingsTable) {
        const tbody = standingsTable.querySelector('tbody');
        tbody.innerHTML = teamArray.map((team, i) => {
            const avgElo = Math.round(team.eloSum / team.members.length);
            let pos = `#${i+1}`;
            let style = '';
            if(i === 0) { pos = '🥇 Oro'; style = 'background:rgba(251,191,36,0.15); border-left:5px solid #fbbf24; font-weight:bold;'; }
            else if(i === 1) { pos = '🥈 Plata'; style = 'background:rgba(148,163,184,0.15); border-left:5px solid #94a3b8;'; }
            else if(i === 2) { pos = '🥉 Bronce'; style = 'background:rgba(180,83,9,0.15); border-left:5px solid #b45309;'; }
            
            return `<tr style="${style}">
                <td>${pos}</td>
                <td><strong style="color:var(--accent-color);">${team.name}</strong></td>
                <td>${team.members.length}</td>
                <td><span style="font-weight:800; color:var(--win-color);">${team.pts}</span></td>
                <td>${avgElo}</td>
            </tr>`;
        }).join('');
    }

    // Populate Detailed Cards
    container.innerHTML = teamArray.map(team => {
        const avgElo = Math.round(team.eloSum / team.members.length);

        return `
            <div class="card team-card" style="padding: 1.5rem; border-left: 5px solid var(--accent-color); background: var(--surface-card); transition: all 0.3s ease;">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom: 1rem;">
                    <h4 style="margin:0; color: var(--accent-color); font-size: 1.2rem;">${team.name}</h4>
                    <span class="status-badge" style="background: var(--accent-light); color: var(--accent-color);">${team.members.length} Jug.</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
                    <div><i class="fa-solid fa-calculator"></i> ELO Promedio: <strong>${avgElo}</strong></div>
                    <div><i class="fa-solid fa-star"></i> Puntos Totales: <strong>${team.pts}</strong></div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:5px;">
                    ${team.members.map(m => `<span title="ELO: ${m.usuario.eloRating}" style="font-size: 0.75rem; background: var(--surface-color); padding: 2px 8px; border-radius: 10px; border: 1px solid var(--accent-light); cursor:pointer;" onclick="showPlayerStats('${m.usuario.id}')">${m.usuario.username}</span>`).join('')}
                </div>
            </div>`;
    }).join('');
}

function renderRounds(partidas, estado, tId, sistema, inscripciones) {
    console.log('renderRounds ejecutado para Torneo:', tId, 'Partidas:', partidas.length);
    const userStr = localStorage.getItem('currentUser');
    const user = userStr ? JSON.parse(userStr) : {};
    const isAdmin = String(user.role || '').toUpperCase() === 'ADMIN';
    const container = document.getElementById('rounds-container');
    if (!container) {
        console.error('No se encontró el contenedor rounds-container');
        return;
    }
    
    container.innerHTML = '';
    
    if (!partidas || partidas.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:3rem; color:var(--text-muted); background:var(--surface-color); border-radius:12px; border: 2px dashed var(--accent-light);">
                <i class="fa-solid fa-chess-board" style="font-size:3rem; margin-bottom:1rem; opacity:0.3;"></i>
                <p style="font-weight:600; font-size:1.1rem; margin:0;">No hay emparejamientos generados.</p>
                <p style="font-size:0.9rem; margin-top:0.5rem;">${estado === 'PENDIENTE' ? 'Pulsa "INICIAR TORNEO" para generar la primera ronda.' : 'Esperando que el árbitro genere la ronda.'}</p>
            </div>`;
        return;
    }
    const rounds = {};
    partidas.forEach(p => { const r = p.rondaNumero || 1; if (!rounds[r]) rounds[r] = []; rounds[r].push(p); });
    
    const roundNums = Object.keys(rounds).map(Number);
    const maxRound = Math.max(...roundNums);

    roundNums.sort((a, b) => b - a).forEach(rNum => {
        // Strict locking: NO ONE changes results if finalized
        const isLocked = (estado === 'FINALIZADO');
        const div = document.createElement('div');
        div.className = 'round-section mt-4';
        div.style = 'background:var(--surface-card); padding:1.2rem; border-radius:12px; margin-bottom:1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border:1px solid var(--accent-light);';
        div.innerHTML = `<h4 style="color:var(--accent-color); border-bottom:2px solid var(--accent-light); padding-bottom:0.5rem; margin-bottom:1rem;">Ronda ${rNum}</h4>`;
        if (sistema === 'EQUIPOS' || sistema === 'GRUPOS') {
            // Group matches by team matchup or group number
            const groups = {};
            rounds[rNum].forEach(p => {
                let key = '';
                if (sistema === 'EQUIPOS') {
                    const teamA = p.blancas?.equipo?.nombre || p.blancas?.nombreEquipo || 'Sin Equipo';
                    const teamB = p.negras?.equipo?.nombre || p.negras?.nombreEquipo || 'Sin Equipo';
                    key = [teamA, teamB].sort().join(' vs ');
                } else {
                    // Buscar el grupo de los jugadores involucrados
                    const playerIns = inscripciones.find(ins => ins.usuario.id === p.blancas?.id);
                    key = playerIns?.numeroGrupo ? `Grupo ${playerIns.numeroGrupo}` : 'Fase Eliminatoria';
                }
                
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
            });

            Object.entries(groups).forEach(([groupName, matches]) => {
                const isGroup = groupName.startsWith('Grupo');
                div.innerHTML += `
                    <div style="background: rgba(139, 90, 43, 0.05); padding: 8px 12px; margin-top: 15px; border-radius: 8px; border-left: 4px solid var(--accent-color); font-weight: 700; font-size: 0.9rem; color: var(--accent-color); display: flex; justify-content: space-between; align-items: center;">
                        <span><i class="fa-solid ${isGroup ? 'fa-layer-group' : 'fa-people-group'}"></i> ${groupName}</span>
                        <span style="font-size: 0.7rem; opacity: 0.7;">${matches.length} Partidas</span>
                    </div>`;
                
                matches.forEach(p => {
                    div.innerHTML += renderMatchItem(p, isLocked);
                });
            });
        } else {
            rounds[rNum].forEach(p => {
                let bracketInfo = '';
                if (sistema === 'DOBLE_ELIMINATORIA') {
                    const bLosses = inscripciones.find(ins => ins.usuario.id === p.blancas?.id)?.derrotas || 0;
                    const nLosses = inscripciones.find(ins => ins.usuario.id === p.negras?.id)?.derrotas || 0;
                    if (bLosses === 0 && nLosses === 0) bracketInfo = '<span style="color:#16a34a; font-size:10px;">[GANADORES]</span>';
                    else if (bLosses === 1 && nLosses === 1) bracketInfo = '<span style="color:#dc2626; font-size:10px;">[PERDEDORES]</span>';
                    else bracketInfo = '<span style="color:#7c3aed; font-size:10px;">[GRAN FINAL]</span>';
                }
                div.innerHTML += renderMatchItem(p, isLocked, bracketInfo);
            });
        }
        container.appendChild(div);
    });
}

// Helper function to render a single match row
function renderMatchItem(p, isLocked, bracketInfo = '') {
    const res = p.resultado || 'P';
    return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid rgba(0,0,0,0.05);">
            <div style="flex:2;">
                <div style="margin-bottom: 2px;">${bracketInfo}</div>
                <span style="font-weight:600; cursor:pointer; color:${res==='1-0'?'#16a34a':'var(--accent-color)'}" onclick="showPlayerStats('${p.blancas?.id}')">${p.blancas?.username || '?'}</span> 
                <span style="color:var(--text-muted); font-size: 0.8rem; margin: 0 5px;">vs</span> 
                <span style="font-weight:600; cursor:pointer; color:${res==='0-1'?'#16a34a':'var(--accent-color)'}" onclick="showPlayerStats('${p.negras?.id}')">${p.negras?.username || 'ESPERANDO...'}</span>
            </div>
            <div style="flex:1; text-align:right;">
                <select ${isLocked ? 'disabled' : ''} onchange="setResult('${p.id}', this.value)" style="padding:6px 10px; border-radius:8px; font-weight:bold; border: 1px solid var(--accent-light); background: white; cursor:pointer; ${isLocked ? 'background:#f1f5f9; cursor:not-allowed; opacity: 0.7; border-color:transparent;' : ''}">
                    <option value="P" ${res==='P'?'selected':''}>P</option>
                    <option value="1-0" ${res==='1-0'?'selected':''}>1-0</option>
                    <option value="0.5-0.5" ${res==='0.5-0.5'?'selected':''}>½</option>
                    <option value="0-1" ${res==='0-1'?'selected':''}>0-1</option>
                </select>
            </div>
        </div>`;
}

window.setResult = async function(partidaId, resultado) {
    // Usar window.currentTournamentId como fuente de verdad principal
    const tId = window.currentTournamentId || currentTournamentId;
    if (!tId) {
        showNotification("Error: no hay torneo activo seleccionado.", "error");
        return;
    }
    // Sync both variables
    currentTournamentId = tId;
    window.currentTournamentId = tId;
    
    // Safety check: fetch current tournament state before allowing update
    const t = await API.getTorneo(tId);
    if (t && t.estado === 'FINALIZADO') {
        showNotification("Este torneo ya está finalizado. No se pueden cambiar los resultados.", "error");
        renderTournamentDetail(tId);
        return;
    }

    try {
        const res = await fetchWithAuth(`${window.API_BASE}/partidas/${partidaId}/resultado`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ resultado }) 
        });
        
        if (!res.ok) {
            const err = await res.text();
            showNotification(err || "Error al actualizar resultado", "error");
        } else {
            showNotification("✓ Resultado guardado");
            renderTournamentDetail(tId);
        }
    } catch (e) {
        console.error("Error en setResult:", e);
        showNotification("Error de conexión al guardar resultado", "error");
    }
};

// (Contenido removido por duplicidad)

function renderStandings(inscripciones, estado, sistema) {
    const table = document.getElementById('standings-table');
    if (!table) return;
    const exp = document.getElementById('standings-explanation');
    
    if (sistema === 'GRUPOS') {
        renderGroupStandings(inscripciones);
        if(exp) exp.innerHTML = `<i class="fa-solid fa-layer-group"></i> Clasificación por Grupos. Los mejores de cada grupo avanzan.`;
        return;
    }

    if (sistema === 'EQUIPOS') {
        renderTeams(inscripciones);
        if(exp) exp.innerHTML = `<i class="fa-solid fa-users-viewfinder"></i> Batalla de Equipos. Sumatoria de puntos por club.`;
        
        const thead = table.querySelector('thead');
        thead.innerHTML = `<tr><th>Pos</th><th>Equipo</th><th>Jugadores</th><th>Pts Totales</th><th>Promedio ELO</th></tr>`;
        const tbody = table.querySelector('tbody');
        
        const teams = {};
        inscripciones.forEach(ins => {
            const t = ins.nombreEquipo || 'Sin Equipo';
            if (!teams[t]) teams[t] = { name: t, pts: 0, members: 0, eloSum: 0 };
            teams[t].pts += (ins.puntosAcumulados || 0);
            teams[t].members++;
            teams[t].eloSum += (ins.usuario?.eloRating || 0);
        });
        const teamArray = Object.values(teams).sort((a,b) => b.pts - a.pts);
        tbody.innerHTML = teamArray.map((t, i) => {
            let pos = `#${i+1}`;
            let style = '';
            if(i === 0) { pos = '🥇 Oro'; style = 'background:rgba(251,191,36,0.15); border-left:5px solid #fbbf24; font-weight:bold;'; }
            else if(i === 1) { pos = '🥈 Plata'; style = 'background:rgba(148,163,184,0.15); border-left:5px solid #94a3b8;'; }
            else if(i === 2) { pos = '🥉 Bronce'; style = 'background:rgba(180,83,9,0.15); border-left:5px solid #b45309;'; }
            
            return `<tr style="${style}">
                <td>${pos}</td>
                <td><strong>${t.name}</strong></td>
                <td>${t.members}</td>
                <td><span style="color:var(--accent-color); font-weight:800;">${t.pts}</span></td>
                <td>${Math.round(t.eloSum/t.members)}</td>
            </tr>`;
        }).join('');
        return;
    }

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
        return `<tr style="${style}"><td>${pos}</td><td><a href="javascript:void(0)" onclick="showPlayerStats('${ins.usuario.id}')" style="text-decoration:none; color:var(--text-main); font-weight:700;">${ins.usuario.username}</a></td><td><span style="color:var(--accent-color); font-weight:800;">${ins.puntosAcumulados}</span></td><td>${ins.buchholz || 0}</td><td>${ins.sonnebornBerger || 0}</td><td>${ins.partidasJugadas}</td></tr>`;
    }).join('');
}

function renderGroupStandings(inscripciones) {
    const table = document.getElementById('standings-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const thead = table.querySelector('thead');
    if (!tbody || !thead) return;
    
    thead.innerHTML = `<tr>
        <th style="width:90px">Grupo</th>
        <th>Jugador</th>
        <th style="text-align:center">Pts</th>
        <th style="text-align:center">V</th>
        <th style="text-align:center">E</th>
        <th style="text-align:center">D</th>
        <th style="text-align:center">Estado</th>
    </tr>`;
    
    // Agrupar inscripciones por número de grupo
    const grupos = {};
    inscripciones.forEach(ins => {
        const g = ins.numeroGrupo != null ? ins.numeroGrupo : 'Sin Grupo';
        if (!grupos[g]) grupos[g] = [];
        grupos[g].push(ins);
    });

    let html = '';
    const sortedKeys = Object.keys(grupos).sort((a, b) => {
        // Numeric sort if possible
        const na = parseInt(a), nb = parseInt(b);
        return isNaN(na) ? 1 : isNaN(nb) ? -1 : na - nb;
    });

    sortedKeys.forEach(g => {
        const members = [...grupos[g]].sort((a, b) => {
            const ptsDiff = (b.puntosAcumulados || 0) - (a.puntosAcumulados || 0);
            if (ptsDiff !== 0) return ptsDiff;
            return (b.sonnebornBerger || 0) - (a.sonnebornBerger || 0);
        });
        
        members.forEach((ins, i) => {
            const isQualifier = i < 2 && g !== 'Sin Grupo';
            const pts = ins.puntosAcumulados || 0;
            
            html += `<tr style="
                ${isQualifier ? 'background: rgba(22, 163, 74, 0.10);' : ''}
                ${isQualifier ? 'border-left: 4px solid #16a34a;' : 'border-left: 4px solid transparent;'}
                transition: background 0.2s;
            ">
                <td>${i === 0 
                    ? `<span style="background:var(--accent-color); color:white; padding:3px 9px; border-radius:6px; font-size:0.72rem; font-weight:700; letter-spacing:0.5px;">G${g}</span>` 
                    : '<span style="opacity:0;">·</span>'}
                </td>
                <td style="${isQualifier ? 'color:#15803d; font-weight:700;' : ''}">
                    ${i < 2 && g !== 'Sin Grupo' ? '<i class="fa-solid fa-arrow-up" style="color:#16a34a; font-size:0.7rem;"></i> ' : ''}
                    ${ins.usuario.username}
                </td>
                <td style="text-align:center">
                    <span style="display:inline-block; min-width:32px; background:${pts > 0 ? 'rgba(22,163,74,0.15)' : 'transparent'}; color:${pts > 0 ? '#15803d' : 'var(--text-muted)'}; font-weight:800; border-radius:4px; padding:2px 6px;">${pts}</span>
                </td>
                <td style="text-align:center; color:#16a34a; font-weight:600;">${ins.victorias || 0}</td>
                <td style="text-align:center; color:#64748b;">${ins.empates || 0}</td>
                <td style="text-align:center; color:#dc2626;">${ins.derrotas || 0}</td>
                <td style="text-align:center;">
                    ${isQualifier 
                        ? '<span style="font-size:0.7rem; background:#16a34a; color:white; padding:2px 6px; border-radius:4px;">CLASIFICA</span>' 
                        : (g !== 'Sin Grupo' && i >= 2 ? '<span style="font-size:0.7rem; background:#64748b; color:white; padding:2px 6px; border-radius:4px;">ELIMINADO</span>' : '')}
                </td>
            </tr>`;
        });
        // Separator between groups
        html += `<tr><td colspan="7" style="padding:4px; border:none; background: var(--accent-light); opacity:0.3;"></td></tr>`;
    });
    tbody.innerHTML = html;
}

// (Contenido removido por duplicidad, la función renderTeams principal está en la línea 1556)

window.openAddPlayerModal = async function(mode) {
    const modal = document.getElementById('add-player-modal');
    if (!modal) return;
    
    const t = await API.getTorneo(window.currentTournamentId || currentTournamentId);
    const isEquipos = t && t.sistemaJuego === 'EQUIPOS';

    // Mostrar/ocultar pestaña de equipos segun tipo de torneo
    const teamTabBtn = document.getElementById('tab-btn-equipos');
    if (teamTabBtn) teamTabBtn.style.display = isEquipos ? 'inline-block' : 'none';

    // Siempre mostrar el contenedor de tabs
    const tabs = document.getElementById('add-player-tabs');
    if (tabs) tabs.style.display = 'flex';

    // Si mode = 'equipos' solo mostrar esa pestaña
    if (mode === 'equipos') {
        const existBtn = document.getElementById('tab-btn-existente');
        const nuovoBtn = document.getElementById('tab-btn-nuevo');
        if (existBtn) existBtn.style.display = 'none';
        if (nuovoBtn) nuovoBtn.style.display = 'none';
        if (teamTabBtn) teamTabBtn.style.display = 'inline-block';
        document.getElementById('add-player-modal-title').textContent = "Inscribir Equipo";
    } else {
        const existBtn = document.getElementById('tab-btn-existente');
        const nuovoBtn = document.getElementById('tab-btn-nuevo');
        if (existBtn) existBtn.style.display = 'inline-block';
        if (nuovoBtn) nuovoBtn.style.display = 'inline-block';
        document.getElementById('add-player-modal-title').textContent = "Inscribir Jugador";
    }

    // Cambiar a la pestaña solicitada
    togglePlayerTab(mode);

    // Cargar datos para la pestaña seleccionada
    if (mode === 'existente') {
        const users = await API.getUsuarios();
        const playersOnly = users.filter(u => String(u.role || '').toUpperCase() !== 'ADMIN');
        const select = document.getElementById('form-p-select');
        if (select) select.innerHTML = playersOnly.map(u => `<option value="${u.id}">${u.username} [ELO: ${u.eloRating}]</option>`).join('');
    } else if (mode === 'equipos') {
        const users = await API.getUsuarios();
        const teams = [...new Set(users.map(u => u.nombreEquipo).filter(n => n))].sort();
        const select = document.getElementById('form-team-select');
        if (select) select.innerHTML = '<option value="">-- Seleccionar Equipo --</option>' + 
            teams.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.togglePlayerTab = function(tab) {
    document.getElementById('add-player-mode').value = tab;
    const contentExistente = document.getElementById('tab-existente-content');
    const contentNuevo = document.getElementById('tab-nuevo-content');
    const contentEquipos = document.getElementById('tab-equipos-content');
    
    if(contentExistente) contentExistente.style.display = (tab === 'existente') ? 'block' : 'none';
    if(contentNuevo) contentNuevo.style.display = (tab === 'nuevo') ? 'block' : 'none';
    if(contentEquipos) contentEquipos.style.display = (tab === 'equipos') ? 'block' : 'none';
    
    document.querySelectorAll('#add-player-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.id === `tab-btn-${tab}`) btn.classList.add('active');
    });
};

async function renderUsers() {
    let users = await API.getUsuarios();
    const search = document.getElementById('search-users')?.value.toLowerCase() || '';
    
    let admins = users.filter(u => String(u.role).toUpperCase() === 'ADMIN');
    
    if (search) {
        admins = admins.filter(u => 
            u.username.toLowerCase().includes(search) || 
            u.email.toLowerCase().includes(search)
        );
    }

    const tbody = document.querySelector('#global-users-table tbody');
    if(tbody) tbody.innerHTML = admins.map(u => `<tr><td><a href="javascript:void(0)" onclick="showPlayerStats('${u.id}')" style="text-decoration:none; color:var(--accent-color); font-weight:600;">${u.username}</a> 👑</td><td>${u.email}</td><td>${u.eloRating}</td><td>ADMIN</td><td><div style="display:flex; gap:5px;"><button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="showPlayerStats('${u.id}')"><i class="fa-solid fa-user-tag"></i> Ficha</button><button class="btn btn-secondary" style="padding:4px 8px;" onclick="openEditEloModal('${u.id}', '${u.username}', ${u.eloRating})">ELO</button><button class="btn" style="background:#dc2626; color:white; padding:4px 8px; border-radius:6px;" onclick="deleteUser('${u.id}', '${u.username}')"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>`).join('');
}

async function renderPlayersView() {
    let users = await API.getUsuarios();
    const search = document.getElementById('search-players')?.value.toLowerCase() || '';
    
    let players = users.filter(u => String(u.role).toUpperCase() !== 'ADMIN');
    
    if (search) {
        players = players.filter(u => 
            u.username.toLowerCase().includes(search) || 
            u.email.toLowerCase().includes(search)
        );
    }

    const tbody = document.querySelector('#global-players-table tbody');
    if(tbody) tbody.innerHTML = players.map(p => `<tr><td><a href="javascript:void(0)" onclick="showPlayerStats('${p.id}')" style="text-decoration:none; color:var(--accent-color); font-weight:600;">${p.username}</a></td><td>${p.email}</td><td>${p.eloRating}</td><td>${p.role || 'PLAYER'}</td><td><div style="display:flex; gap:5px;"><button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="showPlayerStats('${p.id}')"><i class="fa-solid fa-user-tag"></i> Ficha</button><button class="btn btn-secondary" style="padding:4px 8px;" onclick="openEditEloModal('${p.id}', '${p.username}', ${p.eloRating})">ELO</button><button class="btn" style="background:#dc2626; color:white; padding:4px 8px; border-radius:6px;" onclick="deleteUser('${p.id}', '${p.username}')"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>`).join('');
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

window.startTournament = async function(tId) { 
    const t = await API.getTorneo(tId);
    if (!t) return;

    if (t.sistemaJuego === 'EQUIPOS') {
        const inscRes = await fetchWithAuth(`${window.API_BASE}/torneos/${tId}/inscripciones`);
        const inscripciones = await inscRes.json();
        const teams = new Set(inscripciones.map(i => i.nombreEquipo).filter(name => name && name.trim() !== ""));
        if (teams.size < 2) {
            alert("Para un torneo por EQUIPOS necesitas al menos 2 equipos con nombre asignado.");
            return;
        }
    } else {
        const inscRes = await fetchWithAuth(`${window.API_BASE}/torneos/${tId}/inscripciones`);
        const inscripciones = await inscRes.json();
        if (inscripciones.length < 2) {
            alert("Necesitas al menos 2 jugadores para iniciar el torneo.");
            return;
        }
    }

    const res = await API.startTorneo(tId); 
    if (res) {
        renderTournamentDetail(tId);
    }
};
window.completeTournament = async function(id) { 
    if (confirm("¿Finalizar el torneo y actualizar rankings?")) { 
        await API.finalizarTorneo(id); 
        renderTournamentDetail(id); 
    } 
};
window.logout = function() { 
    localStorage.removeItem('jwt_token'); 
    localStorage.removeItem('currentUser'); 
    location.reload(); 
};

function connectWebSocket() {
    const wsUrl = window.API_BASE ? window.API_BASE.replace('/api', '') + '/ws-chess' : 'http://localhost:8080/ws-chess';
    const socket = new SockJS(wsUrl);
    const client = Stomp.over(socket);
    client.connect({}, () => {
        client.subscribe('/topic/notifications', () => { if(currentTournamentId) renderTournamentDetail(currentTournamentId); });
    });
}

window.toggleRoundsInput = function(val) {
    const groupRondas = document.getElementById('group-t-rondas');
    const groupTableros = document.getElementById('group-t-tableros');
    if (groupRondas) groupRondas.style.display = (val === 'SUIZO' || val === 'EQUIPOS') ? 'block' : 'none';
    if (groupTableros) groupTableros.style.display = (val === 'EQUIPOS') ? 'block' : 'none';
};

async function renderGlobalRanking() {
    const users = await API.getUsuarios();
    const sorted = [...users].sort((a, b) => (b.eloRating || 0) - (a.eloRating || 0));
    const tbody = document.querySelector('#global-ranking-table tbody');
    if (tbody) {
        tbody.innerHTML = sorted.map((u, i) => {
            let pos = `#${i + 1}`;
            let style = '';
            if(i === 0) { pos = '🥇 Oro'; style = 'background:rgba(251,191,36,0.15); border-left:5px solid #fbbf24; font-weight:bold;'; }
            else if(i === 1) { pos = '🥈 Plata'; style = 'background:rgba(148,163,184,0.15); border-left:5px solid #94a3b8;'; }
            else if(i === 2) { pos = '🥉 Bronce'; style = 'background:rgba(180,83,9,0.15); border-left:5px solid #b45309;'; }
            
            const isAdmin = String(u.role).toUpperCase() === 'ADMIN';
            const crown = isAdmin ? ' 👑' : '';
            
            return `<tr style="${style}">
                <td><div style="font-weight:700;">${pos}</div></td>
                <td><a href="javascript:void(0)" onclick="showPlayerStats('${u.id}')" style="text-decoration:none; color:var(--text-main); font-weight:700;">${u.username}${crown}</a></td>
                <td><span class="status-badge" style="background:${isAdmin?'#fef3c7':'#f1f5f9'}; color:${isAdmin?'#92400e':'#64748b'}; border:none; padding:2px 8px; font-size:11px;">${u.role || 'PLAYER'}</span></td>
                <td style="text-align:right; font-weight:800; color:var(--accent-color);">${u.eloRating}</td>
                <td style="text-align:right;">
                    <button class="btn btn-secondary" style="padding:5px 10px; font-size:0.8rem; border-radius:6px;" onclick="showPlayerStats('${u.id}')">
                        <i class="fa-solid fa-user-tag"></i> Ficha
                    </button>
                </td>
            </tr>`;
        }).join('');
    }
}

window.exportTournamentPDF = async function() {
    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) { alert("Error: Librería PDF no cargada"); return; }
        const doc = new jsPDF();
        const t = currentTournamentData;
        if (!t) return;

        const primaryColor = [139, 90, 43]; // #8b5a2b
        
        // ENCABEZADO
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("REPORTE OFICIAL DE TORNEO", 105, 20, { align: "center" });
        
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(t.nombre, 105, 30, { align: "center" });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Sistema: ${t.sistemaJuego} | Estado: ${t.estado} | Fecha: ${new Date().toLocaleDateString()}`, 105, 38, { align: "center" });
        
        // TABLA DE POSICIONES
        doc.setFontSize(14);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("Clasificación Final / Actual", 14, 50);
        
        doc.autoTable({
            html: '#standings-table',
            startY: 55,
            headStyles: { fillColor: primaryColor, textColor: 255 },
            styles: { fontSize: 8, cellPadding: 2 },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        let currentY = doc.lastAutoTable.finalY + 15;

        // CUADRO DE HONOR (SI ESTÁ FINALIZADO)
        if (t.estado === 'FINALIZADO') {
            const table = document.getElementById('standings-table');
            const rows = table?.querySelectorAll('tbody tr');
            if (rows && rows.length > 0) {
                doc.setFontSize(14);
                doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                doc.text("CUADRO DE HONOR (PODIUM)", 14, currentY);
                
                doc.setFontSize(11);
                // ORO
                doc.setTextColor(218, 165, 32); // GoldenRod
                doc.text(`1er Puesto (ORO): ${rows[0].cells[1].innerText}`, 20, currentY + 10);
                
                if (rows[1]) {
                    doc.setTextColor(169, 169, 169); // DarkGray (Plata)
                    doc.text(`2do Puesto (PLATA): ${rows[1].cells[1].innerText}`, 20, currentY + 18);
                }
                if (rows[2]) {
                    doc.setTextColor(139, 69, 19); // SaddleBrown (Bronce)
                    doc.text(`3er Puesto (BRONCE): ${rows[2].cells[1].innerText}`, 20, currentY + 26);
                }
                currentY += 40;
            }
        }

        // RESUMEN DE PARTIDAS (NUEVA SECCIÓN)
        const partidas = await API.getPartidas(t.id);
        if (partidas && partidas.length > 0) {
            if (currentY > 230) { doc.addPage(); currentY = 20; }
            doc.setFontSize(14);
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.text("Historial de Encuentros", 14, currentY);
            
            const matchRows = partidas.map(p => [
                `R${p.rondaNumero || 1}`,
                p.blancas?.username || 'BYE',
                p.negras?.username || 'BYE',
                p.resultado || 'Pendiente'
            ]);

            doc.autoTable({
                head: [['Ronda', 'Blancas', 'Negras', 'Resultado']],
                body: matchRows,
                startY: currentY + 5,
                headStyles: { fillColor: [71, 85, 105], textColor: 255 },
                styles: { fontSize: 8 }
            });
        }

        // PIE DE PÁGINA
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Digital Curator - ChessPro Management System | Página ${i} de ${pageCount}`, 105, 285, { align: "center" });
        }
        
        doc.save(`Reporte_${t.nombre.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error("Error al generar PDF:", error);
        alert("Error al generar el PDF técnico.");
    }
};

function initTheme() {
    const isDark = localStorage.getItem('dark_mode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-theme');
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }
}

window.toggleDarkMode = function() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('dark_mode', isDark);
};

// --- reCAPTCHA Management ---
// Widgets are initialized in index.html head to avoid timing issues

// Check if recaptcha fails to load
setTimeout(() => {
    if (typeof grecaptcha === 'undefined') {
        const status = document.getElementById('recaptcha-status-login');
        if (status) status.style.display = 'block';
    }
}, 5000);
// --- Stockfish Analysis Logic ---
let analysisBoard = null;
let analysisGame = new Chess();
let stockfishWorker = null;
let currentHistory = [];
let currentMoveIndex = -1;
let moveEvaluations = [];
let isAnalyzingFullGame = false;

window.initAnalysisBoard = function() {
    if (analysisBoard) return;
    analysisBoard = Chessboard('analysis-board', {
        draggable: true,
        position: 'start',
        pieceTheme: 'img/chesspieces/wikipedia/{piece}.png',
        onDrop: (source, target) => {
            let move = analysisGame.move({ from: source, to: target, promotion: 'q' });
            if (move === null) return 'snapback';
            
            if (move.flags.includes('c')) playChessSound('capture');
            else if (analysisGame.in_check()) playChessSound('check');
            else playChessSound('move');

            
            // Sync board to handle castling, en passant, and promotion visuals
            setTimeout(() => { analysisBoard.position(analysisGame.fen()); }, 100);
            
            currentHistory = analysisGame.history();
            currentMoveIndex = currentHistory.length - 1;
            moveEvaluations = new Array(currentHistory.length).fill(null);
            updateAnalysisUI();
        }
    });
};

window.resetAnalysisBoard = function() {
    if (!confirm("¿Reiniciar el tablero? Se perderá el progreso actual.")) return;
    analysisGame = new Chess();
    analysisBoard.position('start');
    currentHistory = [];
    currentMoveIndex = -1;
    moveEvaluations = [];
    lastExplorerFen = "";
    const nameEl = document.getElementById('opening-name');
    const candEl = document.getElementById('opening-candidates');
    if (nameEl) nameEl.textContent = "Buscando apertura...";
    if (candEl) candEl.innerHTML = "";
    
    const summary = document.getElementById('accuracy-summary');
    if (summary) summary.style.display = 'none';
    const reel = document.getElementById('best-moments-reel');
    if (reel) reel.style.display = 'none';
    updateAnalysisUI();
};

window.exportAnalysisPDF = async function() {
    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) { alert("Error: Librería PDF no cargada"); return; }
        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.setTextColor(139, 90, 43);
        doc.text("ANÁLISIS DE PARTIDA - DIGITAL CURATOR", 105, 20, { align: "center" });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Fecha: ${new Date().toLocaleString()}`, 105, 30, { align: "center" });
        
        const moveRows = [];
        for (let i = 0; i < currentHistory.length; i += 2) {
            moveRows.push([
                Math.floor(i / 2) + 1,
                currentHistory[i],
                currentHistory[i + 1] || '-'
            ]);
        }
        
        doc.autoTable({
            head: [['Ronda', 'Blancas', 'Negras']],
            body: moveRows,
            startY: 40,
            headStyles: { fillColor: [139, 90, 43] },
            styles: { halign: 'center' }
        });
        
        let finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Notación PGN Completa:", 14, finalY);
        
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        const pgnText = analysisGame.pgn();
        const splitPgn = doc.splitTextToSize(pgnText, 180);
        doc.text(splitPgn, 14, finalY + 7);
        
        doc.save("Analisis_Partida_ChessPro.pdf");
    } catch (e) {
        console.error(e);
        alert("Error al generar PDF.");
    }
};

window.loadPGN = function() {
    const pgn = document.getElementById('pgn-input').value;
    if (!pgn) return;
    analysisGame = new Chess();
    if (analysisGame.load_pgn(pgn)) {
        currentHistory = analysisGame.history();
        currentMoveIndex = 0; // Start at the beginning, not the end
        moveEvaluations = new Array(currentHistory.length).fill(null);
        analysisBoard.position('start');
        playChessSound('move');

        // Reset all accuracy UI elements
        const summary = document.getElementById('accuracy-summary');
        if (summary) summary.style.display = 'none';
        const reel = document.getElementById('best-moments-reel');
        if (reel) reel.style.display = 'none';
        const accEl = document.getElementById('accuracy-percent');
        if (accEl) accEl.textContent = '0%';
        const acplEl = document.getElementById('stat-acpl');
        if (acplEl) acplEl.textContent = '---';
        const levelEl = document.getElementById('elo-level-label');
        if (levelEl) levelEl.textContent = '';
        const eloMain = document.getElementById('performance-elo-main');
        if (eloMain) eloMain.textContent = '---';
        ['stat-brilliant','stat-best','stat-excellent','stat-good','stat-inaccuracy','stat-mistake','stat-blunder'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });

        updateAnalysisUI();
        // Iniciar análisis automáticamente al cargar
        setTimeout(() => {
            if (window.runFullAnalysis) window.runFullAnalysis();
        }, 500);
    } else {
        alert('Error: PGN no válido.');
    }
};

window.moveAnalysis = function(dir) {
    if (dir === 1 && currentMoveIndex < currentHistory.length - 1) {
        currentMoveIndex++;
    } else if (dir === -1 && currentMoveIndex >= 0) {
        currentMoveIndex--;
    } else if (dir === -1 && currentMoveIndex === -1) {
        return;
    }

    const tempGame = new Chess();
    let lastMove = null;
    for (let i = 0; i <= currentMoveIndex; i++) {
        lastMove = tempGame.move(currentHistory[i]);
    }
    
    if (lastMove) {
        if (lastMove.flags.includes('c')) playChessSound('capture');
        else if (tempGame.in_check()) playChessSound('check');
        else playChessSound('move');
    }

    // Freeze main-content scroll before board update to prevent page jump
    const mainContent = document.querySelector('.main-content');
    const savedScrollTop = mainContent ? mainContent.scrollTop : 0;
    
    analysisBoard.position(tempGame.fen(), false); // false = no animation on navigation
    analysisGame = tempGame;
    updateAnalysisUI();
    
    // Restore scroll position after DOM updates
    if (mainContent) mainContent.scrollTop = savedScrollTop;
};

window.exportAnalysisPDF = function() {
    if (currentHistory.length === 0) {
        alert("No hay jugadas para analizar.");
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) { alert("Error: Librería jsPDF no cargada"); return; }
        const doc = new jsPDF();
        const now = new Date();

        // Estilos
        const primaryColor = [139, 90, 43]; // Marrón ajedrez
        const darkColor = [45, 44, 42];

        // TÍTULO
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("REPORTE DE ANÁLISIS TÁCTICO", 105, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado el: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 105, 28, { align: "center" });

        // INFORMACIÓN DE LA PARTIDA
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.5);
        doc.line(20, 35, 190, 35);

        doc.setFontSize(14);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        const opening = document.getElementById('opening-name')?.textContent || 'Apertura Desconocida';
        doc.text(`Apertura: ${opening}`, 20, 45);

        const accuracy = document.getElementById('accuracy-percent')?.textContent || '0%';
        doc.text(`Precisión Estimada: ${accuracy}`, 20, 55);

        // TABLA DE MOVIMIENTOS
        const movesData = [];
        for (let i = 0; i < currentHistory.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const wMove = currentHistory[i];
            const bMove = currentHistory[i + 1] || "---";
            
            const wEval = moveEvaluations[i];
            const bEval = moveEvaluations[i + 1];

            const getEvalStr = (ev) => {
                if (!ev) return "";
                const map = {
                    'brilliant': { s: '!!', n: 'Brillante' },
                    'best': { s: '!', n: 'Mejor' },
                    'excellent': { s: '!', n: 'Excelente' },
                    'inaccuracy': { s: '?!', n: 'Imprecisión' },
                    'mistake': { s: '?', n: 'Error' },
                    'blunder': { s: '??', n: 'Error Grave' }
                };
                const info = map[ev.icon] || { s: '', n: '' };
                const evalVal = (ev.diff > 0 ? '+' : '') + ev.diff.toFixed(2);
                return `${info.s} ${info.n} (${evalVal})`;
            };

            movesData.push([
                moveNum,
                `${wMove} ${getEvalStr(wEval)}`,
                `${bMove} ${getEvalStr(bEval)}`
            ]);
        }

        doc.autoTable({
            startY: 65,
            head: [['#', 'Blancas', 'Negras']],
            body: movesData,
            headStyles: { fillColor: primaryColor, textColor: 255 },
            alternateRowStyles: { fillColor: [245, 245, 240] },
            styles: { fontSize: 9, cellPadding: 3 }
        });

        // PGN RAW DATA (AL FINAL)
        let finalY = doc.lastAutoTable.finalY + 15;
        if (finalY > 250) { doc.addPage(); finalY = 20; }

        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("Notación PGN Completa", 20, finalY);

        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        const pgnText = doc.splitTextToSize(analysisGame.pgn(), 170);
        doc.text(pgnText, 20, finalY + 10);

        doc.save(`Analisis_Partida_${now.getTime()}.pdf`);

    } catch (err) {
        console.error("Error al generar PDF:", err);
        alert("No se pudo generar el reporte PDF: " + err.message);
    }
};

window.downloadPGN = function() {
    if (currentHistory.length === 0) {
        alert("No hay jugadas para exportar.");
        return;
    }

    let pgn = analysisGame.pgn();
    const now = new Date();
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Partida_${now.getTime()}.pgn`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

function updateAnalysisUI() {
    document.getElementById('best-move').textContent = 'Análisis listo...';
    
    // Update PGN text area with current game state
    const pgnArea = document.getElementById('pgn-input');
    if (pgnArea && document.activeElement !== pgnArea) {
        pgnArea.value = analysisGame.pgn();
    }
    
    // Render move history — build all HTML in one shot to avoid incremental reflows
    const moveList = document.getElementById('analysis-move-list');
    if (moveList) {
        const savedMoveScroll = moveList.scrollTop; // preserve inner scroll
        const isDark = document.body.classList.contains('dark-theme');
        const highlight = isDark ? 'rgba(255,255,255,0.15)' : '#fef3c7';
        
        const parts = [];
        let activeRowIndex = -1;
        
        for (let i = 0; i < currentHistory.length; i += 2) {
            const roundNum = Math.floor(i / 2) + 1;
            const whiteMove = currentHistory[i] || '';
            const blackMove = currentHistory[i + 1] || '';
            
            const wEval = moveEvaluations[i];
            const bEval = moveEvaluations[i + 1];
            
            const wIcon = wEval && wEval.icon
                ? `<img src="img/${wEval.icon}.svg" style="height:14px;vertical-align:middle;margin-left:4px;" title="${wEval.icon} (${wEval.diff > 0 ? '+' : ''}${wEval.diff.toFixed(2)})">`
                : '';
            const bIcon = bEval && bEval.icon
                ? `<img src="img/${bEval.icon}.svg" style="height:14px;vertical-align:middle;margin-left:4px;" title="${bEval.icon} (${bEval.diff > 0 ? '+' : ''}${bEval.diff.toFixed(2)})">`
                : '';
            
            const wActive = i === currentMoveIndex;
            const bActive = i + 1 === currentMoveIndex;
            if (wActive || bActive) activeRowIndex = parts.length + (wActive ? 1 : 2);
            
            parts.push(
                `<div style="color:var(--text-muted);font-weight:bold;line-height:1.8;">${roundNum}.</div>`,
                `<div data-mi="${i}" style="padding:2px 5px;background:${wActive ? highlight : 'transparent'};border-radius:4px;color:var(--text-main);cursor:pointer;" onclick="moveAnalysisAbsolute(${i})">${whiteMove}${wIcon}</div>`,
                `<div data-mi="${i+1}" style="padding:2px 5px;background:${bActive ? highlight : 'transparent'};border-radius:4px;color:var(--text-main);cursor:pointer;" onclick="moveAnalysisAbsolute(${i+1})">${blackMove}${bIcon}</div>`
            );
        }
        
        // Single DOM write — no incremental innerHTML concatenation
        moveList.innerHTML = parts.join('');
        
        // Scroll only the move-list box (not the page) to keep active move visible
        const activeEl = moveList.querySelector(`[data-mi="${currentMoveIndex}"]`);
        if (activeEl) {
            const ch = moveList.clientHeight;
            const top = activeEl.offsetTop;
            const h = activeEl.clientHeight;
            if (top < moveList.scrollTop || top + h > moveList.scrollTop + ch) {
                moveList.scrollTop = top - ch / 2;
            }
        } else {
            moveList.scrollTop = savedMoveScroll;
        }
    }

    updateOpeningExplorer(analysisGame.fen());
}

window.startAnalysis = function() {
    if (!stockfishWorker) {
        stockfishWorker = new Worker('js/stockfish.js');
    }
    
    document.getElementById('best-move').textContent = 'Analizando...';
    
    stockfishWorker.onmessage = function(event) {
        const line = event.data;
        if (line.includes('info depth') && line.includes('cp')) {
            const cpMatch = line.match(/cp (-?\d+)/);
            if (cpMatch) {
                const cp = parseInt(cpMatch[1]) / 100.0;
                updateEvalBar(cp);
            }
        } else if (line.includes('bestmove')) {
            const move = line.split(' ')[1];
            document.getElementById('best-move').textContent = 'Mejor movimiento: ' + move;
        }
    };

    stockfishWorker.postMessage('uci');
    stockfishWorker.postMessage('ucinewgame');
    stockfishWorker.postMessage('position fen ' + analysisGame.fen());
    stockfishWorker.postMessage('go depth 15');
};

window.moveAnalysisAbsolute = function(index) {
    if (index < 0 || index >= currentHistory.length) return;
    currentMoveIndex = index;
    const tempGame = new Chess();
    let lastMove = null;
    for (let i = 0; i <= currentMoveIndex; i++) {
        lastMove = tempGame.move(currentHistory[i]);
    }
    
    if (lastMove) {
        if (lastMove.flags.includes('c')) playChessSound('capture');
        else if (tempGame.in_check()) playChessSound('check');
        else playChessSound('move');
    }

    // Freeze main-content scroll before board re-render
    const mainContent = document.querySelector('.main-content');
    const savedScrollTop = mainContent ? mainContent.scrollTop : 0;

    analysisBoard.position(tempGame.fen(), false); // false = instant, no slide animation
    analysisGame = tempGame;
    updateAnalysisUI();
    
    // Restore page scroll position immediately
    if (mainContent) mainContent.scrollTop = savedScrollTop;
};

window.runFullAnalysis = async function() {
    if (isAnalyzingFullGame) return;
    if (currentHistory.length === 0) {
        alert("No hay movimientos para analizar.");
        return;
    }
    
    isAnalyzingFullGame = true;
    moveEvaluations = new Array(currentHistory.length).fill(null);
    updateAnalysisUI();
    
    const bestMoveSpan = document.getElementById('best-move');
    if (bestMoveSpan) {
        bestMoveSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analizando partida... <span id="analysis-progress">0</span>%';
    }
    
    if (!stockfishWorker) {
        stockfishWorker = new Worker('js/stockfish.js');
    }
    
    const analyzeFen = (fen, depth) => {
        return new Promise(resolve => {
            let lastCp = 0;
            let lastMate = null;
            let resolved = false;
            let currentDepth = 0;
            
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    stockfishWorker.removeEventListener('message', handler);
                    resolve(lastCp);
                }
            }, 8000); // Increased safety timeout

            const handler = function(event) {
                const line = event.data;
                if (line.includes('info depth') && line.includes('score')) {
                    const depthMatch = line.match(/depth (\d+)/);
                    if (depthMatch) currentDepth = parseInt(depthMatch[1]);
                    
                    const cpMatch = line.match(/cp (-?\d+)/);
                    const mateMatch = line.match(/mate (-?\d+)/);
                    
                    // Only update if we are getting a deeper analysis or it's our first data
                    if (cpMatch) {
                        lastCp = parseInt(cpMatch[1]) / 100.0;
                        lastMate = null;
                    }
                    if (mateMatch) {
                        lastMate = parseInt(mateMatch[1]);
                    }
                } else if (line.includes('bestmove')) {
                    if (resolved) return;
                    
                    // If we haven't reached depth, but Stockfish finished (forced move), it's okay
                    resolved = true;
                    clearTimeout(timeout);
                    stockfishWorker.removeEventListener('message', handler);
                    
                    if (lastMate !== null) {
                        lastCp = lastMate > 0 ? 100 - lastMate : -100 - lastMate;
                    }
                    resolve(lastCp);
                }
            };
            stockfishWorker.addEventListener('message', handler);
            stockfishWorker.postMessage('position fen ' + fen);
            stockfishWorker.postMessage('go depth ' + depth);
        });
    };
    
    const tempGame = new Chess();
    
    // Consistency Fix: Analyze starting position to get a proper baseline
    let prevEval = 0.0;
    try {
        prevEval = await analyzeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 14);
    } catch(e) {
        prevEval = 0.2;
    }
    
    // Consistency Fix: Clear hash before starting
    stockfishWorker.postMessage('setoption name Hash value 32');
    stockfishWorker.postMessage('setoption name Clear Hash');
    stockfishWorker.postMessage('ucinewgame');
    
    for (let i = 0; i < currentHistory.length; i++) {
        const progress = Math.round(((i + 1) / currentHistory.length) * 100);
        const progEl = document.getElementById('analysis-progress');
        if (progEl) progEl.textContent = progress;

        tempGame.move(currentHistory[i]);
        let currentEval = await analyzeFen(tempGame.fen(), 14); // Más profundidad para evitar falsos positivos
        
        const isWhiteToMove = tempGame.turn() === 'w';
        let normalizedEval = isWhiteToMove ? currentEval : -currentEval;
        
        // CPL = centipawn loss (in pawns). Positive prevEval = advantage for player who moved.
        let cpl = 0; // centipawn loss in pawn units
        if (i % 2 === 0) { // White just moved
            // prevEval was from White's perspective; after White's move, new normalized eval
            cpl = Math.max(0, prevEval - normalizedEval); // loss of advantage
        } else { // Black just moved
            cpl = Math.max(0, -prevEval - (-normalizedEval)); // loss from Black's perspective
        }
        const cplCp = cpl * 100; // convert to centipawns

        let category = 'book';
        let icon = 'book';
        
        if (i < 8) { 
            // Primeros 4 movimientos por bando = teoría de apertura (Book)
            category = 'book'; icon = 'book';
        } else if (cplCp > 250) { // Blunder (??) > 2.5 pawns
            category = 'blunder'; icon = 'blunder';
        } else if (cplCp > 100) { // Mistake (?) 1 pawn
            category = 'mistake'; icon = 'mistake';
        } else if (cplCp > 50) { // Inaccuracy (?!) 0.5 pawn
            category = 'inaccuracy'; icon = 'inaccuracy';
        } else if (cplCp > 20) { // Good
            category = 'good'; icon = 'good';
        } else if (cplCp > 10) { // Excellent
            category = 'excellent'; icon = 'excellent';
        } else if (cpl < -0.5 && prevEval < -0.5) {
            // Se recuperó de una mala posición de forma brillante
            category = 'brilliant'; icon = 'brilliant';
        } else {
            category = 'best'; icon = 'best';
        }
        
        moveEvaluations[i] = { icon: icon, diff: -cpl, cpl: cplCp };
        prevEval = normalizedEval;
        
        if (bestMoveSpan) {
            bestMoveSpan.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analizando partida (${i+1}/${currentHistory.length})...`;
        }
        updateAnalysisUI(); 
    }
    
    if (bestMoveSpan) {
        bestMoveSpan.innerHTML = `<i class="fa-solid fa-check"></i> Análisis Completado`;
    }
    isAnalyzingFullGame = false;
    
    // Restore the worker
    updateAccuracySummary();
    playChessSound('victory');
    startAnalysis();
};

function updateEvalBar(cp) {
    const val = document.getElementById('eval-value');
    const bar = document.getElementById('eval-bar');
    val.textContent = (cp > 0 ? '+' : '') + cp.toFixed(2);
    
    // 0 = 50%, +5 = 100%, -5 = 0%
    let percentage = 50 + (cp * 10);
    if (percentage > 100) percentage = 100;
    if (percentage < 0) percentage = 0;
    bar.style.width = percentage + '%';
}

let lastExplorerFen = "";
let lastKnownOpening = "";
const openingCache = {}; // Cache to avoid redundant API calls

async function updateOpeningExplorer(fen) {
    const cleanFen = fen.split(' ').slice(0, 4).join(' ');
    if (cleanFen === lastExplorerFen) return;
    lastExplorerFen = cleanFen;

    const nameEl = document.getElementById('opening-name');
    const candEl = document.getElementById('opening-candidates');
    if (!nameEl || !candEl) return;

    // Check Cache
    if (openingCache[cleanFen]) {
        renderOpeningData(openingCache[cleanFen]);
        return;
    }

    try {
        // LOCAL OPENINGS DICTIONARY (Bypass Lichess 401 error)
        const LOCAL_OPENINGS = {
            "e4": "Apertura del Peón de Rey",
            "d4": "Apertura del Peón de Dama",
            "c4": "Apertura Inglesa",
            "Nf3": "Apertura Réti",
            "e4 e5": "Juego Abierto",
            "e4 c5": "Defensa Siciliana",
            "e4 e6": "Defensa Francesa",
            "e4 c6": "Defensa Caro-Kann",
            "e4 d6": "Defensa Pirc",
            "e4 d5": "Defensa Escandinava",
            "e4 Nf6": "Defensa Alekhine",
            "d4 d5": "Juego Cerrado",
            "d4 Nf6": "Defensa India",
            "d4 Nf6 c4 e6": "Defensa Nimzo/Bogo-India",
            "d4 Nf6 c4 g6": "Defensa India de Rey / Grünfeld",
            "e4 e5 Nf3 Nc6": "Apertura de Caballo Rey",
            "e4 e5 Nf3 Nc6 Bb5": "Apertura Española (Ruy López)",
            "e4 e5 Nf3 Nc6 Bc4": "Apertura Italiana",
            "e4 e5 Nf3 Nc6 d4": "Apertura Escocesa",
            "e4 e5 Nf3 Nf6": "Defensa Petrov",
            "d4 d5 c4": "Gambito de Dama",
            "d4 d5 c4 e6": "Gambito de Dama Rehusado",
            "d4 d5 c4 c6": "Defensa Eslava",
            "d4 d5 c4 dxc4": "Gambito de Dama Aceptado",
            "e4 c5 Nf3 d6": "Siciliana Clásica",
            "e4 c5 Nf3 e6": "Siciliana Paulsen/Taimanov",
            "e4 c5 Nf3 Nc6": "Siciliana Pelikan/Sveshnikov",
            "f4": "Apertura Bird",
            "b3": "Apertura Larsen",
            "g3": "Apertura Benko"
        };

        // Determine opening from history
        let bestMatch = null;
        let currentSeq = "";
        for (let i = 0; i < Math.min(currentHistory.length, 10); i++) {
            currentSeq = currentSeq ? currentSeq + " " + currentHistory[i] : currentHistory[i];
            if (LOCAL_OPENINGS[currentSeq]) {
                bestMatch = LOCAL_OPENINGS[currentSeq];
            }
        }

        if (bestMatch) {
            const data = { opening: { name: bestMatch }, moves: [], white: 33, draws: 34, black: 33 };
            openingCache[cleanFen] = data;
            renderOpeningData(data);
        } else {
            nameEl.textContent = lastKnownOpening ? lastKnownOpening + " (Var.)" : "Teoría desconocida";
        }
    } catch (err) {
        console.error("Local Explorer Error:", err);
    }
}

function renderOpeningData(data) {
    const nameEl = document.getElementById('opening-name');
    const candEl = document.getElementById('opening-candidates');
    const theoryContainer = document.getElementById('theory-container');
    const theoryPercent = document.getElementById('theory-percent');
    const theoryBar = document.getElementById('theory-bar');

    if (data.opening) {
        nameEl.textContent = data.opening.name;
        lastKnownOpening = data.opening.name;
    }

    if (theoryContainer && theoryPercent && theoryBar) {
        const totalGames = (data.white || 0) + (data.draws || 0) + (data.black || 0);
        let percent = 0;
        if (totalGames > 0) {
            percent = Math.min(100, Math.round((Math.log10(totalGames + 1) / 5) * 100));
        }
        theoryContainer.style.display = 'block';
        theoryPercent.textContent = percent + '%';
        theoryBar.style.width = percent + '%';
    }

    if (data.moves && data.moves.length > 0) {
        candEl.innerHTML = data.moves.slice(0, 3).map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; background: rgba(139, 90, 43, 0.05); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(139, 90, 43, 0.1);">
                <span style="font-weight: 700; color: var(--accent-color);">${m.san}</span>
                <div style="display:flex; gap:8px; align-items:center;">
                    <span style="color: #16a34a; font-weight:700;">${Math.round((m.white/(m.white+m.draws+m.black))*100)}%</span>
                    <span style="color: var(--text-muted); font-size: 0.7rem;">${Math.round((m.draws/(m.white+m.draws+m.black))*100)}%</span>
                    <span style="color: #ef4444; font-weight:700;">${Math.round((m.black/(m.white+m.draws+m.black))*100)}%</span>
                </div>
            </div>
        `).join('');
    }
}



function triggerConfetti() {
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#8b5a2b', '#fbbf24', '#16a34a']
        });
    }
}

function updateAccuracySummary() {
    const counts = {
        brilliant: 0, best: 0, excellent: 0, good: 0,
        inaccuracy: 0, mistake: 0, blunder: 0, book: 0
    };
    
    let totalCpl = 0;      // sum of centipawn losses
    let movesToCount = 0;

    moveEvaluations.forEach(ev => {
        if (!ev || ev.icon === 'book') return; // Skip book moves for stats
        counts[ev.icon] = (counts[ev.icon] || 0) + 1;
        totalCpl += (ev.cpl || 0);
        movesToCount++;
    });

    if (movesToCount === 0) return;
    
    // ACPL = Average Centipawn Loss
    const acpl = totalCpl / movesToCount;
    
    // Accuracy % - fórmula exponencial calibrada (ACPL 50 -> ~86%, 100 -> ~74%)
    let avgAccuracy = Math.max(0, Math.min(100, 100 * Math.exp(-0.003 * acpl)));

    // ELO Estimado basado en ACPL
    let predictedElo;
    if (acpl < 20) predictedElo = 2600 + (20 - acpl) * 15;
    else if (acpl < 40) predictedElo = 2600 - ((acpl - 20) / 20) * 400;
    else if (acpl < 70) predictedElo = 2200 - ((acpl - 40) / 30) * 400;
    else if (acpl < 100) predictedElo = 1800 - ((acpl - 70) / 30) * 300;
    else predictedElo = 1500 - ((acpl - 100) / 50) * 400;
    predictedElo = Math.max(400, Math.round(predictedElo));
    // Also count book separately
    moveEvaluations.forEach(ev => { if (ev && ev.icon === 'book') counts.book++; });



    // Best Moments Logic
    const bestMoments = [];
    moveEvaluations.forEach((ev, idx) => {
        if (ev && (ev.icon === 'brilliant' || ev.icon === 'best' || ev.icon === 'great_find' || ev.icon === 'excellent')) {
            bestMoments.push({ idx, ev, san: currentHistory[idx] });
        }
    });

    const reel = document.getElementById('best-moments-reel');
    const reelList = document.getElementById('best-moments-list');
    if (reel && reelList) {
        if (bestMoments.length > 0) {
            reel.style.display = 'block';
            reelList.innerHTML = bestMoments.map(m => `
                <div onclick="moveAnalysisAbsolute(${m.idx})" style="flex-shrink: 0; width: 80px; background: rgba(255,255,255,0.1); border: 1px solid ${m.ev.icon === 'brilliant' ? '#fbbf24' : 'rgba(255,255,255,0.2)'}; padding: 8px; border-radius: 8px; cursor: pointer; text-align: center; transition: transform 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                    <img src="img/${m.ev.icon}.svg" style="height: 20px; margin-bottom: 4px;">
                    <div style="font-weight: 800; font-size: 0.9rem; color: white;">${m.san}</div>
                    <div style="font-size: 0.6rem; opacity: 0.7; text-transform: uppercase;">Mov. ${Math.floor(m.idx/2)+1}</div>
                </div>
            `).join('');
            
            // Si hay jugadas brillantes o muy alta precisión, lanzamos confeti
            if (bestMoments.some(m => m.ev.icon === 'brilliant') || avgAccuracy > 90) {
                triggerConfetti();
            }
        } else {
            reel.style.display = 'none';
        }
    }

    // Phase Analysis (Mistakes/Blunders per phase)
    const phases = {
        opening: { moves: 0, bad: 0 },
        middle: { moves: 0, bad: 0 },
        endgame: { moves: 0, bad: 0 }
    };

    moveEvaluations.forEach((ev, idx) => {
        if (!ev) return;
        let phase = 'endgame';
        if (idx < 20) phase = 'opening';
        else if (idx < 60) phase = 'middle';

        phases[phase].moves++;
        if (ev.icon === 'mistake' || ev.icon === 'blunder' || ev.icon === 'inaccuracy') {
            phases[phase].bad++;
        }
    });

    const getPhaseColor = (p) => {
        if (p.moves === 0) return 'rgba(0,0,0,0.2)';
        const ratio = p.bad / p.moves;
        if (ratio > 0.4) return '#ef4444'; // Red (Danger)
        if (ratio > 0.2) return '#f59e0b'; // Orange (Warning)
        return '#16a34a'; // Green (Safe)
    };

    const summary = document.getElementById('accuracy-summary');
    if (summary) {
        summary.style.display = 'block';
        document.getElementById('accuracy-percent').textContent = avgAccuracy.toFixed(1) + '%';
        
        const eloMain = document.getElementById('performance-elo-main');
        const eloFooter = document.getElementById('performance-elo-footer');
        if (eloMain) eloMain.textContent = predictedElo + ' ELO';
        if (eloFooter) eloFooter.textContent = predictedElo + ' ELO';
        
        document.getElementById('stat-brilliant').textContent = counts.brilliant || 0;
        document.getElementById('stat-best').textContent = counts.best || 0;
        document.getElementById('stat-excellent').textContent = counts.excellent || 0;
        document.getElementById('stat-good').textContent = counts.good || 0;
        document.getElementById('stat-inaccuracy').textContent = counts.inaccuracy || 0;
        document.getElementById('stat-mistake').textContent = counts.mistake || 0;
        document.getElementById('stat-blunder').textContent = counts.blunder || 0;
        
        const acplEl = document.getElementById('stat-acpl');
        if (acplEl) acplEl.textContent = acpl.toFixed(1) + ' cp';
        
        const levelLabel = document.getElementById('elo-level-label');
        if (levelLabel) {
            let label = '';
            if      (predictedElo >= 2600) label = '♟ Gran Maestro';
            else if (predictedElo >= 2400) label = '♟ Maestro Internacional';
            else if (predictedElo >= 2200) label = '♟ Maestro FIDE';
            else if (predictedElo >= 1800) label = '⚡ Experto / Candidato';
            else if (predictedElo >= 1500) label = '📊 Avanzado';
            else if (predictedElo >= 1200) label = '📈 Intermedio';
            else if (predictedElo >= 900)  label = '🌱 Principiante Avanzado';
            else                           label = '🔰 Principiante';
            levelLabel.textContent = label;
        }

        // Update Heatmap colors
        document.getElementById('phase-opening').style.background = getPhaseColor(phases.opening);
        document.getElementById('phase-middle').style.background = getPhaseColor(phases.middle);
        document.getElementById('phase-endgame').style.background = getPhaseColor(phases.endgame);
    }
}

// --- Saved Analysis Logic ---
window.saveAnalysis = function() {
    if (currentHistory.length === 0) {
        alert("No hay jugadas para guardar.");
        return;
    }
    const name = prompt("Nombre para este análisis:", `Análisis ${new Date().toLocaleString()}`);
    if (!name) return;

    const analysisData = {
        id: Date.now(),
        name: name,
        pgn: analysisGame.pgn(),
        fen: analysisGame.fen(),
        evaluations: moveEvaluations,
        timestamp: new Date().toISOString()
    };

    let saved = JSON.parse(localStorage.getItem('chess_analyses') || '[]');
    saved.unshift(analysisData);
    localStorage.setItem('chess_analyses', JSON.stringify(saved));
    
    renderSavedAnalysisList();
    alert("Análisis guardado correctamente.");
};

window.renderSavedAnalysisList = function() {
    const container = document.getElementById('saved-analyses-list');
    if (!container) return;

    const saved = JSON.parse(localStorage.getItem('chess_analyses') || '[]');
    if (saved.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fa-solid fa-folder-open" style="font-size: 2rem; display: block; margin-bottom: 10px; opacity: 0.3;"></i>
                Aún no has guardado ninguna partida.
            </div>`;
        return;
    }

    container.innerHTML = saved.map(item => `
        <div class="card" style="padding: 15px; border: 1px solid var(--accent-light); transition: transform 0.2s; cursor: default;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <h4 style="margin: 0; color: var(--accent-color); font-size: 1rem;">${item.name}</h4>
                <button class="btn" style="padding: 2px 6px; color: #ef4444; background:none;" onclick="deleteSavedAnalysis(${item.id})">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 10px;">${new Date(item.timestamp).toLocaleString()}</p>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary" style="flex: 1; font-size: 0.8rem; padding: 6px;" onclick="loadSavedAnalysis(${item.id})">
                    <i class="fa-solid fa-folder-open"></i> Cargar
                </button>
            </div>
        </div>
    `).join('');
};

window.loadSavedAnalysis = function(id) {
    const saved = JSON.parse(localStorage.getItem('chess_analyses') || '[]');
    const item = saved.find(x => x.id === id);
    if (!item) return;

    if (!confirm(`¿Cargar "${item.name}"? Se perderá el análisis actual.`)) return;

    analysisGame = new Chess();
    if (analysisGame.load_pgn(item.pgn)) {
        currentHistory = analysisGame.history();
        currentMoveIndex = currentHistory.length - 1;
        moveEvaluations = item.evaluations || new Array(currentHistory.length).fill(null);
        analysisBoard.position(analysisGame.fen());
        updateAnalysisUI();
        updateAccuracySummary();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.deleteSavedAnalysis = function(id) {
    if (!confirm("¿Eliminar este análisis permanentemente?")) return;
    let saved = JSON.parse(localStorage.getItem('chess_analyses') || '[]');
    saved = saved.filter(x => x.id !== id);
    localStorage.setItem('chess_analyses', JSON.stringify(saved));
    renderSavedAnalysisList();
};

// Hook into navigation to init board
// La lógica de showView ha sido consolidada arriba

function initAchievementManagement() {
    const form = document.getElementById('form-grant-achievement');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('grant-achievement-userid').value;
            const data = {
                name: document.getElementById('grant-achievement-name').value,
                description: document.getElementById('grant-achievement-desc').value,
                icon: document.getElementById('grant-achievement-icon').value
            };

            const res = await API.grantAchievement(userId, data);
            if (res) {
                alert('¡Logro otorgado con éxito!');
                closeModal('grant-achievement-modal');
                form.reset();
                showPlayerStats(userId); // Recargar
            } else {
                alert('Error al otorgar el logro.');
            }
        });
    }
}

window.confirmDeleteAchievement = async function(achievementId, userId) {
    if (confirm('¿Estás seguro de que quieres eliminar este logro?')) {
        const res = await API.deleteAchievement(achievementId);
        if (res) {
            showPlayerStats(userId); // Recargar
        } else {
            alert('Error al eliminar el logro.');
        }
    }
};

window.toggleSounds = function() {
    const enabled = document.getElementById('sound-toggle').checked;
    localStorage.setItem('chess_sounds_enabled', enabled);
};

window.togglePassword = function(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
};

// Las funciones de toggle ya están definidas arriba

const chessSounds = {
    move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
    capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
    check: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3'),
    victory: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3')
};

window.playChessSound = function(type) {
    if (localStorage.getItem('chess_sounds_enabled') === 'false') return;
    const sound = chessSounds[type];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
};

// TEAMS MANAGEMENT
async function renderTeamsManagementView() {
    const container = document.getElementById('global-teams-list');
    if (!container) return;

    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando equipos...</div>';

    try {
        const users = await API.getUsuarios();
        const players = users.filter(u => String(u.role).toUpperCase() !== 'ADMIN');
        
        const teams = {};
        players.forEach(p => {
            const tName = p.nombreEquipo || 'Sin Equipo';
            if (!teams[tName]) teams[tName] = { name: tName, members: [], eloSum: 0 };
            teams[tName].members.push(p);
            teams[tName].eloSum += (p.eloRating || 0);
        });

        const teamArray = Object.values(teams).sort((a, b) => b.members.length - a.members.length);
        
        // Find players without team and move to front if desired, but here we'll create a special card
        const noTeam = teams['Sin Equipo'] || { name: 'Sin Equipo', members: [], eloSum: 0 };
        const otherTeams = teamArray.filter(t => t.name !== 'Sin Equipo');

        const totalTeamsStat = document.getElementById('stat-total-teams');
        if(totalTeamsStat) totalTeamsStat.textContent = otherTeams.length;

        let html = '';
        
        // Restore Free Agents Section
        if (noTeam.members.length > 0) {
            html += `
                <div class="card" style="grid-column: 1 / -1; border-top: 6px solid var(--accent-color); background: linear-gradient(135deg, var(--surface-card) 0%, var(--accent-light) 100%); padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-md);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <div>
                            <h3 style="margin:0; color: var(--accent-color); font-size: 1.3rem;"><i class="fa-solid fa-user-tag"></i> Jugadores Agentes Libres</h3>
                            <p style="margin:5px 0 0; color: var(--text-muted); font-size: 0.85rem;">Jugadores que aún no han sido asignados a un club.</p>
                        </div>
                        <span class="status-badge" style="background:var(--accent-light); color:var(--accent-color); font-weight:700;">${noTeam.members.length} Disponibles</span>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:10px;">
                        ${noTeam.members.map(m => `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-color); padding:10px; border-radius:8px; border: 1px solid var(--accent-light);">
                                <div>
                                    <div style="font-weight:700; font-size:0.9rem;">${m.username}</div>
                                    <div style="font-size:0.7rem; color:var(--accent-color);">ELO: ${m.eloRating}</div>
                                </div>
                                <button class="btn admin-only" style="padding:4px; background:var(--accent-light); color:var(--accent-color); border:none;" onclick="openModal('create-team-modal')" title="Asignar a equipo">
                                    <i class="fa-solid fa-plus"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        }
        
        html += otherTeams.map(team => {
            const avgElo = Math.round(team.eloSum / (team.members.length || 1));
            return `
                <div class="card" style="border-top: 4px solid var(--accent-color); background: var(--surface-card); padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1.5rem;">
                        <div>
                            <h4 style="margin:0; color: var(--accent-color); font-size: 1.25rem;">${team.name}</h4>
                            <div style="font-size:0.85rem; color:var(--text-muted); margin-top:5px;">
                                <i class="fa-solid fa-users"></i> ${team.members.length} Jugadores Registrados
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size: 1.25rem; font-weight:800; color:var(--text-main);">${avgElo}</div>
                            <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">ELO PROMEDIO</div>
                        </div>
                    </div>
                    
                    <div style="margin: 1rem 0; border-top: 1px solid var(--accent-light); padding-top: 1rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: var(--accent-color); margin-bottom: 10px; text-transform: uppercase;">Miembros del Equipo</div>
                        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 5px;">
                            ${team.members.map(m => `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-color); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--accent-light);">
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.85rem;">${m.username}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">ELO: ${m.eloRating}</div>
                                    </div>
                                    <button class="btn admin-only" style="padding: 4px 8px; background: rgba(220, 38, 38, 0.1); color: #dc2626; border: none; font-size: 0.75rem;" onclick="removePlayerFromTeam('${m.id}', '${team.name}')" title="Eliminar del equipo">
                                        <i class="fa-solid fa-user-minus"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; border-top: 1px solid var(--accent-light); padding-top:1rem;">
                        <button class="btn btn-secondary" style="font-size:0.85rem; padding: 10px;" onclick="viewTeamStats('${team.name}')">
                            <i class="fa-solid fa-chart-line"></i> Estadísticas
                        </button>
                        <button class="btn btn-primary admin-only" style="font-size:0.85rem; padding: 10px;" onclick="addPlayerToTeamPrompt('${team.name}')">
                            <i class="fa-solid fa-user-plus"></i> Añadir
                        </button>
                    </div>
                </div>`;
        }).join('');

        container.innerHTML = html;

        // Update modal select too
        const teamSelect = document.getElementById('form-team-player-select');
        if(teamSelect) {
            teamSelect.innerHTML = '<option value="">-- Seleccionar Jugador --</option>' + 
                players.map(p => `<option value="${p.id}">${p.username} (${p.nombreEquipo || 'Sin Equipo'})</option>`).join('');
        }

    } catch (e) {
        console.error('Error renderTeamsManagementView:', e);
        container.innerHTML = '<div style="color:red; text-align:center;">Error al cargar equipos.</div>';
    }
}

window.addPlayerToTeamPrompt = async function(teamName) {
    const modal = document.getElementById('create-team-modal');
    const nameInput = document.getElementById('form-team-name');
    const selectExisting = document.getElementById('select-existing-team');
    
    if (modal && nameInput) {
        // Prepare modal for adding to specific team
        if (teamName) {
            nameInput.value = teamName;
            nameInput.readOnly = true;
            if (selectExisting) {
                selectExisting.value = teamName;
                selectExisting.disabled = true;
            }
        } else {
            nameInput.value = '';
            nameInput.readOnly = false;
            if (selectExisting) {
                selectExisting.value = '';
                selectExisting.disabled = false;
            }
        }
        
        await refreshTeamPlayerList();
        openModal('create-team-modal');
        
        // Cleanup function for when modal closes
        const originalClose = window.closeModal;
        window.closeModal = function(id) {
            if (id === 'create-team-modal') {
                nameInput.readOnly = false;
                if (selectExisting) selectExisting.disabled = false;
                window.closeModal = originalClose;
            }
            originalClose(id);
        };
    }
};

window.removePlayerFromTeam = async function(userId, teamName) {
    if (!confirm(`¿Estás seguro de que deseas eliminar a este jugador del equipo ${teamName}?`)) return;
    
    try {
        // We need the team ID. Since we grouped by name, let's find the team ID from API
        const teams = await API.getEquipos();
        const team = teams.find(t => t.nombre === teamName);
        
        if (!team) {
            showNotification("No se encontró el equipo en el sistema", "error");
            return;
        }

        const success = await API.removerMiembroEquipo(team.id, userId);
        if (success) {
            showNotification("Jugador eliminado del equipo con éxito");
            renderTeamsManagementView();
        } else {
            showNotification("Error al eliminar al jugador del equipo", "error");
        }
    } catch (e) {
        console.error("Error removePlayerFromTeam:", e);
        showNotification("Error de conexión al servidor", "error");
    }
};

window.updateUserTeam = async function(userId, teamName, refresh = true) {
    if (!userId || !teamName) return;
    try {
        // 1. Asegurar que el equipo existe en la base de datos
        const teamRes = await fetchWithAuth(`${window.API_BASE}/equipos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: teamName })
        });
        
        if (!teamRes.ok) throw new Error("Error al crear/obtener equipo");
        const equipo = await teamRes.json();

        // 2. Asignar el usuario al equipo
        const assignRes = await fetchWithAuth(`${window.API_BASE}/equipos/${equipo.id}/miembros`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuarioId: parseInt(userId) })
        });

        if (assignRes.ok) {
            // Actualizar localmente si es el usuario actual
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (String(currentUser.id) === String(userId)) {
                currentUser.equipo = equipo;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
            
            if (refresh) {
                showNotification(`Asignado al equipo: ${teamName}`);
                if (currentView === 'teams-management-view') renderTeamsManagementView();
                else renderTournamentDetail(currentTournamentId);
            }
        } else {
            console.error("Error al asignar equipo al jugador:", userId);
        }
    } catch (e) {
        console.error('Error updateUserTeam:', e);
        showNotification("Error al procesar equipo", "error");
    }
};

// Handle Create Team Form (Modified for Multiple Players)
document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'form-create-team') {
        e.preventDefault();
        const existingSelect = document.getElementById('select-existing-team');
        const teamNameInput = document.getElementById('form-team-name');
        const teamName = (existingSelect && existingSelect.value) || (teamNameInput && teamNameInput.value);
        
        const checkboxes = document.querySelectorAll('input[name="team-players"]:checked');
        
        if (!teamName) {
            alert("Por favor, ingrese o seleccione un nombre para el equipo.");
            return;
        }

        const playerIds = Array.from(checkboxes).map(cb => cb.value);
        
        if (playerIds.length > 0) {
            showNotification(`Actualizando ${playerIds.length} jugadores...`);
            for (const id of playerIds) {
                await updateUserTeam(id, teamName, false);
            }
        } else if (!existingSelect.value) {
            // Just creating a name/concept or empty team? 
            // In this simplified system, teams exist via players.
            alert("Selecciona al menos un jugador para formar el equipo.");
            return;
        }
        
        showNotification(`Equipo "${teamName}" actualizado.`);
        closeModal('create-team-modal');
        if (currentView === 'teams-management-view') renderTeamsManagementView();
        renderDashboard();
    }
});
function initFAB() {
    const fabHtml = `
        <div class="fab-container admin-only" id="global-fab">
            <button class="fab-main" id="fab-trigger" onclick="toggleFAB()">
                <i class="fa-solid fa-plus"></i>
            </button>
            <div class="fab-options" id="fab-options">
                <button class="fab-item" onclick="openModal('create-tournament-modal')">
                    <i class="fa-solid fa-trophy"></i>
                    <span class="fab-label">Nuevo Torneo</span>
                </button>
                <button class="fab-item" onclick="openModal('create-team-modal')">
                    <i class="fa-solid fa-users-viewfinder"></i>
                    <span class="fab-label">Crear Equipo</span>
                </button>
                <button class="fab-item" onclick="showView('players-view')">
                    <i class="fa-solid fa-user-plus"></i>
                    <span class="fab-label">Ver Jugadores</span>
                </button>
            </div>
        </div>
    `;
    const container = document.createElement('div');
    container.innerHTML = fabHtml;
    document.body.appendChild(container);
}

window.toggleFAB = function() {
    const btn = document.getElementById('fab-trigger');
    const options = document.getElementById('fab-options');
    btn.classList.toggle('active');
    options.classList.toggle('active');
};
window.viewTeamStats = async function(teamName) {
    try {
        const users = await API.getUsuarios();
        const teamMembers = users.filter(u => (u.nombreEquipo || 'Sin Equipo') === teamName);
        
        // Calcular estadísticas agregadas
        const totalElo = teamMembers.reduce((acc, m) => acc + (m.eloRating || 0), 0);
        const avgElo = Math.round(totalElo / teamMembers.length);
        
        let statsHtml = `
            <div style="text-align:center; margin-bottom:2rem;">
                <i class="fa-solid fa-shield-halved" style="font-size:4rem; color:var(--accent-color); margin-bottom:1rem;"></i>
                <h2 style="margin:0; color:var(--primary-color);">${teamName}</h2>
                <p style="color:var(--text-muted);">Estadísticas Globales del Club</p>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:2rem;">
                <div class="card" style="text-align:center; padding:15px; background:var(--accent-light); border:none;">
                    <div style="font-size:1.5rem; font-weight:800; color:var(--accent-color);">${teamMembers.length}</div>
                    <div style="font-size:0.7rem; text-transform:uppercase; color:var(--accent-color); font-weight:700;">Jugadores</div>
                </div>
                <div class="card" style="text-align:center; padding:15px; background:var(--accent-light); border:none;">
                    <div style="font-size:1.5rem; font-weight:800; color:var(--accent-color);">${avgElo}</div>
                    <div style="font-size:0.7rem; text-transform:uppercase; color:var(--accent-color); font-weight:700;">ELO Promedio</div>
                </div>
            </div>
            
            <h4 style="border-bottom:2px solid var(--accent-light); padding-bottom:8px; margin-bottom:15px;">Plantilla de Jugadores</h4>
            <div style="display:flex; flex-direction:column; gap:10px; max-height:300px; overflow-y:auto; padding-right:5px;">
                ${teamMembers.sort((a,b) => b.eloRating - a.eloRating).map(m => `
                    <div class="tournament-item" style="padding:10px 15px;">
                        <div>
                            <div style="font-weight:700;">${m.username}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">ELO: ${m.eloRating}</div>
                        </div>
                        <button class="btn btn-primary" style="padding:5px 12px; font-size:0.8rem;" onclick="showPlayerStats('${m.id}')">Ver Perfil</button>
                    </div>
                `).join('')}
            </div>
        `;
        
        const modal = document.getElementById('generic-modal'); // Reutilizando un modal genérico o el de stats
        if (modal) {
            document.getElementById('generic-modal-content').innerHTML = statsHtml;
            openModal('generic-modal');
        } else {
            // Fallback: mostrar en un alert/prompt o crear modal al vuelo
            const detailView = document.getElementById('team-stats-detail-overlay');
            if(detailView) {
                detailView.innerHTML = `<div class="modal-content" style="max-width:600px;">
                    <div style="text-align:right;"><button class="btn" onclick="this.closest('.modal-overlay').style.display='none'">&times;</button></div>
                    ${statsHtml}
                </div>`;
                detailView.style.display = 'flex';
            }
        }
    } catch (e) {
        console.error("Error viewTeamStats:", e);
    }
};
