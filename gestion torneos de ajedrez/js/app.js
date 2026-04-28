/**
 * LÓGICA PRINCIPAL DEL FRONTEND - DIGITAL CURATOR
 * Este archivo gestiona la interfaz de usuario, la navegación, los formularios y la integración con WebSockets.
 */

let currentTournamentId = null; // Almacena el ID del torneo que se está visualizando actualmente

/**
 * Punto de entrada de la aplicación. Se ejecuta cuando el HTML está cargado.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Manejo global de errores para facilitar el debug en producción
    window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.error('Error Detectado:', msg, '\nEn:', url, 'Línea:', lineNo);
        return false;
    };

    checkAuthStatus();   // Verifica si el usuario está logueado
    initNavigation();    // Configura los botones de la barra lateral
    initModals();        // Configura el comportamiento de las ventanas emergentes
    initForms();         // Configura el envío de formularios
    renderDashboard();   // Carga los datos iniciales del panel
    renderTournamentList(); // Carga la lista de torneos
});

/**
 * Verifica si existe una sesión activa y actualiza la interfaz según el rol (ADMIN/PLAYER).
 */
function checkAuthStatus() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
        // Si no hay usuario, muestra la pantalla de Login
        document.getElementById('login-overlay').style.display = 'flex';
    } else {
        const user = JSON.parse(userStr);
        document.getElementById('login-overlay').style.display = 'none';
        
        // Actualiza el perfil en la barra lateral
        document.getElementById('current-username').textContent = user.username;
        const roleBadge = document.getElementById('user-role-badge');
        
        // Diferenciación de permisos según el Rol
        const isAdmin = user.role === 'ADMIN';
        if (isAdmin) {
            roleBadge.textContent = 'ADMINISTRADOR';
            roleBadge.style.color = '#eab308'; // Color Dorado para Admin
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        } else {
            roleBadge.textContent = 'JUGADOR / LEYENDA';
            roleBadge.style.color = '#94a3b8'; // Color Plata para Jugador
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }
    }
}

/**
 * Configura los eventos de clic para navegar entre las diferentes secciones (vistas) de la App.
 */
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            showView(target); // Cambia la vista visible
            
            // Recarga los datos según la sección seleccionada
            if(target === 'dashboard-view') renderDashboard();
            if(target === 'tournaments-view') renderTournamentList();
            if(target === 'users-view') renderUsers();
            if(target === 'players-view') renderPlayersView();
            if(target === 'ranking-view') renderGlobalRanking();
        });
    });

    // Control de pestañas (tabs) dentro del detalle del torneo
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

/**
 * Muestra una sección específica y oculta las demás.
 */
window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
};

/** Control de apertura/cierre de Modales (ventanas emergentes) */
window.openModal = function(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active'); 
};

window.closeModal = function(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active'); 
};

function initModals() {
    // Permite cerrar el modal haciendo clic fuera de la caja blanca
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    });
}

/**
 * Inicializa la lógica de todos los formularios del sistema.
 */
