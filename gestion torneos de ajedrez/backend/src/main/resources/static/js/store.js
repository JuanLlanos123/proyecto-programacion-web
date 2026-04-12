/**
 * store.js
 * Handles LocalStorage data layer for the Tournament system.
 */

const STORAGE_KEY = 'gm_heritage_data';

// Initial state template
const initialState = {
    tournaments: [], // { id, name, status, players: [], rounds: [] }
    // status: 'pending', 'active', 'completed'
};

function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return initialState;
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("Local storage corruption, resetting.");
        return initialState;
    }
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- Data Access API ---

const Store = {
    getTournaments() {
        return loadData().tournaments;
    },

    getTournament(id) {
        return this.getTournaments().find(t => t.id === id);
    },

    createTournament(name) {
        const data = loadData();
        const newTournament = {
            id: Date.now().toString(),
            name: name,
            status: 'pending',
            players: [],
            rounds: []
        };
        data.tournaments.push(newTournament);
        saveData(data);
        return newTournament;
    },

    deleteTournament(id) {
        const data = loadData();
        data.tournaments = data.tournaments.filter(t => t.id !== id);
        saveData(data);
    },

    addPlayer(tournamentId, player) {
        const data = loadData();
        const t = data.tournaments.find(t => t.id === tournamentId);
        if (t && t.status === 'pending') {
            player.id = Date.now().toString();
            // Initialize stats
            player.points = 0;
            player.gamesPlayed = 0;
            player.wins = 0;
            t.players.push(player);
            saveData(data);
            return player;
        }
        return null; // Cannot add players if tournament is not pending
    },

    removePlayer(tournamentId, playerId) {
        const data = loadData();
        const t = data.tournaments.find(t => t.id === tournamentId);
        if (t && t.status === 'pending') {
            t.players = t.players.filter(p => p.id !== playerId);
            saveData(data);
        }
    },

    updateTournamentStatus(id, newStatus) {
        const data = loadData();
        const t = data.tournaments.find(t => t.id === id);
        if (t) {
            t.status = newStatus;
            saveData(data);
        }
    },

    saveRounds(tournamentId, rounds) {
        const data = loadData();
        const t = data.tournaments.find(t => t.id === tournamentId);
        if (t) {
            t.rounds = rounds;
            t.status = 'active'; // implicitly activate
            saveData(data);
        }
    },

    updateMatchResult(tournamentId, roundIndex, matchId, whiteResult, blackResult) {
        const data = loadData();
        const t = data.tournaments.find(t => t.id === tournamentId);
        if (!t) return;

        const round = t.rounds[roundIndex];
        const match = round.find(m => m.id === matchId);
        
        if (match) {
            match.resultWhite = whiteResult; // 1, 0.5, 0
            match.resultBlack = blackResult; // 1, 0.5, 0
            match.played = true;
            this._recalculateStandings(t);
            saveData(data);
        }
    },

    _recalculateStandings(tournament) {
        // Reset player scores
        tournament.players.forEach(p => {
            p.points = 0;
            p.wins = 0;
            p.gamesPlayed = 0;
        });

        // Tally up from rounds
        tournament.rounds.forEach(round => {
            round.forEach(match => {
                if (match.played && !match.isBye) {
                    const white = tournament.players.find(p => p.id === match.whiteId);
                    const black = tournament.players.find(p => p.id === match.blackId);
                    
                    if (white && match.resultWhite !== null) {
                        white.points += match.resultWhite;
                        white.gamesPlayed += 1;
                        if(match.resultWhite === 1) white.wins += 1;
                    }
                    if (black && match.resultBlack !== null) {
                        black.points += match.resultBlack;
                        black.gamesPlayed += 1;
                        if(match.resultBlack === 1) black.wins += 1;
                    }
                }
            });
        });
    }
};
