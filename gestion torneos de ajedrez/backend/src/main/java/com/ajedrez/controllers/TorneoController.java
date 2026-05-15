package com.ajedrez.controllers;

import com.ajedrez.models.Torneo;
import com.ajedrez.models.Inscripcion;
import com.ajedrez.models.Partida;
import com.ajedrez.repositories.TorneoRepository;
import com.ajedrez.repositories.InscripcionRepository;
import com.ajedrez.repositories.PartidaRepository;
import com.ajedrez.services.EmparejamientoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.ajedrez.models.Usuario;
import com.ajedrez.repositories.UsuarioRepository;
import com.ajedrez.repositories.EloHistoryRepository;
import com.ajedrez.services.RecaptchaService;
import com.ajedrez.services.EmailService;
import com.ajedrez.services.GamificationService;
import com.ajedrez.services.FideExportService;
import com.ajedrez.models.EloHistory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.util.List;
import java.util.Map;
import java.util.Date;

/**
 * CONTROLADOR DE TORNEOS
 * Gestiona el ciclo de vida de los torneos: creación, inscripciones,
 * emparejamientos y resultados.
 */
@RestController
@RequestMapping("/api/torneos")
@CrossOrigin(origins = "*")
public class TorneoController {

    @Autowired
    private TorneoRepository torneoRepository;

    @Autowired
    private InscripcionRepository inscripcionRepository;

    @Autowired
    private PartidaRepository partidaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private EmparejamientoService emparejamientoService;

    @Autowired
    private RecaptchaService recaptchaService;

    @Autowired
    private EmailService emailService;

    @Autowired
    private EloHistoryRepository eloHistoryRepository;

    @Autowired
    private GamificationService gamificationService;

    // Template para enviar mensajes de WebSockets al frontend
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private FideExportService fideExportService;

    /** Obtiene todos los torneos registrados */
    @GetMapping
    public List<Torneo> getAllTorneos() {
        return torneoRepository.findAll();
    }

    /** Crea un nuevo torneo asignando al organizador logueado */
    @PostMapping
    public Torneo crearTorneo(@RequestBody Torneo torneo,
            org.springframework.security.core.Authentication authentication) {
        if (authentication != null && authentication.getName() != null) {
            Usuario u = usuarioRepository.findByUsername(authentication.getName()).orElse(null);
            torneo.setOrganizador(u);
        }
        return torneoRepository.save(torneo);
    }

