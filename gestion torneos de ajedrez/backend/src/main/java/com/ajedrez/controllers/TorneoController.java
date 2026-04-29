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
import java.util.List;
import java.util.Map;

/**
 * CONTROLADOR DE TORNEOS
 * Gestiona el ciclo de vida de los torneos: creación, inscripciones, emparejamientos y resultados.
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
    private com.ajedrez.services.RecaptchaService recaptchaService;

    @Autowired
    private com.ajedrez.services.EmailService emailService;

    // Template para enviar mensajes de WebSockets al frontend
    @Autowired
    private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    /** Obtiene todos los torneos registrados */
    @GetMapping
    public List<Torneo> getAllTorneos() {
        return torneoRepository.findAll();
    }

    /** Crea un nuevo torneo asignando al organizador logueado */
    @PostMapping
    public Torneo crearTorneo(@RequestBody Torneo torneo, org.springframework.security.core.Authentication authentication) {
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
     * Inicia el torneo generando las rondas iniciales mediante el servicio de emparejamiento.
     * Envía una notificación global vía WebSockets.
     */
    @PostMapping("/{id}/iniciar")
    public ResponseEntity<?> iniciarTorneo(@PathVariable Long id) {
        Torneo torneo = torneoRepository.findById(id).orElse(null);
        if(torneo == null) return ResponseEntity.notFound().build();
        
        List<Inscripcion> inscritos = inscripcionRepository.findByTorneoId(id);
        List<Partida> partidas = emparejamientoService.generarRondas(torneo, inscritos);
        
        // Notificar a todos los clientes conectados
        messagingTemplate.convertAndSend("/topic/notifications", "¡Se han generado nuevas rondas en el torneo: " + torneo.getNombre() + "!");
        
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
        if(torneo == null) return ResponseEntity.notFound().build();

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
            } catch(Exception e) {}
        }
        
        if(elo != null && (elo < 0 || elo > 4000)) {
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
            if (elo != null) u.setEloRating(elo);
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
        
        return ResponseEntity.ok(inscripcionRepository.save(inscripcion));
    }

    /** Elimina un torneo y todos sus datos relacionados (Partidas, Inscripciones) */
    @DeleteMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> eliminarTorneo(@PathVariable Long id) {
        if (!torneoRepository.existsById(id)) return ResponseEntity.notFound().build();
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

    /** Finaliza el torneo y marca la fecha de cierre */
    @PutMapping("/{id}/finalizar")
    public ResponseEntity<?> finalizarTorneo(@PathVariable Long id) {
        return torneoRepository.findById(id).map(torneo -> {
            torneo.setEstado("FINALIZADO");
            torneo.setFechaFin(new java.util.Date());
            return ResponseEntity.ok(torneoRepository.save(torneo));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Actualiza datos básicos del torneo (Nombre, Sistema de Juego, etc.) */
    @PutMapping("/{id}")
    public ResponseEntity<?> actualizarTorneo(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return torneoRepository.findById(id).map(torneo -> {
            if(body.containsKey("nombre")) torneo.setNombre((String) body.get("nombre"));
            if(body.containsKey("descripcion")) torneo.setDescripcion((String) body.get("descripcion"));
            if(body.containsKey("ubicacion")) torneo.setUbicacion((String) body.get("ubicacion"));
            if(body.containsKey("sistemaJuego")) torneo.setSistemaJuego((String) body.get("sistemaJuego"));
            
            return ResponseEntity.ok(torneoRepository.save(torneo));
        }).orElse(ResponseEntity.notFound().build());
    }
}
