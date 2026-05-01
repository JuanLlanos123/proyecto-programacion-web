-- 1. Gestión de Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(20) NOT NULL UNIQUE -- 'ADMIN', 'JUGADOR'
);

-- 2. Registro de Usuarios y Jugadores
-- Cubre: "Registro de jugadores participantes" (como usuarios del sistema)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol_id INT NOT NULL,
    elo_rating INT DEFAULT 1200, -- Para estadísticas de nivel
    biografia TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- 3. Gestión de Campeonatos
-- Cubre: "Registro y gestión de campeonatos" y "Gestión del estado del torneo"
CREATE TABLE torneos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP,
    -- Estados: 'RECLUTANDO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO'
    estado VARCHAR(20) DEFAULT 'RECLUTANDO', 
    sistema_juego VARCHAR(20) NOT NULL, -- 'SUIZO', 'ROUND_ROBIN'
    max_rondas INT, -- Para Sistema Suizo
    ubicacion VARCHAR(100), -- Puede ser 'Online' o un lugar físico
    organizador_id INT NOT NULL,
    CONSTRAINT fk_torneo_organizador FOREIGN KEY (organizador_id) REFERENCES usuarios(id)
);

-- 4. Inscripción y Puntajes
-- Cubre: "Registro de jugadores participantes" y "Cálculo de puntajes por jugador"
CREATE TABLE inscripciones (
    id SERIAL PRIMARY KEY,
    torneo_id INT NOT NULL,
    usuario_id INT NOT NULL,
    puntos_acumulados DECIMAL(4, 1) DEFAULT 0.0, -- Soporta 0.5 para tablas
    partidas_jugadas INT DEFAULT 0,
    posicion_actual INT, -- Para facilitar la "Visualización de tabla de posiciones"
    fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_insc_torneo FOREIGN KEY (torneo_id) REFERENCES torneos(id),
    CONSTRAINT fk_insc_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT uq_torneo_usuario UNIQUE (torneo_id, usuario_id)
);

-- 5. Programación de Rondas
-- Cubre: "Programación de rondas"
CREATE TABLE rondas (
    id SERIAL PRIMARY KEY,
    torneo_id INT NOT NULL,
    numero_ronda INT NOT NULL,
    fecha_planificada TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'ACTIVA', 'COMPLETA'
    CONSTRAINT fk_ronda_torneo FOREIGN KEY (torneo_id) REFERENCES torneos(id)
);

-- 6. Emparejamientos y Resultados
-- Cubre: "Generación de emparejamientos", "Registro de resultados" y "Consulta de historial"
CREATE TABLE partidas (
    id SERIAL PRIMARY KEY,
    ronda_id INT NOT NULL,
    jugador_blancas_id INT NOT NULL,
    jugador_negras_id INT NOT NULL,
    -- Resultados: '1-0' (Blanca gana), '0-1' (Negra gana), '0.5-0.5' (Tablas), 'P' (Pendiente)
    resultado VARCHAR(10) DEFAULT 'P',
    fecha_partida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    comentarios TEXT, -- Para el historial detallado
    CONSTRAINT fk_partida_ronda FOREIGN KEY (ronda_id) REFERENCES rondas(id),
    CONSTRAINT fk_blancas FOREIGN KEY (jugador_blancas_id) REFERENCES usuarios(id),
    CONSTRAINT fk_negras FOREIGN KEY (jugador_negras_id) REFERENCES usuarios(id),
    CONSTRAINT chk_no_mismo_jugador CHECK (jugador_blancas_id <> jugador_negras_id)
);
