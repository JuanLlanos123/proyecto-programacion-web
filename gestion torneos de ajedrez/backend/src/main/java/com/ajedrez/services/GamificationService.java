package com.ajedrez.services;

import com.ajedrez.models.Achievement;
import com.ajedrez.models.Partida;
import com.ajedrez.models.Torneo;
import com.ajedrez.models.Usuario;
import com.ajedrez.repositories.AchievementRepository;
import com.ajedrez.repositories.InscripcionRepository;
import com.ajedrez.repositories.PartidaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class GamificationService {
    @Autowired private AchievementRepository achievementRepository;
    @Autowired private PartidaRepository partidaRepository;
    @Autowired private InscripcionRepository inscripcionRepository;

    public void checkMatchAchievements(Partida p) {
        if ("P".equals(p.getResultado()) || "BYE".equals(p.getResultado())) return;
        
        // Matagigantes: Ganar a alguien con +200 de ELO
        if ("1-0".equals(p.getResultado())) {
            checkMatagigantes(p.getBlancas(), p.getNegras());
        } else if ("0-1".equals(p.getResultado())) {
            checkMatagigantes(p.getNegras(), p.getBlancas());
        }
    }

    private void checkMatagigantes(Usuario winner, Usuario loser) {
        if (winner == null || loser == null) return;
        if (loser.getEloRating() > winner.getEloRating() + 200) {
            grantAchievement(winner, "Matagigantes", "Ganaste a un oponente con más de 200 puntos de ELO que tú.", "fa-solid fa-hand-fist");
        }
    }

    public void checkTournamentAchievements(Torneo t, Usuario winner) {
        // El Invencible: Ganar un torneo sin perder
        List<Partida> matches = partidaRepository.findByTorneoId(t.getId());
        boolean hasLoss = matches.stream().anyMatch(p -> {
            if (p.getBlancas() != null && p.getBlancas().getId().equals(winner.getId()) && "0-1".equals(p.getResultado())) return true;
            if (p.getNegras() != null && p.getNegras().getId().equals(winner.getId()) && "1-0".equals(p.getResultado())) return true;
            return false;
        });
        if (!hasLoss) {
            grantAchievement(winner, "El Invencible", "Ganaste un torneo sin perder ninguna partida.", "fa-solid fa-shield-halved");
        }
        
        // Fiel al Tablero: 5 torneos jugados
        long count = inscripcionRepository.countByUsuarioId(winner.getId());
        if (count >= 5) {
            grantAchievement(winner, "Fiel al Tablero", "Has participado en 5 torneos o más.", "fa-solid fa-chess-board");
        }
    }

    public void grantAchievement(Usuario user, String name, String desc, String icon) {
        if (!achievementRepository.existsByUserIdAndName(user.getId(), name)) {
            achievementRepository.save(new Achievement(name, desc, icon, user));
        }
    }

    public void deleteAchievement(Long achievementId) {
        achievementRepository.deleteById(achievementId);
    }
    
    public List<Achievement> getUserAchievements(Long userId) {
        return achievementRepository.findByUserId(userId);
    }
}
