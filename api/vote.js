// api/vote.js
const { getPool } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Método ${req.method} no permitido` });
  }

  const { option_id } = req.body || {};

  if (!option_id || isNaN(Number(option_id))) {
    return res.status(400).json({ error: 'El ID de la opción es obligatorio y debe ser numérico' });
  }

  const pool = getPool();

  try {
    const updateResult = await pool.query(
      `UPDATE options 
       SET votes_count = votes_count + 1 
       WHERE id = $1 
       RETURNING id, poll_id, option_text, votes_count`,
      [Number(option_id)]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Opción no encontrada' });
    }

    const updatedOption = updateResult.rows[0];

    const pollResult = await pool.query(
      `SELECT 
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
      WHERE p.id = $1
      GROUP BY p.id`,
      [updatedOption.poll_id]
    );

    return res.status(200).json({
      message: 'Voto registrado exitosamente',
      poll: pollResult.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar voto:', error);
    return res.status(500).json({ error: 'Error interno al procesar el voto' });
  }
};
