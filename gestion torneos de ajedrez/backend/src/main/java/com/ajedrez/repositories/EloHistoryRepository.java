package com.ajedrez.repositories;

import com.ajedrez.models.EloHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EloHistoryRepository extends JpaRepository<EloHistory, Long> {
    List<EloHistory> findByUsuarioIdOrderByFechaAsc(Long usuarioId);
}
