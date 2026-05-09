package com.ajedrez.controllers;

import com.ajedrez.models.Equipo;
import com.ajedrez.models.Inscripcion;
import com.ajedrez.models.Usuario;
import com.ajedrez.repositories.EquipoRepository;
import com.ajedrez.repositories.InscripcionRepository;
import com.ajedrez.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/equipos")
@CrossOrigin(origins = "*")
public class EquipoController {

    @Autowired
    private EquipoRepository equipoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private InscripcionRepository inscripcionRepository;

    @GetMapping
    public List<Equipo> getEquipos() {
        List<Equipo> equipos = equipoRepository.findAll();
        for (Equipo eq : equipos) {
            double totalPts = 0;
            if (eq.getMiembros() != null) {
                for (Usuario u : eq.getMiembros()) {
                    List<Inscripcion> ins = inscripcionRepository.findByUsuarioId(u.getId());
                    for (Inscripcion i : ins) {
                        if (i.getPuntosAcumulados() != null) totalPts += i.getPuntosAcumulados();
                    }
                }
            }
            eq.setPuntosAcumulados(totalPts);
            equipoRepository.save(eq);
        }
        return equipos;
    }

    @PostMapping
    public ResponseEntity<?> crearEquipo(@RequestBody Map<String, Object> body) {
        String nombre = (String) body.get("nombre");
        if (nombre == null || nombre.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("El nombre del equipo es obligatorio");
        }

        Equipo equipo = equipoRepository.findByNombre(nombre).orElse(new Equipo(nombre));
        if (body.containsKey("descripcion")) equipo.setDescripcion((String) body.get("descripcion"));
        
        Equipo saved = equipoRepository.save(equipo);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/miembros")
    public ResponseEntity<?> añadirMiembro(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long usuarioId = body.get("usuarioId");
        return equipoRepository.findById(id).map(equipo -> {
            return usuarioRepository.findById(usuarioId).map(usuario -> {
                usuario.setEquipo(equipo);
                usuarioRepository.save(usuario);
                return ResponseEntity.ok(equipo);
            }).orElse(ResponseEntity.notFound().build());
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/miembros/{usuarioId}")
    public ResponseEntity<?> removerMiembro(@PathVariable Long id, @PathVariable Long usuarioId) {
        return equipoRepository.findById(id).map(equipo -> {
            return usuarioRepository.findById(usuarioId).map(usuario -> {
                if (usuario.getEquipo() != null && usuario.getEquipo().getId().equals(equipo.getId())) {
                    usuario.setEquipo(null);
                    usuarioRepository.save(usuario);
                    return ResponseEntity.ok(equipo);
                }
                return ResponseEntity.badRequest().body("El usuario no pertenece a este equipo");
            }).orElse(ResponseEntity.notFound().build());
        }).orElse(ResponseEntity.notFound().build());
    }
}
