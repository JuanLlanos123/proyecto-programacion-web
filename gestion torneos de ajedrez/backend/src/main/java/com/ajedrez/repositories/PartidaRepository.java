package com.ajedrez.repositories;

import com.ajedrez.models.Partida;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PartidaRepository extends JpaRepository<Partida, Long> {
    List<Partida> findByTorneoId(Long torneoId);
    long countByResultado(String resultado);

    @org.springframework.data.jpa.repository.Query("SELECT p FROM Partida p WHERE p.blancas.id = ?1 OR p.negras.id = ?1")
    List<Partida> findByUsuarioId(Long usuarioId);

    @org.springframework.data.jpa.repository.Query("SELECT MAX(p.rondaNumero) FROM Partida p WHERE p.torneo.id = ?1")
    Integer findMaxRondaByTorneoId(Long torneoId);
}
