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

        if ("SUIZO".equals(torneo.getSistemaJuego())) {
            return generarRondaSuizo(torneo, inscripciones);
        } else {
            return generarRoundRobin(torneo, inscripciones);
        }
    }

    private List<Partida> generarRoundRobin(Torneo torneo, List<Inscripcion> inscripciones) {
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

    private List<Partida> generarRondaSuizo(Torneo torneo, List<Inscripcion> inscripciones) {
        List<Partida> partidasExistentes = partidaRepository.findByTorneoId(torneo.getId());
        
        // Determinar qué ronda toca
        int rondaActual = 0;
        for(Partida p : partidasExistentes) {
            if(p.getRondaNumero() > rondaActual) rondaActual = p.getRondaNumero();
        }
        int nuevaRonda = rondaActual + 1;

        // Ordenar por puntos (descendente) y ELO (descendente)
        List<Inscripcion> ordenados = new ArrayList<>(inscripciones);
        ordenados.sort((a, b) -> {
            int ptsCmp = Double.compare(b.getPuntosAcumulados(), a.getPuntosAcumulados());
            if (ptsCmp != 0) return ptsCmp;
            return Integer.compare(b.getUsuario().getEloRating(), a.getUsuario().getEloRating());
        });

        List<Usuario> jugadores = new ArrayList<>();
        for(Inscripcion i : ordenados) {
            jugadores.add(i.getUsuario());
        }

        if(jugadores.size() % 2 != 0) {
            Usuario byeUser = new Usuario();
            byeUser.setId(-1L);
            byeUser.setUsername("BYE");
            // Agregar al final (al de menor puntaje/ELO)
            jugadores.add(byeUser);
        }

        List<Partida> partidasGeneradas = new ArrayList<>();
        
        // Emparejamiento simplificado: 1vs2, 3vs4... 
        // En un suizo real se evita que jueguen dos veces, aquí hacemos una versión básica
        for(int i = 0; i < jugadores.size(); i += 2) {
            Usuario white = jugadores.get(i);
            Usuario black = jugadores.get(i+1);
            
            // Alternar colores según la ronda si es posible (simplificado)
            if (nuevaRonda % 2 == 0 && white.getId() != -1L && black.getId() != -1L) {
                Usuario temp = white;
                white = black;
                black = temp;
            }

            Partida partida = new Partida();
            partida.setTorneo(torneo);
            partida.setRondaNumero(nuevaRonda);

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

        torneo.setEstado("EN_CURSO");
        torneoRepository.save(torneo);

        return partidasGeneradas;
    }

    @Transactional
    public void actualizarPuntos(Long torneoId) {
        List<Inscripcion> inscripciones = inscripcionRepository.findByTorneoId(torneoId);
        List<Partida> partidas = partidaRepository.findByTorneoId(torneoId);

        // Primera pasada: Calcular puntos
        for (Inscripcion ins : inscripciones) {
            double puntos = 0;
            int jugadas = 0;
            int wins = 0;
            int draws = 0;
            int losses = 0;
            Long userId = ins.getUsuario().getId();

            for (Partida p : partidas) {
                if (p.getResultado() == null || p.getResultado().equals("P")) continue;

                boolean isWhite = p.getBlancas() != null && p.getBlancas().getId().equals(userId);
                boolean isBlack = p.getNegras() != null && p.getNegras().getId().equals(userId);

                if (isWhite) {
                    jugadas++;
                    if (p.getResultado().equals("1-0") || p.getResultado().equals("BYE")) {
                        puntos += 1; wins++;
                    } else if (p.getResultado().equals("0.5-0.5")) {
                        puntos += 0.5; draws++;
                    } else if (p.getResultado().equals("0-1")) {
                        losses++;
                    }
                } else if (isBlack) {
                    jugadas++;
                    if (p.getResultado().equals("0-1")) {
                        puntos += 1; wins++;
                    } else if (p.getResultado().equals("0.5-0.5")) {
                        puntos += 0.5; draws++;
                    } else if (p.getResultado().equals("1-0")) {
                        losses++;
                    }
                }
            }
            ins.setPuntosAcumulados(puntos);
            ins.setPartidasJugadas(jugadas);
            ins.setVictorias(wins);
            ins.setEmpates(draws);
            ins.setDerrotas(losses);
        }

        // Save para asegurar que tenemos puntos actuales para el pase 2
        inscripcionRepository.saveAll(inscripciones);

        // Segunda pasada: Calcular desempates
        for (Inscripcion ins : inscripciones) {
            double buchholz = 0;
            double sonnebornBerger = 0;
            Long userId = ins.getUsuario().getId();

            for (Partida p : partidas) {
                if (p.getResultado() == null || p.getResultado().equals("P")) continue;

                boolean isWhite = p.getBlancas() != null && p.getBlancas().getId().equals(userId);
                boolean isBlack = p.getNegras() != null && p.getNegras().getId().equals(userId);
                if(!isWhite && !isBlack) continue;
                
                Usuario opponent = null;
                double result = 0;
                
                if (isWhite) {
                    opponent = p.getNegras();
                    if(p.getResultado().equals("1-0") || p.getResultado().equals("BYE")) result = 1.0;
                    else if(p.getResultado().equals("0.5-0.5")) result = 0.5;
                } else {
                    opponent = p.getBlancas();
                    if(p.getResultado().equals("0-1")) result = 1.0;
                    else if(p.getResultado().equals("0.5-0.5")) result = 0.5;
                }
                
                if (opponent != null) {
                    Long oppId = opponent.getId();
                    Inscripcion oppIns = inscripciones.stream().filter(i -> i.getUsuario().getId().equals(oppId)).findFirst().orElse(null);
                    if(oppIns != null) {
                        double oppPts = oppIns.getPuntosAcumulados();
                        buchholz += oppPts;
                        sonnebornBerger += (oppPts * result);
                    }
                }
            }
            ins.setBuchholz(buchholz);
            ins.setSonnebornBerger(sonnebornBerger);
        }
        inscripcionRepository.saveAll(inscripciones);
    }
}
