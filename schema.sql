-- schema.sql

-- 1. Tabla de Encuestas (polls)
CREATE TABLE IF NOT EXISTS polls (
    id SERIAL PRIMARY KEY,
    question VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Opciones (options)
CREATE TABLE IF NOT EXISTS options (
    id SERIAL PRIMARY KEY,
    poll_id INT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text VARCHAR(255) NOT NULL,
    votes_count INT NOT NULL DEFAULT 0
);

-- Índice para optimizar las consultas por encuesta
CREATE INDEX IF NOT EXISTS idx_options_poll_id ON options(poll_id);

-- Datos de prueba iniciales (opcional)
INSERT INTO polls (question) VALUES ('¿Cuál es tu lenguaje de programación favorito?');
INSERT INTO options (poll_id, option_text, votes_count) VALUES 
    (1, 'JavaScript / TypeScript', 5),
    (1, 'Python', 4),
    (1, 'Rust', 2),
    (1, 'Go', 1);
