/**
 * app_v2.js - LOGICA MAESTRA (BANNER DE CAMPEÓN AL FINAL)
 */

window.currentTournamentId = null;
var currentTournamentId = null; // Para compatibilidad dual

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
    renderDashboard();
    renderTournamentList();
    initAchievementManagement(); // Nueva función
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
    const userStr = localStorage.getItem('currentUser');
    if (!userStr && viewId !== 'login-overlay') {
        document.getElementById('login-overlay').style.display = 'flex';
        return;
    }

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
    const list = document.getElementById('full-achievements-list');
    if (!list) return;
    
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
        <div class="card" style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:12px; padding:1.5rem; border-top: 3px solid ${a.color};">
            <div style="background:${a.color}; color:white; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.6rem; flex-shrink:0;">
                <i class="${a.icon}"></i>
            </div>
            <div>
                <h4 style="margin:0 0 4px; font-size:1rem;">${a.name}</h4>
                <p style="font-size:0.82rem; color:var(--text-muted); line-height:1.4; margin:0;">${a.desc}</p>
            </div>
            <span style="font-size:0.7rem; font-weight:700; letter-spacing:1px; color:${a.color}; background:${a.color}18; padding:2px 10px; border-radius:20px;">${a.category.toUpperCase()}</span>
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

    openModal('player-stats-modal');
}

