// api/polls.js
const { getPool } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const pool = getPool();

  // 1. GET: Listar todas las encuestas con sus opciones
  if (req.method === 'GET') {
    try {
      const query = `
        SELECT 
          p.id,
          p.question,
          p.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', o.id,
                'option_text', o.option_text,
                'votes_count', o.votes_count
              ) ORDER BY o.id ASC
            ) FILTER (WHERE o.id IS NOT NULL), 
            '[]'
          ) AS options,
          COALESCE(SUM(o.votes_count), 0)::int AS total_votes
        FROM polls p
        LEFT JOIN options o ON p.id = o.poll_id
        GROUP BY p.id
        ORDER BY p.created_at DESC;
      `;
      const result = await pool.query(query);
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error al obtener encuestas:', error);
      return res.status(500).json({ error: 'Error interno al consultar las encuestas' });
    }
  }

  // 2. POST: Crear una nueva encuesta con sus opciones
  if (req.method === 'POST') {
    const { question, options } = req.body || {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'La pregunta es obligatoria' });
    }

    const validOptions = Array.isArray(options) 
      ? options.map(opt => (typeof opt === 'string' ? opt.trim() : '')).filter(Boolean)
      : [];

    if (validOptions.length < 2) {
      return res.status(400).json({ error: 'Debes proporcionar al menos 2 opciones válidas' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const pollInsert = await client.query(
        'INSERT INTO polls (question) VALUES ($1) RETURNING id, question, created_at',
        [question.trim()]
      );
      const newPoll = pollInsert.rows[0];

      const insertedOptions = [];
      for (const text of validOptions) {
        const optInsert = await client.query(
          'INSERT INTO options (poll_id, option_text) VALUES ($1, $2) RETURNING id, option_text, votes_count',
          [newPoll.id, text]
        );
        insertedOptions.push(optInsert.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        id: newPoll.id,
        question: newPoll.question,
        created_at: newPoll.created_at,
        options: insertedOptions,
        total_votes: 0
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al crear encuesta:', error);
      return res.status(500).json({ error: 'Error al registrar la encuesta' });
    } finally {
      client.release();
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Método ${req.method} no permitido` });
};