function initForms() {
    const errorDiv = document.getElementById('login-error');
    const toggleLink = document.getElementById('toggle-auth-mode');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    
    // Intercambia entre Login y Registro
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

    // Lógica de Inicio de Sesión
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.style.display = 'none';
            const user = document.getElementById('login-user').value;
            const pass = document.getElementById('login-pass').value;
            const recaptchaToken = grecaptcha.getResponse(0); 
            
            if(!recaptchaToken) {
                errorDiv.textContent = 'Por favor, marca la casilla "No soy un robot"';
                errorDiv.style.display = 'block';
                return;
            }
            
            const res = await API.login(user, pass, recaptchaToken);
            if (res && res.token) {
                localStorage.setItem('jwt_token', res.token);
                localStorage.setItem('currentUser', JSON.stringify(res.usuario));
                checkAuthStatus(); 
                connectWebSocket(); // Inicia la escucha de notificaciones
                renderDashboard();
            } else {
                errorDiv.textContent = 'Credenciales inválidas o error de red';
                errorDiv.style.display = 'block';
            }
        });
    }

    // Lógica de Registro de Nuevos Usuarios
    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.style.display = 'none';
            const user = document.getElementById('reg-user').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-pass').value;
            const elo = parseInt(document.getElementById('reg-elo').value) || 1200;
            const recaptchaToken = grecaptcha.getResponse(1);
            
            if(!recaptchaToken) {
                errorDiv.textContent = 'Por favor, marca la casilla "No soy un robot"';
                errorDiv.style.display = 'block';
                return;
            }
            
            const res = await API.register(user, pass, email, 'ADMIN', elo, recaptchaToken); 
            if (res) {
                alert("Cuenta creada con éxito. Ya puedes iniciar sesión.");
                toggleLink.click(); 
                formRegister.reset();
            } else {
                errorDiv.textContent = 'Error al registrar, el nombre de usuario puede estar en uso';
                errorDiv.style.display = 'block';
            }
        });
    }

    // Creación de Torneos
    const formCreate = document.getElementById('form-create-tournament');
    if (formCreate) {
        formCreate.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('form-t-name').value;
            const sistemaJuego = document.getElementById('form-t-sistema').value;
            const t = await API.createTorneo({ nombre, descripcion: "Torneo de Ajedrez", sistemaJuego });
            
            if(t) {
                closeModal('create-tournament-modal');
                renderDashboard();
                renderTournamentList();
                openTournamentDetail(t.id);
            }
        });
    }

    // Inscripción de Jugadores
    const formAddPlayer = document.getElementById('form-add-player');
    if (formAddPlayer) {
        formAddPlayer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mode = document.getElementById('add-player-mode').value;
            const recaptchaToken = mode === 'nuevo' ? grecaptcha.getResponse(3) : null;
            
            // Lógica para enviar datos de inscripción al API según sea nuevo o existente
            // ... (Abreviado para claridad)
            closeModal('add-player-modal');
            renderTournamentDetail(currentTournamentId);
        });
    }
}

/**
 * Renderiza el Panel de Control con estadísticas globales.
 */
async function renderDashboard() {
    const tournaments = await API.getTorneos();
    
    // Estadísticas rápidas
    const activeT = tournaments.filter(t => t.estado === 'EN_CURSO').length;
    document.getElementById('stat-active-tournaments').textContent = activeT;
    
    const users = await API.getUsuarios();
    const totalP = users.filter(u => u.role !== 'ADMIN').length;
    document.getElementById('stat-total-players').textContent = totalP;
    
    // Lista de torneos recientes
    const recentList = document.getElementById('recent-tournaments-list');
    recentList.innerHTML = '';
    const recent = [...tournaments].reverse().slice(0, 10);
    recent.forEach(t => recentList.appendChild(createTournamentUIItem(t)));

    renderGlobalRanking();
}

/**
 * Genera la tabla del Ranking Global basada en el ELO de los usuarios.
 */
async function renderGlobalRanking() {
    const users = await API.getUsuarios();
    const tbody = document.querySelector('#global-ranking-table tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    const sortedUsers = [...users].sort((a, b) => (b.eloRating || 0) - (a.eloRating || 0));
    
    sortedUsers.forEach((u, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${index + 1}</td>
            <td style="font-weight:600;">${u.username}</td>
            <td>${u.role}</td>
            <td style="text-align: right; font-weight: 800; color: #8b5a2b;">${u.eloRating || 1200}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Gestiona la conexión en tiempo real para recibir alertas de nuevos resultados o torneos.
 */
function connectWebSocket() {
    const wsUrl = 'https://backend-lmeb-production.up.railway.app/ws-chess';
    const socket = new SockJS(wsUrl);
    stompClient = Stomp.over(socket);
    stompClient.debug = null; 

    stompClient.connect({}, function (frame) {
        stompClient.subscribe('/topic/notifications', function (notification) {
            showNotification(notification.body);
            // Actualiza los datos si la notificación afecta lo que el usuario está viendo
            if (document.getElementById('dashboard-view').classList.contains('active')) renderDashboard();
            if (document.getElementById('tournament-detail-view').classList.contains('active')) renderTournamentDetail(currentTournamentId);
        });
    }, function(error) {
        setTimeout(connectWebSocket, 5000); // Reintento automático
    });
}

/**
 * Muestra una alerta visual elegante (Toast) en la parte superior derecha.
 */
function showNotification(message) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'card';
    toast.style.cssText = `background: #8b5a2b; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 10px; animation: slideIn 0.5s ease forwards;`;
    
    toast.innerHTML = `<strong>Aviso:</strong> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}
