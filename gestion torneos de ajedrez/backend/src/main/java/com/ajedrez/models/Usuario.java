package com.ajedrez.models;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "elo_rating")
    private Integer eloRating = 1200;

    @Column(columnDefinition = "TEXT")
    private String biografia;

    @Column(name = "fecha_registro", updatable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date fechaRegistro = new Date();

    @Column(length = 20)
    private String role = "PLAYER"; // ADMIN o PLAYER

    // Constructor, Getters y Setters
    public Usuario() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Integer getEloRating() { return eloRating; }
    public void setEloRating(Integer eloRating) { this.eloRating = eloRating; }
    public String getBiografia() { return biografia; }
    public void setBiografia(String biografia) { this.biografia = biografia; }
    public Date getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(Date fechaRegistro) { this.fechaRegistro = fechaRegistro; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}
