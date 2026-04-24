package com.ajedrez.services;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.HashMap;
import java.util.Map;

@Service
public class RecaptchaService {

    private final String SECRET_KEY = "6Le-KccsAAAAAL23RwL11usZ0xxYCo8I_J2rYRrZ";
    private final String GOOGLE_RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

    public boolean verify(String token) {
        if (token == null || token.isEmpty()) return false;

        RestTemplate restTemplate = new RestTemplate();
        String url = GOOGLE_RECAPTCHA_VERIFY_URL + "?secret=" + SECRET_KEY + "&response=" + token;
        
        try {
            Map<String, Object> response = restTemplate.postForObject(url, null, Map.class);
            return response != null && (Boolean) response.get("success");
        } catch (Exception e) {
            return false;
        }
    }
}
