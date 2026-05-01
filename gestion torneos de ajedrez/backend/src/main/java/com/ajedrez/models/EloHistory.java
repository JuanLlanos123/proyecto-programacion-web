package com.ajedrez.models;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "elo_history")
public class EloHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(nullable = false)
    private Integer elo;

    @Column(nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date fecha = new Date();

    @Column
    private String motivo;

    public EloHistory() {}

    public EloHistory(Usuario usuario, Integer elo, String motivo) {
        this.usuario = usuario;
        this.elo = elo;
        this.motivo = motivo;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public Integer getElo() { return elo; }
    public void setElo(Integer elo) { this.elo = elo; }
    public Date getFecha() { return fecha; }
    public void setFecha(Date fecha) { this.fecha = fecha; }
    public String getMotivo() { return motivo; }
    public void setMotivo(String motivo) { this.motivo = motivo; }
}
