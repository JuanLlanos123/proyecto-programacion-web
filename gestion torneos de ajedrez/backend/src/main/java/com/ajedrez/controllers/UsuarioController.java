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
