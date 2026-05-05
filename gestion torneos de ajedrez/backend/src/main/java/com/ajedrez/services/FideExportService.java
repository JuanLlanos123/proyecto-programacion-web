package com.ajedrez.services;

import com.ajedrez.models.Inscripcion;
import com.ajedrez.models.Partida;
import com.ajedrez.models.Torneo;
import com.ajedrez.models.Usuario;
import com.ajedrez.repositories.InscripcionRepository;
import com.ajedrez.repositories.PartidaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;
import java.util.*;

@Service
public class FideExportService {

    @Autowired
    private InscripcionRepository inscripcionRepository;

    @Autowired
    private PartidaRepository partidaRepository;

    public String generateTrf(Torneo torneo) {
        StringBuilder trf = new StringBuilder();
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy/MM/dd");
        String startDate = torneo.getFechaInicio() != null ? sdf.format(torneo.getFechaInicio()) : "";
        String endDate = torneo.getFechaFin() != null ? sdf.format(torneo.getFechaFin()) : startDate;

        List<Inscripcion> inscripciones = inscripcionRepository.findByTorneoId(torneo.getId());
        List<Partida> partidas = partidaRepository.findByTorneoId(torneo.getId());

        // Header
        trf.append("012 ").append(torneo.getNombre()).append("\n");
        trf.append("022 ").append(torneo.getUbicacion() != null ? torneo.getUbicacion() : "Online").append("\n");
        trf.append("032 ").append("\n"); // Federation
        trf.append("042 ").append(startDate).append("\n");
        trf.append("052 ").append(endDate).append("\n");
        trf.append("062 ").append(inscripciones.size()).append("\n");
        trf.append("072 ").append(inscripciones.size()).append("\n"); // Assume all rated
        trf.append("082 0\n"); // Teams
        trf.append("092 ").append(torneo.getSistemaJuego()).append("\n"); // Type
        trf.append("102 \n"); // Arbiter
        trf.append("112 \n"); // Time control
        trf.append("122 \n"); // Dates
        trf.append("132 \n"); // Dates

        // Sort players by points, then buchholz for rank calculation
        inscripciones.sort((a, b) -> {
            if (b.getPuntosAcumulados().compareTo(a.getPuntosAcumulados()) != 0)
                return b.getPuntosAcumulados().compareTo(a.getPuntosAcumulados());
            if (b.getBuchholz().compareTo(a.getBuchholz()) != 0)
                return b.getBuchholz().compareTo(a.getBuchholz());
            return b.getSonnebornBerger().compareTo(a.getSonnebornBerger());
        });

        // Assign starting rank (by ELO)
        List<Inscripcion> byElo = new ArrayList<>(inscripciones);
        byElo.sort((a, b) -> b.getUsuario().getEloRating().compareTo(a.getUsuario().getEloRating()));

        Map<Long, Integer> startingRanks = new HashMap<>();
        Map<Long, Integer> currentRanks = new HashMap<>();
        
        for (int i = 0; i < byElo.size(); i++) {
            startingRanks.put(byElo.get(i).getUsuario().getId(), i + 1);
        }
        for (int i = 0; i < inscripciones.size(); i++) {
            currentRanks.put(inscripciones.get(i).getUsuario().getId(), i + 1);
        }

        int maxRondas = partidas.stream().mapToInt(Partida::getRondaNumero).max().orElse(0);

        // Player section
        for (Inscripcion ins : inscripciones) {
            Usuario u = ins.getUsuario();
            int startRank = startingRanks.get(u.getId());
            int curRank = currentRanks.get(u.getId());
            
            // Format: 001 StartRank Title Name FideID Fed Rating DOB Pts Rank
            // We use fixed width for FIDE TRF compliance
            String name = u.getUsername().length() > 33 ? u.getUsername().substring(0, 33) : String.format("%-33s", u.getUsername());
            
            trf.append(String.format("001 %4d      %s           %4d        %4.1f %4d ",
                    startRank, name, u.getEloRating(), ins.getPuntosAcumulados(), curRank));

            // Matches
            for (int r = 1; r <= maxRondas; r++) {
                int finalR = r;
                Partida partida = partidas.stream()
                        .filter(p -> p.getRondaNumero() == finalR && 
                               ((p.getBlancas() != null && p.getBlancas().getId().equals(u.getId())) || 
                                (p.getNegras() != null && p.getNegras().getId().equals(u.getId()))))
                        .findFirst().orElse(null);

                if (partida == null) {
                    trf.append("  0000 - Z ");
                } else if (partida.getBlancas() == null || partida.getNegras() == null) {
                    // BYE
                    trf.append("  0000 - U ");
                } else {
                    boolean isWhite = partida.getBlancas().getId().equals(u.getId());
                    Usuario opp = isWhite ? partida.getNegras() : partida.getBlancas();
                    int oppRank = startingRanks.get(opp.getId());
                    char color = isWhite ? 'w' : 'b';
                    char res;
                    if (partida.getResultado().equals("1-0")) {
                        res = isWhite ? '1' : '0';
                    } else if (partida.getResultado().equals("0-1")) {
                        res = isWhite ? '0' : '1';
                    } else if (partida.getResultado().equals("0.5-0.5")) {
                        res = '=';
                    } else {
                        res = '-'; // Pending
                    }
                    trf.append(String.format("  %4d %c %c ", oppRank, color, res));
                }
            }
            trf.append("\n");
        }

        return trf.toString();
    }
}
