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

@RestController
@RequestMapping("/api/torneos")
@CrossOrigin(origins = "*") // Simplificado para desarrollo local
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

    @GetMapping
    public List<Torneo> getAllTorneos() {
        return torneoRepository.findAll();
    }

    @PostMapping
    public Torneo crearTorneo(@RequestBody Torneo torneo) {
        return torneoRepository.save(torneo);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Torneo> getTorneo(@PathVariable Long id) {
        return torneoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/{id}/inscripciones")
    public List<Inscripcion> getInscripciones(@PathVariable Long id) {
        return inscripcionRepository.findByTorneoId(id);
    }

    @PostMapping("/{id}/iniciar")
    public ResponseEntity<?> iniciarTorneo(@PathVariable Long id) {
        Torneo torneo = torneoRepository.findById(id).orElse(null);
        if(torneo == null) return ResponseEntity.notFound().build();
        
        List<Inscripcion> inscritos = inscripcionRepository.findByTorneoId(id);
        List<Partida> partidas = emparejamientoService.generarRondas(torneo, inscritos);
        
        return ResponseEntity.ok(partidas);
    }

    @GetMapping("/{id}/partidas")
    public List<Partida> getPartidas(@PathVariable Long id) {
        return partidaRepository.findByTorneoId(id);
    }

    @PostMapping("/{id}/inscripciones")
    public ResponseEntity<?> inscribirJugador(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Torneo torneo = torneoRepository.findById(id).orElse(null);
        if(torneo == null) return ResponseEntity.notFound().build();

        String nombre = body.get("nombre");
        String eloStr = String.valueOf(body.get("elo"));
        Integer elo = 1200;
        try { elo = Integer.parseInt(eloStr); } catch(Exception e) {}

        // Create or find user
        Usuario u = new Usuario();
        u.setUsername(nombre.toLowerCase().replace(" ", ".") + "." + System.currentTimeMillis());
        u.setEmail(u.getUsername() + "@chess.com");
        u.setPasswordHash("1234");
        u.setEloRating(elo);
        u = usuarioRepository.save(u);

        Inscripcion inscripcion = new Inscripcion();
        inscripcion.setTorneo(torneo);
        inscripcion.setUsuario(u);
        
        return ResponseEntity.ok(inscripcionRepository.save(inscripcion));
    }

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

    @DeleteMapping("/{id}/inscripciones/{insId}")
    public ResponseEntity<?> eliminarInscripcion(@PathVariable Long id, @PathVariable Long insId) {
        return inscripcionRepository.findById(insId).map(ins -> {
            inscripcionRepository.delete(ins);
            return ResponseEntity.noContent().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/finalizar")
    public ResponseEntity<?> finalizarTorneo(@PathVariable Long id) {
        return torneoRepository.findById(id).map(torneo -> {
            torneo.setEstado("FINALIZADO");
            torneo.setFechaFin(new java.util.Date());
            return ResponseEntity.ok(torneoRepository.save(torneo));
        }).orElse(ResponseEntity.notFound().build());
    }

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
