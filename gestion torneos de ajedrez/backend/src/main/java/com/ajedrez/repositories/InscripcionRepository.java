package com.ajedrez.repositories;

import com.ajedrez.models.Inscripcion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InscripcionRepository extends JpaRepository<Inscripcion, Long> {
    List<Inscripcion> findByTorneoId(Long torneoId);
}
