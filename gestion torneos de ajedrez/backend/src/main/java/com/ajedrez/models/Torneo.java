package com.ajedrez.models;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "torneos")
public class Torneo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nombre;

    @Column(columnDefinition = "TEXT")
    private String descripcion;

    @Column(name = "fecha_inicio", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date fechaInicio = new Date();

    @Column(name = "fecha_fin")
    @Temporal(TemporalType.TIMESTAMP)
    private Date fechaFin;

    @Column(length = 20)
    private String estado = "PENDIENTE";

    @Column(name = "sistema_juego", length = 20, nullable = false)
    private String sistemaJuego = "ROUND_ROBIN";

    @Column(length = 100)
    private String ubicacion = "Online";

    // Representa el organizador_id
    @ManyToOne
    @JoinColumn(name = "organizador_id", nullable = true) // nullable para simplificar la creacion
    private Usuario organizador;

    @Column(name = "max_rondas")
    private Integer maxRondas;

    public Torneo() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public Date getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(Date fechaInicio) { this.fechaInicio = fechaInicio; }
    public Date getFechaFin() { return fechaFin; }
    public void setFechaFin(Date fechaFin) { this.fechaFin = fechaFin; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public String getSistemaJuego() { return sistemaJuego; }
    public void setSistemaJuego(String sistemaJuego) { this.sistemaJuego = sistemaJuego; }
    public String getUbicacion() { return ubicacion; }
    public void setUbicacion(String ubicacion) { this.ubicacion = ubicacion; }
    public Usuario getOrganizador() { return organizador; }
    public void setOrganizador(Usuario organizador) { this.organizador = organizador; }
    public Integer getMaxRondas() { return maxRondas; }
    public void setMaxRondas(Integer maxRondas) { this.maxRondas = maxRondas; }
}
