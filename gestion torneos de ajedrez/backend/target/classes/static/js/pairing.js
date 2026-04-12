/**
 * pairing.js
 * Implements Round Robin pairing logic.
 */

const Pairing = {
    /**
     * Generates all rounds and matches for a Round Robin tournament.
     * @param {Array} players - Array of player objects {id, name, ...}
     * @returns {Array} Array of rounds, where each round is an array of matches.
     */
    generateRoundRobin(players) {
        if (!players || players.length < 2) return [];
        
        // Create a copy of the player list
        let pList = [...players];
        
        // If odd number of players, add a 'BYE' player
        if (pList.length % 2 !== 0) {
            pList.push({ id: 'BYE', name: '- Descansa -' });
        }
        
        const numRounds = pList.length - 1;
        const halfSize = pList.length / 2;
        const rounds = [];
        
        for (let r = 0; r < numRounds; r++) {
            const roundMatches = [];
            for (let i = 0; i < halfSize; i++) {
                let white = pList[i];
                let black = pList[pList.length - 1 - i];
                
                // Color alternation for the fixed player (index 0)
                if (i === 0 && r % 2 !== 0) {
                     const temp = white;
                     white = black;
                     black = temp;
                }
                
                let isBye = (white.id === 'BYE' || black.id === 'BYE');
                let byePlayerId = null;
                
                if (isBye) {
                    byePlayerId = white.id === 'BYE' ? black.id : white.id;
                }
                
                roundMatches.push({
                    id: Math.random().toString(36).substr(2, 9),
                    whiteId: white.id,
                    whiteName: white.name,
                    blackId: black.id,
                    blackName: black.name,
                    resultWhite: isBye ? null : null,
                    resultBlack: isBye ? null : null,
                    played: isBye,  // If it's a bye, it's implicitly played
                    isBye: isBye
                });
            }
            rounds.push(roundMatches);
            
            // Rotate list: Keep index 0 fixed, shift others right
            pList.splice(1, 0, pList.pop());
        }
        
        return rounds;
    }
};
