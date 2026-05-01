/**
 * CONFIGURACIÓN DEL API - DIGITAL CURATOR
 * Este archivo gestiona todas las comunicaciones con el servidor Backend.
 */

// Configuración dinámica de la URL del servidor
// - En Railway (nube): usa ruta relativa /api (mismo servidor)
// - En localhost vía Spring Boot (puerto 8080): usa ruta relativa /api
// - En localhost vía archivo directo (file://): usa http://localhost:8080/api
const isFileSystem = window.location.protocol === 'file:';
const API_BASE = isFileSystem
    ? 'http://localhost:8080/api'
    : '/api';
window.API_BASE = API_BASE;

/**
 * Recupera el token de autenticación (JWT) guardado en el navegador.
 * @returns {string|null} El token si existe, o null.
 */
function getAuthToken() {
    return localStorage.getItem('jwt_token');
}

/**
 * Función envolvente para fetch que añade automáticamente el token de seguridad.
 * También maneja la limpieza de sesión si el token ha expirado (401/403).
 */
async function fetchWithAuth(url, options = {}) {
    const token = getAuthToken();
    const headers = { ...options.headers };
    
    // Si hay un token disponible, se añade a la cabecera Authorization
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers
    };
    
    const response = await fetch(url, config);
    
    // Si el servidor rechaza el acceso, se limpia la sesión local
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('currentUser');
    }
    return response;
}

/**
 * OBJETO API PRINCIPAL
 * Contiene todos los métodos para interactuar con los recursos del sistema.
 */
const API = {
    // --- GESTIÓN DE TORNEOS ---

    /** Obtiene la lista completa de torneos registrados */
    async getTorneos() {
        try {
            const response = await fetchWithAuth(`${API_BASE}/torneos`);
            return await response.json();
        } catch (error) {
            console.error("Error al obtener torneos:", error);
            return [];
        }
    },

    /** Crea un nuevo torneo en la base de datos */
    async createTorneo(torneoData) {
        try {
            const response = await fetchWithAuth(`${API_BASE}/torneos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(torneoData)
            });
            return await response.json();
        } catch (error) {
            console.error("Error al crear torneo:", error);
        }
    },

    /** Obtiene los detalles específicos de un torneo por su ID */
    async getTorneo(id) {
        try {
            const response = await fetchWithAuth(`${API_BASE}/torneos/${id}`);
            return await response.json();
        } catch (error) {
            console.error("Error al obtener detalles del torneo:", error);
            return null;
        }
    },

    /** Inicia el torneo y genera los emparejamientos de la primera ronda */
    async startTorneo(id) {
        try {
            const response = await fetchWithAuth(`${API_BASE}/torneos/${id}/iniciar`, { method: 'POST' });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Error desconocido");
            }
            return await response.json();
        } catch (error) {
            console.error("Error al iniciar torneo:", error);
            alert("No se pudo iniciar/avanzar el torneo: " + error.message);
            return null;
        }
    },

    /** Obtiene todas las partidas (enfrentamientos) de un torneo */
    async getPartidas(torneoId) {
        try {
            const response = await fetchWithAuth(`${API_BASE}/torneos/${torneoId}/partidas`);
            return await response.json();
        } catch (error) {
            console.error("Error al obtener partidas:", error);
            return [];
        }
    },
    
    /** Elimina un torneo de forma permanente */
    async deleteTorneo(torneoId) {
        try {
            await fetchWithAuth(`${API_BASE}/torneos/${torneoId}`, { method: 'DELETE' });
            return true;
        } catch (error) {
            console.error("Error al borrar torneo:", error);
            return false;
        }
    },

    /** Elimina la inscripción de un jugador en un torneo */
    async deleteInscripcion(torneoId, insId) {
        try {
            await fetchWithAuth(`${API_BASE}/torneos/${torneoId}/inscripciones/${insId}`, { method: 'DELETE' });
            return true;
        } catch (error) {
            console.error("Error al borrar inscripción:", error);
            return false;
        }
    },

    /** Actualiza los datos de un torneo */
    async updateTorneo(id, torneoData) {
        try {
            const response = await fetchWithAuth(`${API_BASE}/torneos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(torneoData)
            });
            return await response.json();
        } catch (error) {
            console.error("Error al actualizar torneo:", error);
        }
    },

    /** Finaliza un torneo */
    async finalizarTorneo(id) {
        try {
            const response = await fetchWithAuth(`${API_BASE}/torneos/${id}/finalizar`, {
                method: 'PUT'
            });
            return await response.json();
        } catch (error) {
            console.error("Error al finalizar torneo:", error);
        }
    },

    /** Inscribe un jugador en un torneo */
    async inscribirJugador(torneoId, data) {
        try {
            const response = await fetchWithAuth(`${API_BASE}/torneos/${torneoId}/inscripciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error("Error al inscribir jugador:", error);
        }
    },

    /** Obtiene el número de partidas que están actualmente en juego */
    async getActiveMatchesCount() {
        try {
            const response = await fetchWithAuth(`${API_BASE}/partidas/activas/count`);
            return await response.json();
        } catch (error) {
            console.error("Error al obtener contador de partidas:", error);
            return 0;
        }
    },

    // --- GESTIÓN DE USUARIOS ---

    /** Obtiene la lista de todos los usuarios del sistema */
    async getUsuarios() {
        try {
            const response = await fetchWithAuth(`${API_BASE}/usuarios`);
            if(response.ok) return await response.json();
            return [];
        } catch (error) {
            console.error("Error al obtener usuarios:", error);
            return [];
        }
    },

    // --- AUTENTICACIÓN ---

    /** Realiza el proceso de inicio de sesión con validación reCAPTCHA */
    async login(username, password, recaptchaToken) {
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, recaptchaToken })
            });
            if(response.ok) return await response.json();
            return null;
        } catch (error) {
            console.error("Fallo en el inicio de sesión:", error);
            return null;
        }
    },
    
    /** Registra un nuevo usuario en el sistema */
    async register(username, password, email, role, elo, recaptchaToken) {
        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    passwordHash: password, 
                    email, 
                    role: role || 'PLAYER',
                    eloRating: elo || 1200,
                    recaptchaToken
                })
            });
            if(response.ok) return await response.json();
            return null;
        } catch (error) {
            console.error("Fallo en el registro:", error);
            return null;
        }
    }
};

// Exponer el objeto API globalmente para ser usado por app.js
window.API = API;
