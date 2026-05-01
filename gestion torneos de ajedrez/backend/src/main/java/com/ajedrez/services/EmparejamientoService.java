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
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class EmparejamientoService {

    @Autowired
    private PartidaRepository partidaRepository;
    
    @Autowired
    private TorneoRepository torneoRepository;

    @Autowired
    private InscripcionRepository inscripcionRepository;

    /**
     * Punto de entrada principal para generar emparejamientos.
     * Selecciona el algoritmo adecuado basado en el sistema de juego del torneo.
     * 
     * @param torneo El torneo para el cual generar la ronda.
     * @param inscripciones Lista de jugadores inscritos actualmente.
     * @return Lista de partidas (emparejamientos) generadas y guardadas.
     */
    @Transactional
    public List<Partida> generarRondas(Torneo torneo, List<Inscripcion> inscripciones) {
        if(inscripciones.size() < 2) return new ArrayList<>();

        if ("SUIZO".equals(torneo.getSistemaJuego())) {
            return generarRondaSuizo(torneo, inscripciones);
        } else if ("ELIMINATORIA".equals(torneo.getSistemaJuego())) {
            return generarRondaEliminatoria(torneo, inscripciones);
        } else if ("DOBLE_ELIMINATORIA".equals(torneo.getSistemaJuego())) {
            return generarRondaDobleEliminatoria(torneo, inscripciones);
        } else {
            return generarRoundRobin(torneo, inscripciones);
        }
    }

    /**
     * Implementa el algoritmo de Round Robin (Todos contra todos).
     * Utiliza el sistema de rotación para asegurar que todos jueguen contra todos.
     */
    private List<Partida> generarRoundRobin(Torneo torneo, List<Inscripcion> inscripciones) {
        List<Usuario> jugadores = new ArrayList<>();
        for(Inscripcion i : inscripciones) {
            jugadores.add(i.getUsuario());
        }

        Collections.shuffle(jugadores);

        if(jugadores.size() % 2 != 0) {
            Usuario byeUser = new Usuario();
            byeUser.setId(-1L);
            byeUser.setUsername("DESCANSA");
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

    /**
     * Algoritmo de Sistema Suizo.
     * Empareja a jugadores con igual o similar puntuación.
     * Evita que dos jugadores se enfrenten más de una vez en el mismo torneo.
     * Prioriza la alternancia de colores (Blancas/Negras).
     */
    private List<Partida> generarRondaSuizo(Torneo torneo, List<Inscripcion> inscripciones) {
        List<Partida> partidasExistentes = partidaRepository.findByTorneoId(torneo.getId());
        
        int rondaActual = 0;
        for(Partida p : partidasExistentes) {
            if(p.getRondaNumero() > rondaActual) rondaActual = p.getRondaNumero();
        }
        
        // GUARD: No generar si la ronda actual no ha terminado
        final int rondaFijada = rondaActual;
        boolean rondaPendiente = partidasExistentes.stream()
                .filter(p -> p.getRondaNumero() == rondaFijada)
                .anyMatch(p -> p.getResultado() == null || "P".equals(p.getResultado()));
        
        if (rondaPendiente && rondaActual > 0) return new ArrayList<>();

        int nuevaRonda = rondaActual + 1;

        List<Inscripcion> ordenados = new ArrayList<>(inscripciones);
        ordenados.sort((a, b) -> {
            int ptsCmp = Double.compare(b.getPuntosAcumulados(), a.getPuntosAcumulados());
            if (ptsCmp != 0) return ptsCmp;
            return Integer.compare(b.getUsuario().getEloRating(), a.getUsuario().getEloRating());
        });

        List<Usuario> jugadoresDisponibles = new ArrayList<>();
        for(Inscripcion i : ordenados) jugadoresDisponibles.add(i.getUsuario());

        Usuario byeUser = null;
        if(jugadoresDisponibles.size() % 2 != 0) {
            byeUser = new Usuario();
            byeUser.setId(-1L);
            byeUser.setUsername("DESCANSA");
        }

        List<Partida> partidasGeneradas = new ArrayList<>();
        
        while (!jugadoresDisponibles.isEmpty()) {
            Usuario white = jugadoresDisponibles.remove(0);
            Usuario black = null;
            
            for (int j = 0; j < jugadoresDisponibles.size(); j++) {
                Usuario candidato = jugadoresDisponibles.get(j);
                if (!yaJugaron(white, candidato, partidasExistentes)) {
                    black = jugadoresDisponibles.remove(j);
                    break;
                }
            }
            
            if (black == null && !jugadoresDisponibles.isEmpty()) {
                black = jugadoresDisponibles.remove(0);
            } else if (black == null && byeUser != null) {
                black = byeUser;
                byeUser = null;
            }

            if (black != null) {
                Partida partida = new Partida();
                partida.setTorneo(torneo);
                partida.setRondaNumero(nuevaRonda);

                if(black.getId() != null && black.getId() == -1L) {
                    partida.setResultado("BYE");
                    partida.setBlancas(white);
                    partida.setNegras(null);
                } else {
                    if (nuevaRonda % 2 == 0) {
                        partida.setBlancas(black);
                        partida.setNegras(white);
                    } else {
                        partida.setBlancas(white);
                        partida.setNegras(black);
                    }
                }
                partidasGeneradas.add(partidaRepository.save(partida));
            }
        }

        torneo.setEstado("EN_CURSO");
        torneoRepository.save(torneo);
        return partidasGeneradas;
    }

    private List<Partida> generarRondaEliminatoria(Torneo torneo, List<Inscripcion> inscripciones) {
        List<Partida> partidasExistentes = partidaRepository.findByTorneoId(torneo.getId());
        int rondaActual = 0;
        for(Partida p : partidasExistentes) {
            if(p.getRondaNumero() > rondaActual) rondaActual = p.getRondaNumero();
        }
        int nuevaRonda = rondaActual + 1;
        List<Usuario> jugadoresParaEstaRonda = new ArrayList<>();
        if (rondaActual == 0) {
            for(Inscripcion i : inscripciones) jugadoresParaEstaRonda.add(i.getUsuario());
            Collections.shuffle(jugadoresParaEstaRonda);
        } else {
            final int rAnt = rondaActual;
            List<Partida> rondaAnterior = new ArrayList<>();
            for(Partida p : partidasExistentes) if(p.getRondaNumero() == rAnt) rondaAnterior.add(p);
            for (Partida p : rondaAnterior) {
                if ("1-0".equals(p.getResultado()) || "BYE".equals(p.getResultado())) jugadoresParaEstaRonda.add(p.getBlancas());
                else if ("0-1".equals(p.getResultado())) jugadoresParaEstaRonda.add(p.getNegras());
                else if ("0.5-0.5".equals(p.getResultado())) jugadoresParaEstaRonda.add(p.getBlancas());
            }
        }
        if (jugadoresParaEstaRonda.size() < 2 && rondaActual > 0) return new ArrayList<>();
        Usuario byeUser = null;
        if (jugadoresParaEstaRonda.size() % 2 != 0) {
            byeUser = new Usuario();
            byeUser.setId(-1L);
            byeUser.setUsername("DESCANSA");
        }
        List<Partida> partidasGeneradas = new ArrayList<>();
        while (!jugadoresParaEstaRonda.isEmpty()) {
            Usuario white = jugadoresParaEstaRonda.remove(0);
            Usuario black = !jugadoresParaEstaRonda.isEmpty() ? jugadoresParaEstaRonda.remove(0) : byeUser;
            if (black != null) {
                Partida partida = new Partida();
                partida.setTorneo(torneo);
                partida.setRondaNumero(nuevaRonda);
                if (black.getId() != null && black.getId() == -1L) {
                    partida.setResultado("BYE");
                    partida.setBlancas(white);
                    partida.setNegras(null);
                } else {
                    partida.setBlancas(white);
                    partida.setNegras(black);
                }
                partidasGeneradas.add(partidaRepository.save(partida));
            }
        }
        torneo.setEstado("EN_CURSO");
        torneoRepository.save(torneo);
        return partidasGeneradas;
    }

    private List<Partida> generarRondaDobleEliminatoria(Torneo torneo, List<Inscripcion> inscripciones) {
        List<Partida> partidasExistentes = partidaRepository.findByTorneoId(torneo.getId());
        int rondaActual = 0;
        for(Partida p : partidasExistentes) if(p.getRondaNumero() > rondaActual) rondaActual = p.getRondaNumero();
        int nuevaRonda = rondaActual + 1;

        if (rondaActual == 0) {
            List<Usuario> todos = new ArrayList<>();
            for(Inscripcion i : inscripciones) todos.add(i.getUsuario());
            Collections.shuffle(todos);
            return crearPartidas(torneo, nuevaRonda, todos);
        }

        List<Usuario> winners = new ArrayList<>();
        List<Usuario> losers = new ArrayList<>();
        
        for (Inscripcion ins : inscripciones) {
            int derrotas = contarDerrotas(ins.getUsuario().getId(), partidasExistentes);
            if (derrotas == 0) winners.add(ins.getUsuario());
            else if (derrotas == 1) losers.add(ins.getUsuario());
        }

        // CASO ESPECIAL: GRAN FINAL (1 vs 1)
        if (winners.size() == 1 && losers.size() == 1) {
            Partida finalMatch = new Partida();
            finalMatch.setTorneo(torneo);
            finalMatch.setRondaNumero(nuevaRonda);
            finalMatch.setBlancas(winners.get(0));
            finalMatch.setNegras(losers.get(0));
            return List.of(partidaRepository.save(finalMatch));
        }

        List<Partida> nuevasPartidas = new ArrayList<>();
        nuevasPartidas.addAll(crearPartidas(torneo, nuevaRonda, winners));
        nuevasPartidas.addAll(crearPartidas(torneo, nuevaRonda, losers));

        torneo.setEstado("EN_CURSO");
        torneoRepository.save(torneo);
        return nuevasPartidas;
    }

    private List<Partida> crearPartidas(Torneo torneo, int ronda, List<Usuario> jugadores) {
        List<Partida> generadas = new ArrayList<>();
        List<Usuario> pool = new ArrayList<>(jugadores);
        
        // Si solo hay un jugador en este pool y no es la gran final, descansa
        if (pool.size() == 1) {
            Partida p = new Partida();
            p.setTorneo(torneo);
            p.setRondaNumero(ronda);
            p.setBlancas(pool.get(0));
            p.setNegras(null);
            p.setResultado("BYE");
            generadas.add(partidaRepository.save(p));
            return generadas;
        }

        Usuario byeUser = null;
        if (pool.size() % 2 != 0) {
            byeUser = new Usuario();
            byeUser.setId(-1L);
            byeUser.setUsername("DESCANSA");
        }
        while (!pool.isEmpty()) {
            Usuario w = pool.remove(0);
            Usuario b = !pool.isEmpty() ? pool.remove(0) : byeUser;
            if (b != null) {
                Partida p = new Partida();
                p.setTorneo(torneo);
                p.setRondaNumero(ronda);
                p.setBlancas(w);
                if (b.getId() != null && b.getId() == -1L) {
                    p.setResultado("BYE");
                    p.setNegras(null);
                } else {
                    p.setNegras(b);
                }
                generadas.add(partidaRepository.save(p));
            }
        }
        return generadas;
    }

    private int contarDerrotas(Long userId, List<Partida> historial) {
        int derrotas = 0;
        for (Partida p : historial) {
            if (p.getResultado() == null || p.getResultado().equals("P")) continue;
            boolean isWhite = p.getBlancas() != null && p.getBlancas().getId().equals(userId);
            boolean isBlack = p.getNegras() != null && p.getNegras().getId().equals(userId);
            
            if ("BYE".equals(p.getResultado())) continue; // Un BYE no cuenta como derrota ni victoria para desempates de bracket

            if (isWhite && "0-1".equals(p.getResultado())) derrotas++;
            if (isBlack && "1-0".equals(p.getResultado())) derrotas++;
        }
        return derrotas;
    }

    private boolean yaJugaron(Usuario u1, Usuario u2, List<Partida> historial) {
        if (u1.getId() == -1L || u2.getId() == -1L) return false;
        for (Partida p : historial) {
            if (p.getBlancas() == null || p.getNegras() == null) continue;
            Long wId = p.getBlancas().getId();
            Long bId = p.getNegras().getId();
            if ((wId.equals(u1.getId()) && bId.equals(u2.getId())) || (wId.equals(u2.getId()) && bId.equals(u1.getId()))) return true;
        }
        return false;
    }

    /**
     * Recalcula los puntos y desempates para todos los inscritos en un torneo.
     * Calcula:
     * - Puntos (1 por victoria, 0.5 por tablas).
     * - Buchholz: Suma de puntos de todos los oponentes.
     * - Sonneborn-Berger: Suma de puntos de oponentes vencidos + mitad de puntos de oponentes empatados.
     */
    @Transactional
    public void actualizarPuntos(Long torneoId) {
        List<Inscripcion> inscripciones = inscripcionRepository.findByTorneoId(torneoId);
        List<Partida> partidas = partidaRepository.findByTorneoId(torneoId);

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

        inscripcionRepository.saveAll(inscripciones);

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
