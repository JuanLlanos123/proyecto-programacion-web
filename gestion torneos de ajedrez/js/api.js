window.API_BASE = 'http://localhost:8080/api';
const API_BASE = window.API_BASE;

const API = {
    async getTorneos() {
        try {
            const response = await fetch(`${API_BASE}/torneos`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching torneos:", error);
            return [];
        }
    },

    async createTorneo(torneoData) {
        try {
            const response = await fetch(`${API_BASE}/torneos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(torneoData)
            });
            return await response.json();
        } catch (error) {
            console.error("Error creating torneo:", error);
        }
    },

    async getTorneo(id) {
        try {
            const response = await fetch(`${API_BASE}/torneos/${id}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching torneo:", error);
            return null;
        }
    },

    async startTorneo(id) {
        try {
            const response = await fetch(`${API_BASE}/torneos/${id}/iniciar`, {
                method: 'POST'
            });
            return await response.json(); // Returns the generated pairings
        } catch (error) {
            console.error("Error starting torneo:", error);
            return [];
        }
    },

    async getPartidas(torneoId) {
        try {
            const response = await fetch(`${API_BASE}/torneos/${torneoId}/partidas`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching partidas:", error);
            return [];
        }
    },
    
    async deleteTorneo(torneoId) {
        try {
            await fetch(`${API_BASE}/torneos/${torneoId}`, { method: 'DELETE' });
            return true;
        } catch (error) {
            console.error("Error al borrar torneo:", error);
            return false;
        }
    },

    async deleteInscripcion(torneoId, insId) {
        try {
            await fetch(`${API_BASE}/torneos/${torneoId}/inscripciones/${insId}`, { method: 'DELETE' });
            return true;
        } catch (error) {
            console.error("Error al borrar inscripcion:", error);
            return false;
        }
    },

    // Auth
    async login(username, password) {
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if(response.ok) return await response.json();
            return null;
        } catch (error) {
            console.error("Login failed:", error);
            return null;
        }
    },
    
    async register(username, password, email, role) {
        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, passwordHash: password, email, role: role || 'PLAYER' })
            });
            if(response.ok) return await response.json();
            return null;
        } catch (error) {
            console.error("Register failed:", error);
            return null;
        }
    }
};

window.API = API;
