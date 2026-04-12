package com.ajedrez.models;

import jakarta.persistence.*;

@Entity
@Table(name = "partidas")
public class Partida {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ronda_numero")
    private Integer rondaNumero;

    @ManyToOne
    @JoinColumn(name = "torneo_id", nullable = false)
    private Torneo torneo;

    @ManyToOne
    @JoinColumn(name = "blancas_id", nullable = true) // true if Bye
    private Usuario blancas;

    @ManyToOne
    @JoinColumn(name = "negras_id", nullable = true) // true if Bye
    private Usuario negras;

    // '1-0', '0-1', '0.5-0.5', 'P', 'BYE'
    @Column(length = 10)
    private String resultado = "P";

    public Partida() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getRondaNumero() { return rondaNumero; }
    public void setRondaNumero(Integer rondaNumero) { this.rondaNumero = rondaNumero; }
    public Torneo getTorneo() { return torneo; }
    public void setTorneo(Torneo torneo) { this.torneo = torneo; }
    public Usuario getBlancas() { return blancas; }
    public void setBlancas(Usuario blancas) { this.blancas = blancas; }
    public Usuario getNegras() { return negras; }
    public void setNegras(Usuario negras) { this.negras = negras; }
    public String getResultado() { return resultado; }
    public void setResultado(String resultado) { this.resultado = resultado; }
}
