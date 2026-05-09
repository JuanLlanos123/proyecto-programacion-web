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
            return generarRondaEliminatoria(torneo, inscripciones, false);
        } else if ("DOBLE_ELIMINATORIA".equals(torneo.getSistemaJuego())) {
            return generarRondaDobleEliminatoria(torneo, inscripciones);
        } else if ("GRUPOS".equals(torneo.getSistemaJuego())) {
            return generarRondaGrupos(torneo, inscripciones);
        } else if ("EQUIPOS".equals(torneo.getSistemaJuego())) {
            return generarRondaEquipos(torneo, inscripciones);
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

        // GUARD: No generar más rondas si ya se alcanzó el máximo (si está definido)
        if (torneo.getMaxRondas() != null && nuevaRonda > torneo.getMaxRondas()) {
            return new ArrayList<>();
        }

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

    private List<Partida> generarRondaEliminatoria(Torneo torneo, List<Inscripcion> inscripciones, boolean ignoreExisting) {
        List<Partida> partidasExistentes = partidaRepository.findByTorneoId(torneo.getId());
        int rondaActual = 0;
        for(Partida p : partidasExistentes) {
            if(p.getRondaNumero() != null && p.getRondaNumero() > rondaActual) rondaActual = p.getRondaNumero();
        }
        int nuevaRonda = rondaActual + 1;
        List<Usuario> jugadoresParaEstaRonda = new ArrayList<>();
        
        if (rondaActual == 0 || ignoreExisting) {
            for(Inscripcion i : inscripciones) jugadoresParaEstaRonda.add(i.getUsuario());
            // No barajar si es forzado (fase de grupos a eliminatoria), para mantener cabezas de serie si se desea
            if (!ignoreExisting) Collections.shuffle(jugadoresParaEstaRonda);
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
    private List<Partida> generarRondaGrupos(Torneo torneo, List<Inscripcion> inscripciones) {
        // Asignar grupos si no están asignados (4 jugadores por grupo)
        List<Inscripcion> sinGrupo = inscripciones.stream().filter(i -> i.getNumeroGrupo() == null).collect(Collectors.toList());
        if (!sinGrupo.isEmpty()) {
            Collections.shuffle(sinGrupo);
            int grupoActual = 1;
            // Buscar el último grupo existente
            for (Inscripcion i : inscripciones) {
                if (i.getNumeroGrupo() != null && i.getNumeroGrupo() >= grupoActual) grupoActual = i.getNumeroGrupo() + 1;
            }
            
            for (int i = 0; i < sinGrupo.size(); i++) {
                sinGrupo.get(i).setNumeroGrupo(grupoActual);
                if ((i + 1) % 4 == 0) grupoActual++;
            }
            inscripcionRepository.saveAll(sinGrupo);
        }

        // Verificar si la fase de grupos ya terminó (todos tienen sus partidas jugadas)
        List<Partida> partidasExistentes = partidaRepository.findByTorneoId(torneo.getId());
        boolean faseGruposCompleta = !partidasExistentes.isEmpty() && partidasExistentes.stream().allMatch(p -> p.getResultado() != null && !p.getResultado().equals("P"));

        if (faseGruposCompleta) {
            // Fase de grupos terminada -> Iniciar fase eliminatoria
            // Tomar los 2 mejores de cada grupo
            List<Inscripcion> clasificados = new ArrayList<>();
            Map<Integer, List<Inscripcion>> grupos = inscripciones.stream()
                    .filter(i -> i.getNumeroGrupo() != null)
                    .collect(Collectors.groupingBy(Inscripcion::getNumeroGrupo));

            // Ordenar grupos por ID para consistencia en las llaves
            List<Integer> grupoIds = new ArrayList<>(grupos.keySet());
            Collections.sort(grupoIds);

            for (Integer gId : grupoIds) {
                List<Inscripcion> miembros = grupos.get(gId);
                miembros.sort((a, b) -> {
                    if (b.getPuntosAcumulados() != a.getPuntosAcumulados())
                        return Double.compare(b.getPuntosAcumulados(), a.getPuntosAcumulados());
                    return Double.compare(b.getSonnebornBerger(), a.getSonnebornBerger());
                });
                // Asegurar que cada grupo tenga al menos 2
                while(miembros.size() < 2) {
                    Inscripcion fake = new Inscripcion();
                    fake.setUsuario(null); // BYE placeholder logic handled in service
                    miembros.add(fake);
                }
            }

            // Cruzar grupos: A1 vs B2, B1 vs A2, C1 vs D2, D1 vs C2...
            for (int i = 0; i < grupoIds.size(); i += 2) {
                if (i + 1 < grupoIds.size()) {
                    List<Inscripcion> gA = grupos.get(grupoIds.get(i));
                    List<Inscripcion> gB = grupos.get(grupoIds.get(i + 1));
                    // Emparejamiento 1: Primero de A vs Segundo de B
                    clasificados.add(gA.get(0));
                    clasificados.add(gB.get(1));
                    // Emparejamiento 2: Primero de B vs Segundo de A
                    clasificados.add(gB.get(0));
                    clasificados.add(gA.get(1));
                } else {
                    // Si el número de grupos es impar, el último grupo se empareja internamente (o contra BYE si se prefiere)
                    List<Inscripcion> gLast = grupos.get(grupoIds.get(i));
                    clasificados.add(gLast.get(0));
                    clasificados.add(gLast.get(1));
                }
            }

            if (clasificados.size() < 2) return new ArrayList<>();

            // Generar llaves eliminatorias con los clasificados forzando el inicio
            return generarRondaEliminatoria(torneo, clasificados, true);
        }

        // Si no está completa, generar Round Robin para cada grupo (fase inicial)
        List<Partida> todasLasPartidas = new ArrayList<>();
        Map<Integer, List<Inscripcion>> gruposMap = inscripciones.stream()
                .filter(i -> i.getNumeroGrupo() != null)
                .collect(Collectors.groupingBy(Inscripcion::getNumeroGrupo));

        if (!partidasExistentes.isEmpty()) return new ArrayList<>(); // Ya se generaron los grupos

        for (Map.Entry<Integer, List<Inscripcion>> entry : gruposMap.entrySet()) {
            todasLasPartidas.addAll(generarRoundRobin(torneo, entry.getValue()));
        }

        return todasLasPartidas;
    }

    private List<Partida> generarRondaEquipos(Torneo torneo, List<Inscripcion> inscripciones) {
        // Agrupar jugadores por equipo
        Map<String, List<Inscripcion>> equiposMap = inscripciones.stream()
                .filter(i -> i.getNombreEquipo() != null && !i.getNombreEquipo().isEmpty())
                .collect(Collectors.groupingBy(Inscripcion::getNombreEquipo));
        
        List<String> nombresEquipos = new ArrayList<>(equiposMap.keySet());
        Collections.shuffle(nombresEquipos);
        
        List<Partida> generadas = new ArrayList<>();
        List<Partida> partidasExistentes = partidaRepository.findByTorneoId(torneo.getId());
        int rondaActual = partidasExistentes.stream()
                .mapToInt(p -> p.getRondaNumero() == null ? 0 : p.getRondaNumero()).max().orElse(0);
        int nuevaRonda = rondaActual + 1;

        while(nombresEquipos.size() >= 2) {
            String t1Name = nombresEquipos.remove(0);
            String t2Name = nombresEquipos.remove(0);
            List<Inscripcion> m1 = equiposMap.get(t1Name);
            List<Inscripcion> m2 = equiposMap.get(t2Name);
            
            // Ordenar por ELO para emparejar Tablero 1 vs Tablero 1, etc.
            m1.sort((a,b) -> (b.getUsuario().getEloRating() - a.getUsuario().getEloRating()));
            m2.sort((a,b) -> (b.getUsuario().getEloRating() - a.getUsuario().getEloRating()));
            
            int tableros = Math.min(m1.size(), m2.size());
            if (torneo.getNumTableros() != null && torneo.getNumTableros() > 0) {
                tableros = Math.min(tableros, torneo.getNumTableros());
            }
            
            for(int i=0; i < tableros; i++) {
                Partida p = new Partida();
                p.setTorneo(torneo);
                p.setRondaNumero(nuevaRonda);
                // Alternar colores por tablero
                if (i % 2 == 0) {
                    p.setBlancas(m1.get(i).getUsuario());
                    p.setNegras(m2.get(i).getUsuario());
                } else {
                    p.setBlancas(m2.get(i).getUsuario());
                    p.setNegras(m1.get(i).getUsuario());
                }
                generadas.add(partidaRepository.save(p));
            }
        }

        // Si quedó un equipo libre, darle BYE a sus miembros principales
        if (!nombresEquipos.isEmpty()) {
            String lastTeam = nombresEquipos.get(0);
            List<Inscripcion> members = equiposMap.get(lastTeam);
            int maxByes = torneo.getNumTableros() != null ? Math.min(members.size(), torneo.getNumTableros()) : members.size();
            for (int i = 0; i < maxByes; i++) {
                Partida p = new Partida();
                p.setTorneo(torneo);
                p.setRondaNumero(nuevaRonda);
                p.setBlancas(members.get(i).getUsuario());
                p.setResultado("BYE");
                generadas.add(partidaRepository.save(p));
            }
        }

        torneo.setEstado("EN_CURSO");
        torneoRepository.save(torneo);
        return generadas;
    }

    private boolean sonDelMismoEquipo(Usuario u1, Usuario u2, List<Inscripcion> inscripciones) {
        String equipo1 = inscripciones.stream().filter(i -> i.getUsuario().getId().equals(u1.getId())).findFirst().map(Inscripcion::getNombreEquipo).orElse(null);
        String equipo2 = inscripciones.stream().filter(i -> i.getUsuario().getId().equals(u2.getId())).findFirst().map(Inscripcion::getNombreEquipo).orElse(null);
        return equipo1 != null && equipo1.equals(equipo2);
    }
}
