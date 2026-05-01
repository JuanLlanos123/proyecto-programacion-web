package com.ajedrez.models;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "achievements")
public class Achievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private String icon; // CSS Class or FontAwesome icon

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private Usuario user;

    @Temporal(TemporalType.TIMESTAMP)
    private Date dateEarned = new Date();

    public Achievement() {}

    public Achievement(String name, String description, String icon, Usuario user) {
        this.name = name;
        this.description = description;
        this.icon = icon;
        this.user = user;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getIcon() { return icon; }
    public Usuario getUser() { return user; }
    public Date getDateEarned() { return dateEarned; }
}