    /** Obtiene un torneo por su ID */
    @GetMapping("/{id}")
    public ResponseEntity<Torneo> getTorneo(@PathVariable Long id) {
        return torneoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Obtiene la lista de inscritos de un torneo específico */
    @GetMapping("/{id}/inscripciones")
    public List<Inscripcion> getInscripciones(@PathVariable Long id) {
        return inscripcionRepository.findByTorneoId(id);
    }

    /**
     * Inicia el torneo generando las rondas iniciales mediante el servicio de
     * emparejamiento.
     * Envía una notificación global vía WebSockets.
     */
    @PostMapping("/{id}/iniciar")
    public ResponseEntity<?> iniciarTorneo(@PathVariable Long id) {
        Torneo torneo = torneoRepository.findById(id).orElse(null);
        if (torneo == null)
            return ResponseEntity.notFound().build();

        List<Inscripcion> inscritos = inscripcionRepository.findByTorneoId(id);
        List<Partida> partidas = emparejamientoService.generarRondas(torneo, inscritos);

        // Notificar a todos los clientes conectados vía WebSockets
        messagingTemplate.convertAndSend("/topic/notifications",
                "¡Se han generado nuevas rondas en el torneo: " + torneo.getNombre() + "!");

        // Notificar a cada jugador por email de forma asíncrona para no bloquear la
        // respuesta
        new Thread(() -> {
            for (Partida p : partidas) {
                if (p.getBlancas() != null && p.getBlancas().getEmail() != null) {
                    String opp = (p.getNegras() != null) ? p.getNegras().getUsername() : "DESCANSA (BYE)";
                    emailService.sendRoundNotification(p.getBlancas().getEmail(), p.getBlancas().getUsername(),
                            torneo.getNombre(), p.getRondaNumero(), opp);
                }
                if (p.getNegras() != null && p.getNegras().getEmail() != null) {
                    String opp = (p.getBlancas() != null) ? p.getBlancas().getUsername() : "DESCANSA (BYE)";
                    emailService.sendRoundNotification(p.getNegras().getEmail(), p.getNegras().getUsername(),
                            torneo.getNombre(), p.getRondaNumero(), opp);
                }
            }
        }).start();

        return ResponseEntity.ok(partidas);
    }

    /** Obtiene todas las partidas jugadas o por jugar de un torneo */
    @GetMapping("/{id}/partidas")
    public List<Partida> getPartidas(@PathVariable Long id) {
        return partidaRepository.findByTorneoId(id);
    }

    /**
     * Inscribe a un jugador en un torneo.
     * Si el usuario no existe, lo crea automáticamente (Registro manual).
     * Incluye validación de reCAPTCHA y envío de correo de bienvenida.
     */
    @PostMapping("/{id}/inscripciones")
    public ResponseEntity<?> inscribirJugador(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Torneo torneo = torneoRepository.findById(id).orElse(null);
        if (torneo == null)
            return ResponseEntity.notFound().build();

        String nombre = body.get("nombre");
        String eloStr = String.valueOf(body.get("elo"));
        String recaptchaToken = body.get("recaptchaToken");

        // Verificación de seguridad de Google reCAPTCHA
        if (recaptchaToken != null && !recaptchaService.verify(recaptchaToken)) {
            return ResponseEntity.badRequest().body(Map.of("message", "reCAPTCHA inválido"));
        }

        Integer elo = null;
        if (body.containsKey("elo") && body.get("elo") != null) {
            try {
                elo = Integer.parseInt(String.valueOf(body.get("elo")));
            } catch (Exception e) {
            }
        }

        if (elo != null && (elo < 0 || elo > 4000)) {
            return ResponseEntity.badRequest().body("El ELO debe estar entre 0 y 4000");
        }

        String formattedUsername = nombre.trim();
        Usuario u = usuarioRepository.findByUsername(formattedUsername).orElse(null);

        if (u == null) {
            // Flujo de creación de nuevo usuario (Registro rápido desde torneo)
            u = new Usuario();
            u.setUsername(formattedUsername);
            String email = body.get("email");
            if (email == null || email.trim().isEmpty()) {
                email = formattedUsername.toLowerCase().replace(" ", "") + "@chess.com";
            }
            String pass = body.get("pass");
            if (pass == null || pass.trim().isEmpty()) {
                pass = "1234";
            }
            u.setEmail(email);
            u.setPasswordHash(pass);
            if (elo != null)
                u.setEloRating(elo);
            u.setRole("PLAYER");
            u = usuarioRepository.save(u);

            // Envío de credenciales por email al jugador
            if (body.containsKey("recaptchaToken")) {
                emailService.sendWelcomeEmail(u.getEmail(), u.getUsername(), pass);
            }
        } else {
            // Verificación de que no esté inscrito ya
            final Long userId = u.getId();
            boolean yaInscrito = inscripcionRepository.findByTorneoId(id).stream()
                    .anyMatch(ins -> ins.getUsuario().getId().equals(userId));

            if (yaInscrito) {
                return ResponseEntity.badRequest().body("El jugador ya está inscrito en este torneo.");
            }

            // Actualización de ELO si ha cambiado y se proporcionó uno nuevo
            if (elo != null && !u.getEloRating().equals(elo)) {
                u.setEloRating(elo);
                usuarioRepository.save(u);
            }
        }

        // Crear registro de inscripción
        Inscripcion inscripcion = new Inscripcion();
        inscripcion.setTorneo(torneo);
        inscripcion.setUsuario(u);
        
        // El equipo ahora solo se asigna si viene explícitamente (se prefiere gestión posterior)
        if (body.containsKey("nombreEquipo") && body.get("nombreEquipo") != null && !body.get("nombreEquipo").isEmpty()) {
            inscripcion.setNombreEquipo(body.get("nombreEquipo"));
        }

        return ResponseEntity.ok(inscripcionRepository.save(inscripcion));
    }

    /**
     * Elimina un torneo y todos sus datos relacionados (Partidas, Inscripciones)
     */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> eliminarTorneo(@PathVariable Long id) {
        if (!torneoRepository.existsById(id))
            return ResponseEntity.notFound().build();
        List<Partida> partidas = partidaRepository.findByTorneoId(id);
        partidaRepository.deleteAll(partidas);
        List<Inscripcion> inscripciones = inscripcionRepository.findByTorneoId(id);
        inscripcionRepository.deleteAll(inscripciones);
        torneoRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** Elimina a un jugador específico de un torneo */
    @DeleteMapping("/{id}/inscripciones/{insId}")
    public ResponseEntity<?> eliminarInscripcion(@PathVariable Long id, @PathVariable Long insId) {
        return inscripcionRepository.findById(insId).map(ins -> {
            inscripcionRepository.delete(ins);
            return ResponseEntity.noContent().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Marca a un jugador como 'presente' (Check-in) para el torneo */
    @PostMapping("/{id}/inscripciones/{insId}/checkin")
    public ResponseEntity<?> marcarPresente(@PathVariable Long id, @PathVariable Long insId) {
        return inscripcionRepository.findById(insId).map(ins -> {
            ins.setPresente(true);
            return ResponseEntity.ok(inscripcionRepository.save(ins));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Finaliza el torneo y marca la fecha de cierre */
    @PutMapping("/{id}/finalizar")
    public ResponseEntity<?> finalizarTorneo(@PathVariable Long id) {
        return torneoRepository.findById(id).map(torneo -> {
            torneo.setEstado("FINALIZADO");
            torneo.setFechaFin(new Date());
            Torneo saved = torneoRepository.save(torneo);

            // Actualizar ELO de participantes usando la fórmula de Arpad Elo
            List<Inscripcion> inscripciones = inscripcionRepository.findByTorneoId(id);
            List<Partida> partidas = partidaRepository.findByTorneoId(id);
            
            // 1. Guardar ratings iniciales para que el cálculo no se vea afectado por actualizaciones parciales
            java.util.Map<Long, Integer> initialRatings = new java.util.HashMap<>();
            for (Inscripcion ins : inscripciones) {
                initialRatings.put(ins.getUsuario().getId(), ins.getUsuario().getEloRating());
            }

            // 2. Calcular el cambio de ELO (Delta) para cada jugador
            for (Inscripcion ins : inscripciones) {
                Usuario u = ins.getUsuario();
                int currentR = initialRatings.get(u.getId());
                double totalActualScore = 0;
                double totalExpectedScore = 0;
                int matchesCount = 0;

                for (Partida p : partidas) {
                    if ("P".equals(p.getResultado()) || "BYE".equals(p.getResultado())) continue;

                    boolean isWhite = p.getBlancas() != null && p.getBlancas().getId().equals(u.getId());
                    boolean isBlack = p.getNegras() != null && p.getNegras().getId().equals(u.getId());

                    if (isWhite || isBlack) {
                        matchesCount++;
                        Usuario opponent = isWhite ? p.getNegras() : p.getBlancas();
                        
                        // Score actual
                        double s = 0;
                        if ("1-0".equals(p.getResultado())) s = isWhite ? 1.0 : 0.0;
                        else if ("0-1".equals(p.getResultado())) s = isWhite ? 0.0 : 1.0;
                        else if ("0.5-0.5".equals(p.getResultado())) s = 0.5;

                        totalActualScore += s;

                        // Score esperado: E = 1 / (1 + 10^((Rb - Ra)/400))
                        if (opponent != null) {
                            int opponentR = initialRatings.getOrDefault(opponent.getId(), opponent.getEloRating());
                            double expected = 1.0 / (1.0 + Math.pow(10, (double)(opponentR - currentR) / 400.0));
                            totalExpectedScore += expected;
                        } else {
                            // Si por algún motivo no hay oponente (no debería pasar si no es BYE)
                            totalExpectedScore += 0.5;
                        }
                    }
                }

                if (matchesCount > 0) {
                    // K-Factor = 20
                    int delta = (int) Math.round(20.0 * (totalActualScore - totalExpectedScore));
                    int newElo = currentR + delta;
                    if (newElo < 100) newElo = 100;

                    u.setEloRating(newElo);
                    usuarioRepository.save(u);

                    // Guardar en historial
                    eloHistoryRepository.save(new EloHistory(u, newElo, "Torneo Finalizado: " + torneo.getNombre() + " (Δ: " + (delta >= 0 ? "+" : "") + delta + ")"));
                }
            }

            // Notificar vía WebSockets que el torneo terminó
            messagingTemplate.convertAndSend("/topic/notifications", "Torneo Finalizado: " + torneo.getNombre());

            // Lógica de Logros (Achievements)
            if (!inscripciones.isEmpty()) {
                // Encontrar al ganador real usando desempates
                Inscripcion winnerIns = inscripciones.stream().sorted((a, b) -> {
                    if (b.getPuntosAcumulados() != a.getPuntosAcumulados())
                        return Double.compare(b.getPuntosAcumulados(), a.getPuntosAcumulados());
                    if (b.getBuchholz() != a.getBuchholz())
                        return Double.compare(b.getBuchholz(), a.getBuchholz());
                    return Double.compare(b.getSonnebornBerger(), a.getSonnebornBerger());
                }).findFirst().orElse(null);

                if (winnerIns != null) {
                    gamificationService.checkTournamentAchievements(torneo, winnerIns.getUsuario());
                }
            }

            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Actualiza datos básicos del torneo (Nombre, Sistema de Juego, etc.) */
    @PutMapping("/{id}")
    public ResponseEntity<?> actualizarTorneo(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return torneoRepository.findById(id).map(torneo -> {
            if (body.containsKey("nombre"))
                torneo.setNombre((String) body.get("nombre"));
            if (body.containsKey("descripcion"))
                torneo.setDescripcion((String) body.get("descripcion"));
            if (body.containsKey("ubicacion"))
                torneo.setUbicacion((String) body.get("ubicacion"));
            if (body.containsKey("sistemaJuego"))
                torneo.setSistemaJuego((String) body.get("sistemaJuego"));
            if (body.containsKey("maxRondas")) {
                Object mr = body.get("maxRondas");
                if (mr != null)
                    torneo.setMaxRondas(Integer.parseInt(mr.toString()));
                else
                    torneo.setMaxRondas(null);
            }

            return ResponseEntity.ok(torneoRepository.save(torneo));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Exporta el torneo en formato TRF de la FIDE */
    @GetMapping("/{id}/export/fide")
    public ResponseEntity<String> exportarFide(@PathVariable Long id) {
        if (id == null)
            return ResponseEntity.badRequest().<String>build();
        return torneoRepository.findById(id).map(torneo -> {
            String trfData = fideExportService.generateTrf(torneo);
            HttpHeaders headers = new HttpHeaders();
            headers.add("Content-Disposition", "attachment; filename=" + torneo.getNombre().replace(" ", "_") + ".trf");
            return new ResponseEntity<>(trfData, headers, HttpStatus.OK);
        }).orElse(ResponseEntity.notFound().<String>build());
    }

    /** Recalcula manualmente los puntos y desempates de un torneo */
    @PostMapping("/{id}/recalculate")
    public ResponseEntity<?> recalculatePoints(@PathVariable Long id) {
        return torneoRepository.findById(id).map(torneo -> {
            emparejamientoService.actualizarPuntos(id);
            return ResponseEntity.ok("Puntos recalculados");
        }).orElse(ResponseEntity.notFound().build());
    }
}