function renderEloChart(history) {
    const canvas = document.getElementById('eloChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (eloChartInstance) eloChartInstance.destroy();

    const labels = history.map(h => new Date(h.fecha).toLocaleDateString());
    const points = history.map(h => h.elo);

    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#f0eade' : '#2D2C2A';
    const gridColor = isDark ? '#2d1f1a' : '#f1f5f9';
    const accentColor = '#8b5a2b';

    eloChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ELO',
                data: points,
                borderColor: accentColor,
                backgroundColor: isDark ? 'rgba(139, 90, 43, 0.2)' : 'rgba(139, 90, 43, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: accentColor
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? '#1c1512' : '#FFFFFF',
                    titleColor: isDark ? '#f9f7f2' : '#000',
                    bodyColor: isDark ? '#f9f7f2' : '#000',
                    borderColor: accentColor,
                    borderWidth: 1
                }
            },
            scales: {
                y: { 
                    beginAtZero: false, 
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: textColor }
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
    
    // El toggle ya se maneja vía onclick global

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
                if (typeof grecaptcha !== 'undefined') grecaptcha.reset(0);
                checkAuthStatus(); connectWebSocket(); renderDashboard();
            } else {
                if (typeof grecaptcha !== 'undefined') grecaptcha.reset(0);
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
            if (typeof grecaptcha !== 'undefined') grecaptcha.reset(1);
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

    if (formAddPlayer) {
        formAddPlayer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formAddPlayer.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Inscribiendo...'; }
            try {
                const mode = document.getElementById('add-player-mode').value;
                console.log('Inscribiendo jugador, modo:', mode, 'TorneoID:', currentTournamentId);
                
                if (!currentTournamentId) {
                    alert("Error: No hay un ID de torneo activo. Por favor, cierra y vuelve a abrir el torneo.");
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
                    
                    console.log('Obteniendo reCAPTCHA index 2...');
                    const recaptchaToken = grecaptcha.getResponse(2);
                    if(!recaptchaToken) { alert("Por favor, marca el reCAPTCHA de Inscripción"); return; }
                    data.recaptchaToken = recaptchaToken;
                }
                
                const targetId = window.currentTournamentId || currentTournamentId;
                console.log('Llamando a API.inscribirJugador con ID:', targetId);
                const res = await API.inscribirJugador(targetId, data);
                if (typeof grecaptcha !== 'undefined' && mode !== 'existente') grecaptcha.reset(2);
                
                if (res && (res.id || res.success)) { 
                    alert("¡Jugador inscrito con éxito!");
                    closeModal('add-player-modal'); 
                    renderTournamentDetail(currentTournamentId); 
                } else { 
                    alert("Error: " + (res?.message || "Inscripción fallida (verifica si el jugador ya existe)")); 
                }
            } catch (err) {
                console.error('Error en formAddPlayer:', err);
                alert('Error crítico al inscribir: ' + err.message);
            } finally {
                if(btn) { btn.disabled = false; btn.innerHTML = 'Añadir a la lista'; }
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
                const recaptchaToken = grecaptcha.getResponse(3);
                
                if(!recaptchaToken) { 
                    alert('Por favor, marca el reCAPTCHA de Creación de Jugador'); 
                    btn.disabled = false; 
                    btn.innerHTML = 'Crear Jugador'; 
                    return; 
                }
                
                const res = await API.register(username, password, email, 'PLAYER', elo, recaptchaToken);
                if (typeof grecaptcha !== 'undefined') grecaptcha.reset(3);

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

        // Botón PDF si ya ha iniciado o terminado
        if (yaIniciado || t.estado === 'FINALIZADO') {
            const pdfBtn = `<button class="btn" style="background:#1e293b; color:white; border:none; padding:10px 15px; border-radius:8px; margin-right:5px;" onclick="exportTournamentPDF()"><i class="fa-solid fa-file-pdf"></i> PDF</button>`;
            actions.innerHTML = pdfBtn + actions.innerHTML;
        }
    }
    
    renderPlayers(inscripciones, t.estado, id);
    renderRounds(partidas, t.estado, id, t.sistemaJuego, inscripciones);
    renderStandings(inscripciones, t.estado);
    renderBrackets(partidas, t.sistemaJuego);
}

function renderBrackets(partidas, sistema) {
    const container = document.getElementById('bracket-visualization');
    const tabBtn = document.getElementById('btn-tab-bracket');
    
    if (!container) return;
    
    const isElimination = sistema === 'ELIMINATORIA' || sistema === 'DOBLE_ELIMINATORIA';
    if (!isElimination) {
        if(tabBtn) tabBtn.style.display = 'none';
        return;
    }
    
    if(tabBtn) tabBtn.style.display = 'block';
    container.innerHTML = '';

    if (partidas.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:gray; padding:3rem;"><i class="fa-solid fa-sitemap" style="font-size:3rem; display:block; margin-bottom:1rem; opacity:0.2;"></i>El cuadro visual se generará automáticamente al iniciar el torneo.</div>';
        return;
    }

    // Para Doble Eliminatoria, intentamos separar en Ganadores y Perdedores si es posible
    if (sistema === 'DOBLE_ELIMINATORIA') {
        const winnersSection = document.createElement('div');
        winnersSection.innerHTML = '<h3 style="margin-bottom:1rem; color:var(--win-color); border-bottom:1px solid var(--accent-light);">Cuadro de Ganadores (Winners Bracket)</h3>';
        const losersSection = document.createElement('div');
        losersSection.innerHTML = '<h3 style="margin-top:2rem; margin-bottom:1rem; color:var(--loss-color); border-bottom:1px solid var(--accent-light);">Cuadro de Perdedores (Losers Bracket)</h3>';
        
        container.appendChild(winnersSection);
        renderBracketType(partidas, winnersSection, 'WINNERS');
        
        container.appendChild(losersSection);
        renderBracketType(partidas, losersSection, 'LOSERS');
    } else {
        renderBracketType(partidas, container, 'SINGLE');
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
                <div class="bracket-player ${p1Winner ? 'winner' : ''}" onclick="if('${p.blancas?.id}') showPlayerStats('${p.blancas?.id}')" style="cursor:pointer;">
                    <span style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-regular fa-user" style="font-size:0.7rem; opacity:0.5;"></i>
                        ${p.blancas ? p.blancas.username : '<span class="bracket-empty">?</span>'}
                    </span>
                    <span class="bracket-score">${p.resultado === 'BYE' ? 'W' : (p1Winner ? '1' : (isDraw ? '½' : '0'))}</span>
                </div>
                <div class="bracket-player ${p2Winner ? 'winner' : ''}" onclick="if('${p.negras?.id}') showPlayerStats('${p.negras?.id}')" style="cursor:pointer;">
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
    if (confirm("¿Eliminar este torneo?")) { await fetchWithAuth(`${window.API_BASE}/torneos/${id}`, { method: 'DELETE' }); showView('dashboard-view'); renderDashboard(); renderTournamentList(); }
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

function renderRounds(partidas, estado, tId, sistema, inscripciones) {
    const container = document.getElementById('rounds-container');
    if (!container) return; container.innerHTML = '';
    if (!partidas.length) { container.innerHTML = '<div style="text-align:center; padding:2rem; color:gray;">No hay partidas aún.</div>'; return; }
    const rounds = {};
    partidas.forEach(p => { const r = p.rondaNumero || 1; if (!rounds[r]) rounds[r] = []; rounds[r].push(p); });
    
    const roundNums = Object.keys(rounds).map(Number);
    const maxRound = Math.max(...roundNums);

    roundNums.sort((a, b) => b - a).forEach(rNum => {
        const isLocked = (estado === 'FINALIZADO') || (sistema !== 'ROUND_ROBIN' && rNum < maxRound);
        const div = document.createElement('div');
        div.className = 'round-section mt-4';
        div.style = 'background:var(--surface-card); padding:1.2rem; border-radius:12px; margin-bottom:1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border:1px solid var(--accent-light);';
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
                        <span style="font-weight:600; cursor:pointer; color:${p.resultado==='1-0'?'#16a34a':'var(--accent-color)'}" onclick="showPlayerStats('${p.blancas?.id}')">${p.blancas?.username || '?'}</span> vs 
                        <span style="font-weight:600; cursor:pointer; color:${p.resultado==='0-1'?'#16a34a':'var(--accent-color)'}" onclick="showPlayerStats('${p.negras?.id}')">${p.negras?.username || 'ESPERANDO...'}</span>
                    </div>
                    <div style="flex:1; text-align:right;">
                        <select ${isLocked ? 'disabled' : ''} onchange="setResult('${p.id}', this.value)" style="padding:4px; border-radius:6px; font-weight:bold; cursor:pointer; ${isLocked ? 'background:#f1f5f9; cursor:not-allowed;' : ''}">
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
        return `<tr style="${style}"><td>${pos}</td><td><a href="javascript:void(0)" onclick="showPlayerStats('${ins.usuario.id}')" style="text-decoration:none; color:var(--text-main); font-weight:700;">${ins.usuario.username}</a></td><td><span style="color:var(--accent-color); font-weight:800;">${ins.puntosAcumulados}</span></td><td>${ins.buchholz || 0}</td><td>${ins.sonnebornBerger || 0}</td><td>${ins.partidasJugadas}</td></tr>`;
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

window.startTournament = async function(tId) { await API.startTorneo(tId); renderTournamentDetail(tId); };
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
    const group = document.getElementById('group-t-rondas');
    if (group) group.style.display = (val === 'SUIZO') ? 'block' : 'none';
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
        currentMoveIndex = currentHistory.length - 1;
        moveEvaluations = new Array(currentHistory.length).fill(null);
        analysisBoard.position(analysisGame.fen());
        updateAnalysisUI();
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

    analysisBoard.position(tempGame.fen());
    analysisGame = tempGame;
    updateAnalysisUI();
};

window.downloadPGN = function() {
    if (currentHistory.length === 0) {
        alert("No hay jugadas para exportar.");
        return;
    }

    let pgn = "";
    // PGN Headers
    const now = new Date();
    pgn += `[Event "Análisis Digital Curator"]\n`;
    pgn += `[Site "Localhost"]\n`;
    pgn += `[Date "${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}"]\n`;
    pgn += `[Round "1"]\n`;
    pgn += `[White "Análisis"]\n`;
    pgn += `[Black "Motor Stockfish"]\n`;
    pgn += `[Result "*"]\n\n`;

    for (let i = 0; i < currentHistory.length; i += 2) {
        const roundNum = Math.floor(i / 2) + 1;
        const wMove = currentHistory[i];
        const bMove = currentHistory[i + 1] || "";
        
        const wEval = moveEvaluations[i];
        const bEval = moveEvaluations[i + 1];

        // Map icons to PGN NAGs or comments
        const getComment = (ev) => {
            if (!ev) return "";
            const sym = { 'brilliant': '!!', 'best': '!', 'excellent': '!', 'inaccuracy': '?!', 'mistake': '?', 'blunder': '??' }[ev.icon] || "";
            return ` { ${sym} Eval: ${ev.diff > 0 ? '+' : ''}${ev.diff.toFixed(2)} }`;
        };

        pgn += `${roundNum}. ${wMove}${getComment(wEval)} ${bMove}${getComment(bEval)} `;
    }

    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Partida_Analizada_${now.getTime()}.pgn`;
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
    
    // Render move history
    const moveList = document.getElementById('analysis-move-list');
    if (moveList) {
        moveList.innerHTML = '';
        const isDark = document.body.classList.contains('dark-theme');
        const highlight = isDark ? 'rgba(255, 255, 255, 0.15)' : '#fef3c7';
        
        for (let i = 0; i < currentHistory.length; i += 2) {
            const roundNum = Math.floor(i / 2) + 1;
            const whiteMove = currentHistory[i];
            const blackMove = currentHistory[i + 1] || '';
            
            const wEval = moveEvaluations[i];
            const bEval = moveEvaluations[i + 1];
            
            const wIcon = wEval && wEval.icon ? `<img src="img/${wEval.icon}.svg" style="height:14px; vertical-align:middle; margin-left:4px;" title="${wEval.icon} (${wEval.diff > 0 ? '+' : ''}${wEval.diff.toFixed(2)})">` : '';
            const bIcon = bEval && bEval.icon ? `<img src="img/${bEval.icon}.svg" style="height:14px; vertical-align:middle; margin-left:4px;" title="${bEval.icon} (${bEval.diff > 0 ? '+' : ''}${bEval.diff.toFixed(2)})">` : '';
            
            const moveRow = `
                <div style="color: var(--text-muted); font-weight: bold;">${roundNum}.</div>
                <div style="padding: 2px 5px; background: ${i === currentMoveIndex ? highlight : 'transparent'}; border-radius: 4px; color: var(--text-main); cursor:pointer;" onclick="moveAnalysisAbsolute(${i})">${whiteMove}${wIcon}</div>
                <div style="padding: 2px 5px; background: ${i + 1 === currentMoveIndex ? highlight : 'transparent'}; border-radius: 4px; color: var(--text-main); cursor:pointer;" onclick="moveAnalysisAbsolute(${i+1})">${blackMove}${bIcon}</div>
            `;
            moveList.innerHTML += moveRow;
        }
        moveList.scrollTop = moveList.scrollHeight;
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

    analysisBoard.position(tempGame.fen());
    analysisGame = tempGame;
    updateAnalysisUI();
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
            const handler = function(event) {
                const line = event.data;
                if (line.includes('info depth') && line.includes('score')) {
                    const cpMatch = line.match(/cp (-?\d+)/);
                    const mateMatch = line.match(/mate (-?\d+)/);
                    if (cpMatch) lastCp = parseInt(cpMatch[1]) / 100.0;
                    if (mateMatch) lastMate = parseInt(mateMatch[1]);
                } else if (line.includes('bestmove')) {
                    stockfishWorker.removeEventListener('message', handler);
                    // if mate, represent as a large centipawn value
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
    
    // Ensure we start with a clean worker state for the analysis loop
    // Temporarily replace onmessage to avoid conflicts
    const originalOnMessage = stockfishWorker.onmessage;
    stockfishWorker.onmessage = null;
    stockfishWorker.postMessage('uci');
    stockfishWorker.postMessage('ucinewgame');
    
    const tempGame = new Chess();
    let prevEval = 0.2; // starting advantage roughly
    
    const bestMoveSpan = document.getElementById('best-move');
    
    for (let i = 0; i < currentHistory.length; i++) {
        const progress = Math.round(((i + 1) / currentHistory.length) * 100);
        const progEl = document.getElementById('analysis-progress');
        if (progEl) progEl.textContent = progress;

        tempGame.move(currentHistory[i]);
        let currentEval = await analyzeFen(tempGame.fen(), 10); // Lower depth for speed but better feedback
        
        const isWhiteToMove = tempGame.turn() === 'w';
        let normalizedEval = isWhiteToMove ? currentEval : -currentEval;
        
        let evalDiff;
        if (i % 2 === 0) { // White just moved
            evalDiff = normalizedEval - prevEval;
        } else { // Black just moved
            evalDiff = -(normalizedEval - prevEval);
        }
        
        let category = 'book';
        let icon = 'book';
        
        if (i < 4) { 
            category = 'book'; icon = 'book';
        } else if (evalDiff < -3.0) {
            category = 'blunder'; icon = 'blunder';
        } else if (evalDiff < -1.5) {
            category = 'mistake'; icon = 'mistake';
        } else if (evalDiff < -0.8) {
            category = 'inaccuracy'; icon = 'inaccuracy';
        } else if (evalDiff < -0.3) {
            category = 'good'; icon = 'good';
        } else if (evalDiff > 1.0 && currentEval > 2.0 && prevEval < 0.5) {
            category = 'brilliant'; icon = 'brilliant';
        } else if (evalDiff >= -0.3 && evalDiff <= 0.3) {
            category = 'best'; icon = 'best';
        } else {
            category = 'excellent'; icon = 'excellent';
        }
        
        moveEvaluations[i] = { icon: icon, diff: evalDiff };
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
    stockfishWorker.onmessage = originalOnMessage;
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
async function updateOpeningExplorer(fen) {
    const fenBase = fen.split(' ').slice(0, 4).join(' '); // Ignore halfmove/fullmove for explorer
    if (fenBase === lastExplorerFen) return;
    lastExplorerFen = fenBase;

    const nameEl = document.getElementById('opening-name');
    const candEl = document.getElementById('opening-candidates');
    if (!nameEl || !candEl) return;

    // Use a clean FEN (no move counts) for better matching
    const fenParts = fen.split(' ');
    const cleanFen = fenParts.slice(0, 4).join(' ');

    try {
        console.log('Fetching opening for FEN:', cleanFen);
        // Intentar primero con la base de datos de Maestros
        let res = await fetch(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(cleanFen)}`);
        if (!res.ok) throw new Error('Lichess API error');
        let data = await res.json();

        // Si no hay datos, intentar con la base de datos general de Lichess
        if ((!data.opening || !data.moves || data.moves.length === 0) && parseInt(fenParts[5]) < 50) {
            res = await fetch(`https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(cleanFen)}`);
            if (res.ok) data = await res.json();
        }

        if (data.opening) {
            nameEl.textContent = data.opening.name;
        } else {
            nameEl.textContent = "Teoría desconocida / Final de partida";
        }

        if (data.moves && data.moves.length > 0) {
            candEl.innerHTML = data.moves.slice(0, 3).map(m => `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; background: rgba(139, 90, 43, 0.05); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(139, 90, 43, 0.1);">
                    <span style="font-weight: 700; color: var(--accent-color);">${m.san}</span>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span style="color: #16a34a; font-weight:700;">${Math.round(m.white || 0)}%</span>
                        <span style="color: var(--text-muted); font-size: 0.7rem;">${Math.round(m.draws || 0)}%</span>
                        <span style="color: #ef4444; font-weight:700;">${Math.round(m.black || 0)}%</span>
                    </div>
                </div>
            `).join('');
        } else {
            candEl.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-muted); font-style:italic;">No hay jugadas registradas en esta posición.</div>';
        }
    } catch (err) {
        console.error("Explorer Error:", err);
        nameEl.textContent = "Error al conectar con el explorador";
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
        inaccuracy: 0, mistake: 0, blunder: 0, book: 0, excellent: 0
    };
    
    let totalAccuracy = 0;
    let movesToCount = 0;

    moveEvaluations.forEach(ev => {
        if (!ev) return;
        counts[ev.icon] = (counts[ev.icon] || 0) + 1;
        
        let acc = 100;
        if (ev.diff < 0) {
            acc = Math.max(0, 100 + (ev.diff * 15)); 
        }
        totalAccuracy += acc;
        movesToCount++;
    });

    if (movesToCount === 0) return;

    const avgAccuracy = totalAccuracy / movesToCount;
    // Heuristic: Accuracy * 30 - some offset
    const predictedElo = Math.max(400, Math.floor(avgAccuracy * 28));

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
                <div onclick="moveAnalysisAbsolute(${m.idx})" style="flex-shrink: 0; width: 80px; background: rgba(255,255,255,0.1); border: 1px solid ${m.ev.icon === 'brilliant' ? '#fbbf24' : 'rgba(255,255,255,0.2)'}; padding: 8px; border-radius: 8px; cursor: pointer; text-align: center; transition: transform 0.2s;">
                    <img src="img/${m.ev.icon}.svg" style="height: 20px; margin-bottom: 4px;">
                    <div style="font-weight: 800; font-size: 0.9rem; color: white;">${m.san}</div>
                    <div style="font-size: 0.6rem; opacity: 0.7; text-transform: uppercase;">Mover ${Math.floor(m.idx/2)+1}</div>
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
        document.getElementById('stat-brilliant').textContent = counts.brilliant || 0;
        document.getElementById('stat-best').textContent = counts.best || 0;
        document.getElementById('stat-excellent').textContent = counts.excellent || 0;
        document.getElementById('stat-good').textContent = counts.good || 0;
        document.getElementById('stat-inaccuracy').textContent = counts.inaccuracy || 0;
        document.getElementById('stat-mistake').textContent = counts.mistake || 0;
        document.getElementById('stat-blunder').textContent = counts.blunder || 0;
        document.getElementById('performance-elo').textContent = predictedElo + ' ELO';

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
const originalShowView = window.showView;
window.showView = function(viewId) {
    originalShowView(viewId);
    if (viewId === 'analysis-view') {
        initAnalysisBoard();
        renderSavedAnalysisList();
    }
};

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

window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) {
        sidebar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
    }
};

const chessSounds = {
    move: new Audio('https://lichess.org/assets/sound/standard/Move.ogg'),
    capture: new Audio('https://lichess.org/assets/sound/standard/Capture.ogg'),
    check: new Audio('https://lichess.org/assets/sound/standard/Check.ogg'),
    victory: new Audio('https://lichess.org/assets/sound/standard/Victory.ogg')
};

window.playChessSound = function(type) {
    if (localStorage.getItem('chess_sounds_enabled') === 'false') return;
    const sound = chessSounds[type];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
};
