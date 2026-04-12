package com.ajedrez.repositories;

import com.ajedrez.models.Partida;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PartidaRepository extends JpaRepository<Partida, Long> {
    List<Partida> findByTorneoId(Long torneoId);
}
