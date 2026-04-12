const API_BASE = 'http://localhost:8080/api';

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
    }
};

window.API = API;
