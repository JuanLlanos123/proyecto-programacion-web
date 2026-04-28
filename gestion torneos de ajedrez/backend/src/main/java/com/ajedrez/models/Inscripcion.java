package com.ajedrez.models;

import jakarta.persistence.*;

@Entity
@Table(name = "inscripciones", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"torneo_id", "usuario_id"})
})
public class Inscripcion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "torneo_id", nullable = false)
    private Torneo torneo;

    @ManyToOne
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "puntos_acumulados")
    private Double puntosAcumulados = 0.0;

    @Column(name = "partidas_jugadas")
    private Integer partidasJugadas = 0;

    @Column(name = "victorias", nullable = false)
    private Integer victorias = 0;

    @Column(name = "empates", nullable = false)
    private Integer empates = 0;

    @Column(name = "derrotas", nullable = false)
    private Integer derrotas = 0;

    // Getters / Setters
    public Inscripcion() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Torneo getTorneo() { return torneo; }
    public void setTorneo(Torneo torneo) { this.torneo = torneo; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public Double getPuntosAcumulados() { return puntosAcumulados; }
    public void setPuntosAcumulados(Double puntosAcumulados) { this.puntosAcumulados = puntosAcumulados; }
    public Integer getPartidasJugadas() { return partidasJugadas; }
    public void setPartidasJugadas(Integer partidasJugadas) { this.partidasJugadas = partidasJugadas; }
    public Integer getVictorias() { return victorias; }
    public void setVictorias(Integer victorias) { this.victorias = victorias; }
    public Integer getEmpates() { return empates; }
    public void setEmpates(Integer empates) { this.empates = empates; }
    public Integer getDerrotas() { return derrotas; }
    public void setDerrotas(Integer derrotas) { this.derrotas = derrotas; }

    @Column(name = "buchholz")
    private Double buchholz = 0.0;

    @Column(name = "sonneborn_berger")
    private Double sonnebornBerger = 0.0;

    public Double getBuchholz() { return buchholz; }
    public void setBuchholz(Double buchholz) { this.buchholz = buchholz; }

    public Double getSonnebornBerger() { return sonnebornBerger; }
    public void setSonnebornBerger(Double sonnebornBerger) { this.sonnebornBerger = sonnebornBerger; }
}
