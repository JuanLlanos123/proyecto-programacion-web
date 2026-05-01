package com.ajedrez.controllers;

import com.ajedrez.models.Partida;
import com.ajedrez.repositories.PartidaRepository;
import com.ajedrez.services.EmparejamientoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/partidas")
@CrossOrigin(origins = "*")
public class PartidaController {

    @Autowired
    private PartidaRepository partidaRepository;

    @Autowired
    private EmparejamientoService emparejamientoService;
    
    @GetMapping("/activas/count")
    public ResponseEntity<Long> countActiveMatches() {
        return ResponseEntity.ok(partidaRepository.countByResultado("P"));
    }

    @PutMapping("/{id}/resultado")
    public ResponseEntity<?> actualizarResultado(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Partida partida = partidaRepository.findById(id).orElse(null);
        if(partida == null) return ResponseEntity.notFound().build();

        String resultado = body.get("resultado");
        
        // Bloquear si el torneo ya terminó
        if ("FINALIZADO".equals(partida.getTorneo().getEstado())) {
            return ResponseEntity.badRequest().body("No se pueden modificar resultados de un torneo finalizado.");
        }

        partida.setResultado(resultado);
        partidaRepository.save(partida);

        // Recalcular puntos del torneo
        emparejamientoService.actualizarPuntos(partida.getTorneo().getId());
        
        return ResponseEntity.ok(partida);
    }
}
