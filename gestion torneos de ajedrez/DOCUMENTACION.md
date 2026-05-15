# 📚 Documentación Técnica — Grandmaster Heritage
### Sistema de Gestión de Torneos de Ajedrez

---

## 1. Descripción General

**Grandmaster Heritage** es una aplicación web fullstack para la administración de torneos de ajedrez. Permite gestionar jugadores, equipos, partidas, rondas, clasificaciones y análisis, con soporte para múltiples sistemas de juego.

---

## 2. Arquitectura del Proyecto

```
gestion torneos de ajedrez/
├── backend/                        # Aplicación Spring Boot (Java)
│   └── src/main/
│       ├── java/com/ajedrez/
│       │   ├── controllers/        # Controladores REST (endpoints de la API)
│       │   ├── models/             # Entidades JPA (Usuario, Torneo, Inscripcion, Partida...)
│       │   ├── repositories/       # Interfaces Spring Data JPA
│       │   ├── services/           # Lógica de negocio
│       │   └── security/           # JWT, filtros, configuración de seguridad
│       └── resources/
│           ├── static/             # Frontend servido por Spring Boot
│           │   ├── index.html      # Página única (SPA)
│           │   ├── css/styles.css  # Estilos globales
│           │   └── js/
│           │       ├── api.js      # Capa de comunicación con la API REST
│           │       └── app_v2.js   # Lógica principal del frontend
│           └── application.properties
├── frontend/                       # Copia de desarrollo del frontend
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── api.js
│       └── app_v2.js
└── database/                       # Scripts SQL iniciales
```

> **Importante:** El frontend en `backend/src/main/resources/static/` es el que sirve el servidor Spring Boot. La carpeta `frontend/` es una copia para desarrollo independiente. Siempre sincronizar ambas.

---

## 3. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Java 17, Spring Boot 3, Spring Security, JPA/Hibernate |
| Base de Datos | MySQL / H2 (desarrollo) |
| Autenticación | JWT (JSON Web Tokens) + reCAPTCHA v2 |
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript (ES6+) |
| Librerías UI | FontAwesome 6, Google Fonts (Inter, Playfair Display) |
| Análisis | Stockfish WASM, chess.js, chessboard.js |
| Gráficos | Chart.js |
| PDF | jsPDF + jspdf-autotable |
| QR | html5-qrcode, QRCode.js |
| WebSockets | SockJS + STOMP (notificaciones en tiempo real) |

---

## 4. Modelos de Datos Principales

### `Usuario`
```java
Long id
String username       // Nombre único de usuario
String email
String password       // Hashed con BCrypt
String role           // "ADMIN" | "PLAYER"
Integer eloRating     // Rating ELO FIDE (1200 por defecto)
String nombreEquipo   // Nombre del equipo/club al que pertenece
```

### `Torneo`
```java
Long id
String nombre
String descripcion
String sistemaJuego   // "ROUND_ROBIN" | "SUIZO" | "ELIMINATORIA" | "DOBLE_ELIMINATORIA" | "GRUPOS" | "EQUIPOS"
String estado         // "PENDIENTE" | "EN_CURSO" | "FINALIZADO"
Integer maxRondas     // Solo para SUIZO y EQUIPOS
Integer numTableros   // Solo para EQUIPOS (jugadores por equipo)
LocalDateTime fechaCreacion
```

### `Inscripcion`
```java
Long id
Usuario usuario
Torneo torneo
Double puntosAcumulados
Double buchholz           // Desempate Buchholz
Double sonnebornBerger    // Desempate Sonneborn-Berger
Integer partidasJugadas
Integer victorias
Integer empates
Integer derrotas
String nombreEquipo       // Equipo para torneos tipo EQUIPOS
Integer numeroGrupo       // Grupo asignado (modo GRUPOS)
Boolean presente          // Check-in por QR
```

### `Partida`
```java
Long id
Torneo torneo
Usuario blancas
Usuario negras
String resultado          // "P" (pendiente) | "1-0" | "0-1" | "0.5-0.5" | "BYE"
Integer rondaNumero
LocalDateTime fecha
```

---

## 5. API REST — Endpoints Principales

> Base URL: `http://localhost:8080/api`  
> Autenticación: `Authorization: Bearer <JWT_TOKEN>`

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/login` | Login → devuelve token JWT + datos de usuario |
| POST | `/auth/register` | Registro de nueva cuenta |

### Torneos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/torneos` | Listar todos los torneos |
| POST | `/torneos` | Crear nuevo torneo |
| GET | `/torneos/{id}` | Obtener detalle de un torneo |
| DELETE | `/torneos/{id}` | Eliminar torneo |
| POST | `/torneos/{id}/iniciar` | Generar primera ronda / siguiente ronda |
| POST | `/torneos/{id}/finalizar` | Finalizar torneo y actualizar ELOs |
| POST | `/torneos/{id}/recalculate` | Recalcular puntos y desempates |
| GET | `/torneos/{id}/export/fide` | Exportar archivo TRF (FIDE) |

### Inscripciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/torneos/{id}/inscripciones` | Listar inscritos en un torneo |
| POST | `/torneos/{id}/inscripciones` | Inscribir jugador (manual o existente) |
| DELETE | `/torneos/{id}/inscripciones/{insId}` | Eliminar inscripción |
| POST | `/torneos/{id}/inscripciones/{insId}/checkin` | Registrar asistencia QR |

### Partidas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/torneos/{id}/partidas` | Obtener partidas de un torneo |
| PUT | `/partidas/{id}/resultado` | Actualizar resultado de una partida |

