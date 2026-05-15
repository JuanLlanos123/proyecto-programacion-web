package com.ajedrez.services;

import com.ajedrez.repositories.PartidaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * EloService — Servicio de cálculo de rating FIDE (Arpad Elo).
 *
 * Centraliza toda la lógica del sistema ELO para que pueda ser
 * reutilizada tanto en la finalización de torneos como en el
 * registro individual de resultados de partidas.
 *
 * Fórmula base:
 *   Ea = 1 / (1 + 10^((Rb - Ra) / 400))
 *   Nuevo_ELO_A = ELO_A + K * (Resultado_A - Ea)
 */
@Service
public class EloService {

    @Autowired
    private PartidaRepository partidaRepository;

    // ── K-Factor dinámico (estándar FIDE) ──────────────────────────────────────
    /** K para jugadores novatos: menos de 30 partidas jugadas */
    public static final int K_NOVICE       = 40;
    /** K para jugadores regulares: ELO < 2400 */
    public static final int K_REGULAR      = 20;
    /** K para jugadores profesionales: ELO ≥ 2400 */
    public static final int K_PROFESSIONAL = 10;

    /** ELO mínimo absoluto que puede tener un jugador */
    public static final int ELO_MIN = 100;

    // ── Constantes de resultado para Jugador A ─────────────────────────────────
    public static final double VICTORIA = 1.0;
    public static final double EMPATE   = 0.5;
    public static final double DERROTA  = 0.0;

    // ──────────────────────────────────────────────────────────────────────────
    // CLASE DE RETORNO
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Resultado inmutable del cálculo ELO: contiene los nuevos ELOs
     * y los deltas aplicados a cada jugador.
     */
    public static class EloResult {
        /** Nuevo ELO del Jugador A tras la partida */
        public final int nuevoEloA;
        /** Nuevo ELO del Jugador B tras la partida */
        public final int nuevoEloB;
        /** Puntos ganados/perdidos por el Jugador A (puede ser negativo) */
        public final int deltaA;
        /** Puntos ganados/perdidos por el Jugador B (puede ser negativo) */
        public final int deltaB;

        public EloResult(int nuevoEloA, int nuevoEloB, int deltaA, int deltaB) {
            this.nuevoEloA = nuevoEloA;
            this.nuevoEloB = nuevoEloB;
            this.deltaA    = deltaA;
            this.deltaB    = deltaB;
        }

        @Override
        public String toString() {
            return String.format("EloResult{A: %d (%+d), B: %d (%+d)}",
                    nuevoEloA, deltaA, nuevoEloB, deltaB);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MÉTODO PRINCIPAL
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Calcula los nuevos ELOs tras una partida entre Jugador A y Jugador B.
     *
     * Pasos del cálculo:
     *   1. Probabilidad esperada → Ea = 1 / (1 + 10^((Rb-Ra)/400))
     *   2. K-Factor dinámico por jugador
     *   3. Nuevo ELO = ELO + K*(Resultado - Esperado), redondeado al entero más cercano
     *   4. Se aplica un mínimo de {@code ELO_MIN} para evitar ELOs negativos
     *
     * @param eloA       ELO actual del Jugador A (entero ≥ 0)
     * @param eloB       ELO actual del Jugador B (entero ≥ 0)
     * @param resultadoA Resultado del Jugador A: {@code VICTORIA}=1.0, {@code EMPATE}=0.5, {@code DERROTA}=0.0
     * @param partidasA  Número total de partidas jugadas por A (para K dinámico)
     * @param partidasB  Número total de partidas jugadas por B (para K dinámico)
     * @return {@link EloResult} con el nuevo ELO de A y B, y los deltas aplicados
     */
    public EloResult calcularNuevoElo(int eloA, int eloB,
                                       double resultadoA,
                                       long partidasA, long partidasB) {

        // 1. Probabilidades esperadas de victoria (fórmula FIDE)
        //    Ea = 1 / (1 + 10^((Rb - Ra) / 400))
        double esperadaA = 1.0 / (1.0 + Math.pow(10.0, (double)(eloB - eloA) / 400.0));
        double esperadaB = 1.0 / (1.0 + Math.pow(10.0, (double)(eloA - eloB) / 400.0));

        // 2. El resultado de B es el complemento del de A (victoria ↔ derrota, empate ↔ empate)
        double resultadoB = 1.0 - resultadoA;

        // 3. K-Factor dinámico para cada jugador según su historial y ELO
        int kA = obtenerKFactor(eloA, partidasA);
        int kB = obtenerKFactor(eloB, partidasB);

        // 4. Nuevo ELO = ELO_actual + K * (Resultado - Esperado), redondeado
        int deltaA    = (int) Math.round(kA * (resultadoA - esperadaA));
        int deltaB    = (int) Math.round(kB * (resultadoB - esperadaB));
        int nuevoEloA = Math.max(ELO_MIN, eloA + deltaA);
        int nuevoEloB = Math.max(ELO_MIN, eloB + deltaB);

        return new EloResult(nuevoEloA, nuevoEloB, deltaA, deltaB);
    }

    /**
     * Sobrecarga conveniente: resuelve el conteo de partidas automáticamente
     * desde la base de datos usando los IDs de los jugadores.
     *
     * @param eloA       ELO actual del Jugador A
     * @param eloB       ELO actual del Jugador B
     * @param resultadoA Resultado del Jugador A (1.0 / 0.5 / 0.0)
     * @param usuarioAId ID del Jugador A en la base de datos
     * @param usuarioBId ID del Jugador B en la base de datos
     * @return {@link EloResult} con los nuevos ELOs y deltas
     */
    public EloResult calcularNuevoElo(int eloA, int eloB,
                                       double resultadoA,
                                       Long usuarioAId, Long usuarioBId) {
        // Consulta real al repositorio para obtener el historial de partidas
        long partidasA = partidaRepository.findByUsuarioId(usuarioAId).size();
        long partidasB = partidaRepository.findByUsuarioId(usuarioBId).size();
        return calcularNuevoElo(eloA, eloB, resultadoA, partidasA, partidasB);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // K-FACTOR
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Determina el Factor-K según el estándar FIDE:
     * <ul>
     *   <li>K={@value #K_NOVICE}       → Jugador novato (< 30 partidas jugadas)</li>
     *   <li>K={@value #K_PROFESSIONAL} → Jugador profesional (ELO ≥ 2400)</li>
     *   <li>K={@value #K_REGULAR}      → Jugador regular (cualquier otro caso)</li>
     * </ul>
     *
     * @param elo      ELO actual del jugador
     * @param partidas Número total de partidas jugadas en su historial
     * @return Factor-K aplicable a este jugador
     */
    public int obtenerKFactor(int elo, long partidas) {
        if (partidas < 30) return K_NOVICE;
        if (elo >= 2400)   return K_PROFESSIONAL;
        return K_REGULAR;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // UTILIDADES
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Convierte el resultado de una cadena estándar de ajedrez al valor numérico
     * desde la perspectiva del jugador que lleva las piezas blancas.
     *
     * @param resultado Cadena "1-0", "0-1" o "0.5-0.5"
     * @return {@code VICTORIA}, {@code DERROTA} o {@code EMPATE} para las blancas
     * @throws IllegalArgumentException si el formato no es reconocido
     */
    public double resultadoParaBlancas(String resultado) {
        switch (resultado) {
            case "1-0":     return VICTORIA;
            case "0-1":     return DERROTA;
            case "0.5-0.5": return EMPATE;
            default: throw new IllegalArgumentException(
                    "Resultado de partida no reconocido: " + resultado);
        }
    }
}
