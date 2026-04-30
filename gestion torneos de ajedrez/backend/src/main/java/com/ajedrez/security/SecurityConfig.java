package com.ajedrez.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/index.html", "/favicon.ico", "/static/**", "/css/**", "/js/**", "/img/**").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/h2-console/**").permitAll()
                // Permitir lectura pública de torneos, partidas e inscripciones
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/torneos/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/partidas/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/usuarios/**").permitAll()
                // Escritura solo para autenticados
                .anyRequest().authenticated()
            )
            // Necesario para que la consola de H2 funcione correctamente dentro del iframe
            .headers(headers -> headers.frameOptions(frame -> frame.disable()))
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Permitir todos los orígenes para la fase de desarrollo
        configuration.setAllowedOrigins(Arrays.asList(
            "*", 
            "https://frontend-m3li-production.up.railway.app",
            "https://juanllanos123.github.io" // Ejemplo para GitHub Pages (ajustar si es necesario)
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("authorization", "content-type", "x-auth-token"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
