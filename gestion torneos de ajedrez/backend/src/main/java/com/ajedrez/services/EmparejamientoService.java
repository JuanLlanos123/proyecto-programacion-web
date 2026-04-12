package com.ajedrez.services;

import com.ajedrez.models.Inscripcion;
import com.ajedrez.models.Partida;
import com.ajedrez.models.Torneo;
import com.ajedrez.models.Usuario;
import com.ajedrez.repositories.PartidaRepository;
import com.ajedrez.repositories.TorneoRepository;
import com.ajedrez.repositories.InscripcionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
public class EmparejamientoService {

    @Autowired
    private PartidaRepository partidaRepository;
    
    @Autowired
    private TorneoRepository torneoRepository;

    @Autowired
    private InscripcionRepository inscripcionRepository;

    @Transactional
    public List<Partida> generarRondas(Torneo torneo, List<Inscripcion> inscripciones) {
        if(inscripciones.size() < 2) return new ArrayList<>();

        List<Usuario> jugadores = new ArrayList<>();
        for(Inscripcion i : inscripciones) {
            jugadores.add(i.getUsuario());
        }

        Collections.shuffle(jugadores);

        if(jugadores.size() % 2 != 0) {
            Usuario byeUser = new Usuario();
            byeUser.setId(-1L);
            byeUser.setUsername("BYE");
            jugadores.add(byeUser);
        }

        int numRondas = jugadores.size() - 1;
        int medio = jugadores.size() / 2;
        List<Partida> partidasGeneradas = new ArrayList<>();

        for(int r = 0; r < numRondas; r++) {
            for(int i = 0; i < medio; i++) {
                Usuario white = jugadores.get(i);
                Usuario black = jugadores.get(jugadores.size() - 1 - i);

                if(i == 0 && r % 2 != 0) {
                    Usuario temp = white;
                    white = black;
                    black = temp;
                }

                Partida partida = new Partida();
                partida.setTorneo(torneo);
                partida.setRondaNumero(r + 1);

                if(white.getId() == -1L || black.getId() == -1L) {
                    partida.setResultado("BYE");
                    Usuario realPlayer = white.getId() == -1L ? black : white;
                    partida.setBlancas(realPlayer);
                    partida.setNegras(null);
                } else {
                    partida.setBlancas(white);
                    partida.setNegras(black);
                }
                
                partidasGeneradas.add(partidaRepository.save(partida));
            }
            Usuario last = jugadores.remove(jugadores.size() - 1);
            jugadores.add(1, last);
        }

        torneo.setEstado("EN_CURSO");
        torneoRepository.save(torneo);

        return partidasGeneradas;
    }

    @Transactional
    public void actualizarPuntos(Long torneoId) {
        List<Inscripcion> inscripciones = inscripcionRepository.findByTorneoId(torneoId);
        List<Partida> partidas = partidaRepository.findByTorneoId(torneoId);

        for (Inscripcion ins : inscripciones) {
            double puntos = 0;
            int jugadas = 0;
            Long userId = ins.getUsuario().getId();

            for (Partida p : partidas) {
                if (p.getResultado() == null || p.getResultado().equals("P") || p.getResultado().equals("BYE")) continue;

                if (p.getBlancas() != null && p.getBlancas().getId().equals(userId)) {
                    jugadas++;
                    if (p.getResultado().equals("1-0")) puntos += 1;
                    else if (p.getResultado().equals("0.5-0.5")) puntos += 0.5;
                } else if (p.getNegras() != null && p.getNegras().getId().equals(userId)) {
                    jugadas++;
                    if (p.getResultado().equals("0-1")) puntos += 1;
                    else if (p.getResultado().equals("0.5-0.5")) puntos += 0.5;
                }
            }
            ins.setPuntosAcumulados(puntos);
            ins.setPartidasJugadas(jugadas);
            inscripcionRepository.save(ins);
        }
    }
}
