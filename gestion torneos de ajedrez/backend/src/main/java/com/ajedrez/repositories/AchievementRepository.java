package com.ajedrez.repositories;

import com.ajedrez.models.Achievement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AchievementRepository extends JpaRepository<Achievement, Long> {
    List<Achievement> findByUserId(Long userId);
    boolean existsByUserIdAndName(Long userId, String name);
}
