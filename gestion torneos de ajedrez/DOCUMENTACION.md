# 🏆 Documentación Técnica: Sistema de Gestión de Torneos de Ajedrez

Este documento detalla la arquitectura, los módulos y los algoritmos implementados en el proyecto para la gestión profesional de torneos universitarios.

---

## 📂 1. Estructura del Proyecto

El proyecto está dividido en dos partes principales siguiendo el patrón de arquitectura desacoplada:

- **/backend**: Construido con **Spring Boot 3**. Gestiona la persistencia de datos, seguridad JWT y algoritmos complejos de emparejamiento.
- **/frontend (Raíz)**: Interfaz construida con **HTML5, CSS3 y Vanilla JavaScript**. Utiliza WebSockets para actualizaciones en tiempo real.

---

## ⚙️ 2. Módulos del Backend

### 🛡️ Seguridad (JWT)
Ubicación: `com.ajedrez.security`
- **JwtUtil**: Genera y valida tokens JSON Web Token para sesiones seguras sin estado.
- **SecurityConfig**: Define las rutas públicas (lectura de torneos) y protegidas (creación, edición, borrado).

### 🧠 Motor de Emparejamiento
Ubicación: `com.ajedrez.services.EmparejamientoService`
Implementa 4 sistemas de juego profesionales:
1. **Round Robin**: Todos contra todos. Gestiona automáticamente los descansos (BYE) si el número de jugadores es impar.
2. **Sistema Suizo**: Utiliza el ELO y los puntos acumulados para emparejar jugadores de nivel similar sin repetir enfrentamientos.
3. **Eliminatoria Simple**: Formato de llaves (brackets) donde el perdedor es eliminado.
4. **Doble Eliminatoria**: Incluye un "Winner Bracket" y un "Loser Bracket", permitiendo una derrota antes de la eliminación final.

### 📧 Servicios Adicionales
- **EmailService**: Envío automático de credenciales al inscribir nuevos jugadores.
- **RecaptchaService**: Validación de seguridad mediante Google reCAPTCHA v2 en formularios de login y registro.

---

## 🌐 3. Lógica del Frontend

### 📡 Comunicación API (`api.js`)
Centraliza todas las peticiones al backend. Incluye un interceptor `fetchWithAuth` que añade automáticamente el token JWT en las cabeceras de autorización.

### 💾 Almacenamiento Local (`store.js`)
Permite que la aplicación mantenga ciertos estados de forma local (LocalStorage) para una navegación más fluida y soporte parcial offline.

### 🤝 Emparejamiento Local (`pairing.js`)
Implementa la lógica de rotación de mesas necesaria para el sistema Round Robin directamente en el navegador.

---

## 📊 4. Modelo de Datos
- **Usuario**: Jugadores y Administradores (Username, Email, PasswordHash, ELO).
- **Torneo**: Entidad principal que define el sistema de juego y estado (Pendiente, En Curso, Finalizado).
- **Inscripción**: Cruce entre Usuario y Torneo que almacena estadísticas: Buchholz, Sonneborn-Berger, Puntos, Wins, Draws, Losses.
- **Partida**: Registro del enfrentamiento entre dos usuarios con su resultado (1-0, 0-1, 0.5-0.5, BYE).