### Usuarios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/usuarios` | Listar todos los usuarios |
| PUT | `/usuarios/{id}` | Actualizar datos de usuario (elo, equipo...) |
| DELETE | `/usuarios/{id}` | Eliminar usuario |
| GET | `/usuarios/{id}/stats` | Estadísticas completas del jugador |
| GET | `/usuarios/compare?u1={id}&u2={id}` | Comparación H2H entre dos jugadores |

---

## 6. Frontend — Estructura de `app_v2.js`

El archivo está organizado en secciones funcionales:

### Inicialización
```javascript
DOMContentLoaded → checkAuthStatus() → initNavigation() → initModals()
                → initForms() → initSearchFilters() → initTheme() → initFAB()
```

### Funciones Principales

| Función | Descripción |
|---------|-------------|
| `showView(viewId)` | Navega entre vistas (SPA routing) |
| `openModal(modalId)` / `closeModal(modalId)` | Gestión de modales |
| `renderDashboard()` | Carga estadísticas y lista de torneos en el panel |
| `renderTournamentList()` | Lista todos los torneos con filtros |
| `renderTournamentDetail(id)` | Carga vista completa de un torneo |
| `renderPlayers(inscripciones)` | Tabla de participantes del torneo |
| `renderRounds(partidas)` | Renderiza rondas y emparejamientos |
| `renderStandings(inscripciones)` | Tabla de posiciones con desempates |
| `renderBrackets(partidas)` | Cuadro visual de eliminatorias |
| `openAddPlayerModal(mode)` | Abre modal de inscripción (`'existente'`, `'nuevo'`, `'equipos'`) |
| `setResult(partidaId, resultado)` | Guarda resultado de una partida vía API |
| `startTournament(id)` | Inicia torneo o genera siguiente ronda |
| `completeTournament(id)` | Finaliza torneo |
| `showPlayerStats(userId)` | Abre ficha completa de un jugador |
| `renderGlobalRanking()` | Ranking mundial por ELO |
| `showNotification(msg, type)` | Toast de notificación (success/error/warning) |
| `renderAchievements()` | Muro de logros/insignias |
| `initAnalysisBoard()` | Inicializa el tablero de análisis con Stockfish |

---

## 7. Sistemas de Juego Soportados

| Sistema | Lógica de Emparejamiento |
|---------|--------------------------|
| **ROUND_ROBIN** | Todos vs Todos. El torneo termina cuando todas las partidas están completas |
| **SUIZO** | Emparejamiento por puntos. Rondas configurables. Desempate: Buchholz y SB |
| **ELIMINATORIA** | Knockout directo. Un perdedor = eliminado |
| **DOBLE_ELIMINATORIA** | Cuadro de ganadores + cuadro de perdedores (Blue Lock Style) |
| **GRUPOS** | Fase de grupos (Round Robin parcial) + fase eliminatoria |
| **EQUIPOS** | Equipos enfrentados con múltiples tableros simultáneos |

---

## 8. Autenticación y Seguridad

- Login genera un **JWT** almacenado en `localStorage` (`jwt_token`)
- Todas las peticiones incluyen el header `Authorization: Bearer <token>`
- Los endpoints protegidos requieren rol `ADMIN` o `PLAYER`
- El frontend usa `fetchWithAuth()` que inyecta automáticamente el token
- Registro y login protegidos con **Google reCAPTCHA v2**

---

## 9. Bugs Corregidos (Historial)

| Fecha | Bug | Solución |
|-------|-----|----------|
| 2026-05-15 | "Registro Manual" de inscripción no funcionaba | Faltaban los campos HTML (`form-p-name`, `form-p-email`, `form-p-elo`, `form-p-team`) y el botón `tab-btn-nuevo` en el modal |
| 2026-05-15 | Contenido descentrado / con padding excesivo lateral | `.view` tenía `padding: 1.5rem` propio además del `padding: 2rem 3rem` de `.main-content`. Se eliminó el padding del `.view` |
| 2026-05-15 | `openAddPlayerModal('nuevo')` ocultaba el tab nuevo | La función re-ocultaba `tab-btn-nuevo` al entrar en rama `else`. Corregido para mostrar siempre los tabs existente y nuevo |

---

## 10. Guía de Desarrollo Local

### Requisitos
- Java 17+
- Maven 3.8+
- MySQL 8.0 (o H2 para pruebas)
- Node.js (opcional, para servir el frontend independiente)

### Arrancar el Backend
```bash
cd "gestion torneos de ajedrez/backend"
mvn spring-boot:run
# Acceder en: http://localhost:8080
```

### Variables de Entorno / `application.properties`
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/ajedrez_db
spring.datasource.username=root
spring.datasource.password=tu_password
jwt.secret=tu_secreto_jwt
```

### Sincronizar Frontend
Los cambios en `frontend/` deben copiarse manualmente a `backend/src/main/resources/static/`:
- `frontend/index.html` → `static/index.html`
- `frontend/css/styles.css` → `static/css/styles.css`
- `frontend/js/app_v2.js` → `static/js/app_v2.js`

---

## 11. Estructura de Vistas (SPA)

| `id` de la vista | Descripción |
|------------------|-------------|
| `dashboard-view` | Panel principal con estadísticas |
| `tournaments-view` | Lista de todos los torneos |
| `tournament-detail-view` | Detalle de un torneo con tabs |
| `players-view` | Gestión de jugadores |
| `users-view` | Gestión de administradores |
| `ranking-view` | Ranking global por ELO |
| `compare-view` | Comparador Head-to-Head |
| `analysis-view` | Análisis de partidas con Stockfish |
| `achievements-view` | Muro de logros e insignias |
| `teams-management-view` | Gestión global de equipos |

---

*Documentación generada el 15/05/2026 · Sistema Grandmaster Heritage v2.3*
