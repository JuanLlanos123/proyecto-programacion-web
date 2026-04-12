package com.ajedrez.controllers;

import com.ajedrez.models.Usuario;
import com.ajedrez.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");
        
        // Basic implementation for university project (No hashing for simplicity here unless requested)
        Usuario u = usuarioRepository.findByUsername(username).orElse(null);
        if (u != null && u.getPasswordHash().equals(password)) {
            // Success
            return ResponseEntity.ok(u);
        }
        return ResponseEntity.status(401).body("Credenciales invalidas");
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Usuario usuario) {
        if(usuarioRepository.findByUsername(usuario.getUsername()).isPresent()){
            return ResponseEntity.badRequest().body("Usuario ya existe");
        }
        // Save raw password for basic logic
        usuario.setPasswordHash(usuario.getPasswordHash());
        return ResponseEntity.ok(usuarioRepository.save(usuario));
    }
}
