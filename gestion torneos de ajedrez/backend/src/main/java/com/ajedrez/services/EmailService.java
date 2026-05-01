package com.ajedrez.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    public void sendWelcomeEmail(String to, String username, String password) {
        if (mailSender == null) {
            System.out.println("DEBUG: JavaMailSender no configurado. Simulación de envío a: " + to);
            System.out.println("Asunto: Bienvenido a ChessPro");
            System.out.println("Contenido: Hola " + username + ", tus credenciales son: User: " + username + " / Pass: " + password);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("no-reply@chesspro.com");
            message.setTo(to);
            message.setSubject("¡Bienvenido a la Plataforma de Torneos ChessPro!");
            message.setText("Hola " + username + ",\n\n" +
                    "Has sido registrado manualmente en nuestra plataforma. " +
                    "Aquí tienes tus credenciales de acceso:\n\n" +
                    "Usuario: " + username + "\n" +
                    "Contraseña: " + password + "\n\n" +
                    "¡Buena suerte en tus partidas!");
            
            mailSender.send(message);
            System.out.println("Correo enviado con éxito a " + to);
        } catch (Exception e) {
            System.err.println("Error al enviar correo: " + e.getMessage());
        }
    }

    /** Envía una notificación cuando se genera una nueva ronda */
    public void sendRoundNotification(String to, String username, String tournamentName, int round, String opponent) {
        if (mailSender == null) {
            System.out.println("DEBUG: JavaMailSender no configurado. Simulación de notificación a: " + to);
            System.out.println("Asunto: ¡Ronda " + round + " generada en " + tournamentName + "!");
            System.out.println("Contenido: Hola " + username + ", tu oponente para la Ronda " + round + " es: " + opponent);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("notificaciones@chesspro.com");
            message.setTo(to);
            message.setSubject("¡Ronda " + round + " generada en " + tournamentName + "!");
            message.setText("Hola " + username + ",\n\n" +
                    "Se ha generado la Ronda " + round + " en el torneo '" + tournamentName + "'.\n" +
                    "Tu oponente asignado es: " + opponent + ".\n\n" +
                    "¡Buena suerte en tu partida!");
            
            mailSender.send(message);
            System.out.println("Notificación de ronda enviada a " + to);
        } catch (Exception e) {
            System.err.println("Error al enviar notificación de ronda: " + e.getMessage());
        }
    }
}
