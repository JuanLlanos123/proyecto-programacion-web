package com.ajedrez.controllers;

import com.ajedrez.models.Usuario;
import com.ajedrez.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = "*")
public class UsuarioController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private com.ajedrez.repositories.PartidaRepository partidaRepository;

    @Autowired
    private com.ajedrez.repositories.EloHistoryRepository eloHistoryRepository;

    @Autowired
    private com.ajedrez.repositories.InscripcionRepository inscripcionRepository;

    @GetMapping
    public List<Usuario> getAllUsuarios() {
        return usuarioRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Usuario> getUsuario(@PathVariable Long id) {
        return usuarioRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<?> getStats(@PathVariable Long id) {
        Usuario u = usuarioRepository.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();

        List<com.ajedrez.models.Partida> partidas = partidaRepository.findByUsuarioId(id);
        List<com.ajedrez.models.Partida> finalizadas = partidas.stream()
                .filter(p -> p.getResultado() != null && !p.getResultado().equals("P"))
                .collect(java.util.stream.Collectors.toList());

        // Calcular némesis
        java.util.Map<String, Integer> derrotasPorOponente = new java.util.HashMap<>();
        for (com.ajedrez.models.Partida p : finalizadas) {
            boolean isWhite = p.getBlancas() != null && p.getBlancas().getId().equals(id);
            if (isWhite && "0-1".equals(p.getResultado())) {
                String op = p.getNegras() != null ? p.getNegras().getUsername() : "Anónimo";
                derrotasPorOponente.put(op, derrotasPorOponente.getOrDefault(op, 0) + 1);
            } else if (!isWhite && "1-0".equals(p.getResultado())) {
                String op = p.getBlancas() != null ? p.getBlancas().getUsername() : "Anónimo";
                derrotasPorOponente.put(op, derrotasPorOponente.getOrDefault(op, 0) + 1);
            }
        }

        String nemesis = derrotasPorOponente.entrySet().stream()
                .max(java.util.Map.Entry.comparingByValue())
                .map(java.util.Map.Entry::getKey)
                .orElse("Ninguno");

        // Trofeos (Top 3 en torneos finalizados)
        List<com.ajedrez.models.Inscripcion> inscripciones = inscripcionRepository.findByUsuarioId(id);
        List<java.util.Map<String, String>> trophies = new java.util.ArrayList<>();
        for(com.ajedrez.models.Inscripcion ins : inscripciones) {
            if(ins.getTorneo() != null && "FINALIZADO".equals(ins.getTorneo().getEstado())) {
                List<com.ajedrez.models.Inscripcion> torneoIns = inscripcionRepository.findByTorneoId(ins.getTorneo().getId());
                torneoIns.sort((a,b) -> {
                    if(b.getPuntosAcumulados() != a.getPuntosAcumulados()) 
                        return Double.compare(b.getPuntosAcumulados(), a.getPuntosAcumulados());
                    if((b.getBuchholz() != null ? b.getBuchholz() : 0) != (a.getBuchholz() != null ? a.getBuchholz() : 0))
                        return Double.compare(b.getBuchholz() != null ? b.getBuchholz() : 0, a.getBuchholz() != null ? a.getBuchholz() : 0);
                    return Double.compare(b.getSonnebornBerger() != null ? b.getSonnebornBerger() : 0, a.getSonnebornBerger() != null ? a.getSonnebornBerger() : 0);
                });
                
                for(int i=0; i<Math.min(3, torneoIns.size()); i++) {
                    if(torneoIns.get(i).getId().equals(ins.getId())) {
                        java.util.Map<String, String> t = new java.util.HashMap<>();
                        t.put("torneo", ins.getTorneo().getNombre());
                        t.put("rank", String.valueOf(i + 1));
                        trophies.add(t);
                        break;
                    }
                }
            }
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("usuario", u);
        response.put("partidas", finalizadas);
        response.put("eloHistory", eloHistoryRepository.findByUsuarioIdOrderByFechaAsc(id));
        response.put("nemesis", nemesis);
        response.put("trofeos", trophies);

        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizarUsuario(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return usuarioRepository.findById(id).map(u -> {
            if(body.containsKey("email")) u.setEmail((String) body.get("email"));
            if(body.containsKey("biografia")) u.setBiografia((String) body.get("biografia"));
            if(body.containsKey("eloRating")) {
                int elo = Integer.parseInt(body.get("eloRating").toString());
                if(elo >= 0 && elo <= 4000) {
                    u.setEloRating(elo);
                } else {
                    throw new IllegalArgumentException("El ELO debe estar entre 0 y 4000");
                }
            }
            if(body.containsKey("role")) u.setRole((String) body.get("role"));
            
            return ResponseEntity.ok(usuarioRepository.save(u));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminarUsuario(@PathVariable Long id) {
        if (!usuarioRepository.existsById(id)) return ResponseEntity.notFound().build();
        usuarioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
