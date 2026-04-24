package com.ajedrez.controllers;

import com.ajedrez.models.Usuario;
import com.ajedrez.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.ajedrez.security.JwtUtil;
import com.ajedrez.services.RecaptchaService;
import java.util.HashMap;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RecaptchaService recaptchaService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");
        String recaptchaToken = credentials.get("recaptchaToken");

        if (!recaptchaService.verify(recaptchaToken)) {
            return ResponseEntity.badRequest().body("{\"error\": \"reCAPTCHA inválido\"}");
        }
        
        // Basic implementation for university project (No hashing for simplicity here unless requested)
        Usuario u = usuarioRepository.findByUsername(username).orElse(null);
        if (u != null && u.getPasswordHash().equals(password)) {
            // Success: generate token
            String token = jwtUtil.generateToken(u.getUsername(), u.getRole() != null ? u.getRole() : "PLAYER");
            
            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("usuario", u);
            
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.status(401).body("Credenciales invalidas");
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> body) {
        String recaptchaToken = (String) body.get("recaptchaToken");
        if (!recaptchaService.verify(recaptchaToken)) {
            return ResponseEntity.badRequest().body("{\"error\": \"reCAPTCHA inválido\"}");
        }

        Usuario usuario = new Usuario();
        usuario.setUsername((String) body.get("username"));
        usuario.setEmail((String) body.get("email"));
        usuario.setPasswordHash((String) body.get("passwordHash"));
        usuario.setRole((String) body.get("role"));
        if (body.containsKey("eloRating")) {
            usuario.setEloRating(Integer.parseInt(body.get("eloRating").toString()));
        }

        if(usuarioRepository.findByUsername(usuario.getUsername()).isPresent()){
            return ResponseEntity.badRequest().body("Usuario ya existe");
        }
        // Save raw password for basic logic
        usuario.setPasswordHash(usuario.getPasswordHash());
        Usuario savedUser = usuarioRepository.save(usuario);
        
        String token = jwtUtil.generateToken(savedUser.getUsername(), savedUser.getRole() != null ? savedUser.getRole() : "PLAYER");
        
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("usuario", savedUser);
        
        return ResponseEntity.ok(response);
    }
}
