// public/app.js

// Almacenamiento local para recordar en qué encuestas ya votó el usuario
const VOTED_KEY = 'quickpolls_voted';
const getVotedPolls = () => JSON.parse(localStorage.getItem(VOTED_KEY) || '{}');
const setPollVoted = (pollId, optionId) => {
  const voted = getVotedPolls();
  voted[pollId] = optionId;
  localStorage.setItem(VOTED_KEY, JSON.stringify(voted));
};

// Referencias del DOM
const pollForm = document.getElementById('poll-form');
const questionInput = document.getElementById('question-input');
const optionsContainer = document.getElementById('options-container');
const addOptionBtn = document.getElementById('add-option-btn');
const pollsList = document.getElementById('polls-list');
const refreshBtn = document.getElementById('refresh-btn');
const submitBtn = document.getElementById('submit-btn');

// 1. Agregar nuevo campo de opción al formulario
addOptionBtn.addEventListener('click', () => {
  const currentCount = optionsContainer.querySelectorAll('.option-row').length;
  if (currentCount >= 8) {
    alert('Puedes agregar un máximo de 8 opciones');
    return;
  }

  const row = document.createElement('div');
  row.className = 'option-row';
  row.innerHTML = `
    <input type="text" class="option-input" placeholder="Opción ${currentCount + 1}" required />
    <button type="button" class="btn btn-delete btn-sm" title="Eliminar opción">&times;</button>
  `;

  row.querySelector('.btn-delete').addEventListener('click', () => {
    row.remove();
  });

  optionsContainer.appendChild(row);
});

// 2. Obtener y Renderizar Encuestas
async function loadPolls() {
  try {
    pollsList.innerHTML = '<div class="loading-state">Cargando encuestas...</div>';
    const response = await fetch('/api/polls');
    
    if (!response.ok) throw new Error('Error al conectar con la API');
    
    const polls = await response.json();
    renderPolls(polls);
  } catch (error) {
    console.error(error);
    pollsList.innerHTML = `
      <div class="empty-state">
        <p>No se pudieron cargar las encuestas.</p>
        <button class="btn btn-secondary btn-sm" onclick="loadPolls()">Reintentar</button>
      </div>`;
  }
}

function renderPolls(polls) {
  if (!polls || polls.length === 0) {
    pollsList.innerHTML = '<div class="empty-state">No hay encuestas aún. ¡Sé el primero en crear una!</div>';
    return;
  }

  const userVotes = getVotedPolls();

  pollsList.innerHTML = polls.map(poll => {
    const totalVotes = Number(poll.total_votes) || 0;
    const votedOptionId = userVotes[poll.id];
    const hasVoted = Boolean(votedOptionId);

    const optionsHtml = poll.options.map(option => {
      const votes = Number(option.votes_count) || 0;
      const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const isSelected = votedOptionId === option.id;

      return `
        <div 
          class="option-item ${hasVoted ? 'voted-mode' : ''} ${isSelected ? 'user-voted' : ''}" 
          data-poll-id="${poll.id}" 
          data-option-id="${option.id}"
        >
          <div class="progress-bar" style="width: ${hasVoted ? percentage : 0}%"></div>
          <div class="option-content">
            <span class="option-text">${escapeHtml(option.option_text)} ${isSelected ? '✓ (Tu voto)' : ''}</span>
            <span class="option-stats">${votes} voto(s) ${hasVoted ? `(${percentage}%)` : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    const formattedDate = new Date(poll.created_at).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return `
      <div class="poll-card" id="poll-${poll.id}">
        <div class="poll-header">
          <h3 class="poll-question">${escapeHtml(poll.question)}</h3>
          <span class="poll-meta">${formattedDate}</span>
        </div>
        <div class="poll-options">
          ${optionsHtml}
        </div>
        <div class="poll-footer">
          <span>Total: <strong>${totalVotes}</strong> votos</span>
          <span>${hasVoted ? 'Has votado' : 'Haz clic en una opción para votar'}</span>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.option-item:not(.voted-mode)').forEach(item => {
    item.addEventListener('click', handleVote);
  });
}

// 3. Manejar el Voto
async function handleVote(e) {
  const item = e.currentTarget;
  const pollId = Number(item.dataset.pollId);
  const optionId = Number(item.dataset.optionId);

  const userVotes = getVotedPolls();
  if (userVotes[pollId]) {
    alert('Ya has votado en esta encuesta.');
    return;
  }

  try {
    item.style.opacity = '0.5';

    const response = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: optionId })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error al emitir voto');
    }

    setPollVoted(pollId, optionId);
    await loadPolls();
  } catch (error) {
    alert(error.message);
    item.style.opacity = '1';
  }
}

// 4. Crear Nueva Encuesta
pollForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const question = questionInput.value.trim();
  const optionInputs = Array.from(document.querySelectorAll('.option-input'));
  const options = optionInputs
    .map(input => input.value.trim())
    .filter(val => val.length > 0);

  if (!question) {
    alert('Ingresa una pregunta');
    return;
  }

  if (options.length < 2) {
    alert('Ingresa al menos 2 opciones');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Publicando...';

  try {
    const res = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Error al crear la encuesta');
    }

    pollForm.reset();
    optionsContainer.innerHTML = `
      <div class="option-row"><input type="text" class="option-input" placeholder="Opción 1" required /></div>
      <div class="option-row"><input type="text" class="option-input" placeholder="Opción 2" required /></div>
    `;

    await loadPolls();
  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publicar Encuesta';
  }
});

refreshBtn.addEventListener('click', loadPolls);

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', loadPolls);
