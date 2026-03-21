/* ================================================================
   CALL OF DUTY MOBILE — ONE SHOT ONE KILL TOURNAMENT MANAGER
   ================================================================ */

// ==================== STATE ====================
let players = [];
let mode = null;
let currentScreen = 'setup';

// Knockout
let knockoutRounds = [];
let currentRoundIndex = 0;
let thirdPlaceMatch = null;

// League
let leagueMatches = [];

// ==================== HELPERS ====================
const $ = (id) => document.getElementById(id);

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRoundName(roundIndex, totalRounds) {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return 'FINAL';
  if (fromEnd === 1) return 'SEMIFINALS';
  if (fromEnd === 2) return 'QUARTERFINALS';
  return `ROUND ${roundIndex + 1}`;
}

// ==================== SCREENS ====================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const el = $(name + '-screen');
  if (el) {
    el.classList.add('active');
    currentScreen = name;
  }
}

// ==================== PLAYER MANAGEMENT ====================
function addPlayer() {
  const input = $('player-input');
  const name = input.value.trim();
  if (!name) return;
  if (players.length >= 64) return;
  players.push(name);
  input.value = '';
  input.focus();
  renderPlayers();
  updateStartButton();
}

function removePlayer(index) {
  players.splice(index, 1);
  renderPlayers();
  updateStartButton();
}

function startEditPlayer(index) {
  const item = document.querySelector(`[data-player-index="${index}"]`);
  if (!item) return;
  const nameEl = item.querySelector('.player-name-display');
  const currentName = players[index];

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'player-name-edit';
  input.value = currentName;
  input.maxLength = 24;

  nameEl.replaceWith(input);
  input.focus();
  input.select();

  const save = () => {
    const newName = input.value.trim();
    if (newName) players[index] = newName;
    renderPlayers();
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') renderPlayers();
  });
}

function renderPlayers() {
  const list = $('player-list');
  const count = $('player-count');

  if (players.length === 0) {
    list.innerHTML = `<div style="text-align:center;color:var(--text-dim);padding:30px;font-style:italic;">
      No operators deployed. Add players above.</div>`;
    count.textContent = '';
    return;
  }

  list.innerHTML = players
    .map(
      (name, i) => `
    <div class="player-item" data-player-index="${i}">
      <span class="player-number">${String(i + 1).padStart(2, '0')}</span>
      <span class="player-name-display" onclick="startEditPlayer(${i})" title="Click to edit">${escHtml(name)}</span>
      <button class="player-remove" onclick="removePlayer(${i})" title="Remove">✕</button>
    </div>`
    )
    .join('');

  count.textContent = `${players.length} OPERATOR${players.length !== 1 ? 'S' : ''} READY`;
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== MODE SELECTION ====================
function selectMode(selected) {
  mode = selected;
  document.querySelectorAll('.mode-card').forEach((card) => {
    card.classList.toggle('selected', card.dataset.mode === selected);
  });
  const status = $('mode-status');
  status.textContent =
    selected === 'knockout'
      ? '// SINGLE ELIMINATION — WINNER TAKES ALL'
      : '// ROUND ROBIN — EVERY FIGHT COUNTS';
  updateStartButton();
}

function updateStartButton() {
  const btn = $('start-btn');
  const err = $('start-error');
  const minPlayers = mode === 'league' ? 2 : 2;

  if (!mode) {
    btn.disabled = true;
    err.textContent = '';
    return;
  }
  if (players.length < minPlayers) {
    btn.disabled = true;
    err.textContent = `Need at least ${minPlayers} operators for ${mode} tournament`;
    return;
  }
  btn.disabled = false;
  err.textContent = '';
}

// ==================== START TOURNAMENT ====================
function startTournament() {
  if (!mode || players.length < 2) return;

  if (mode === 'knockout') {
    initKnockout();
    showScreen('knockout');
  } else {
    initLeague();
    showScreen('league');
  }
}

// ==================== KNOCKOUT TOURNAMENT ====================
function initKnockout() {
  const shuffled = shuffle(players);
  const n = shuffled.length;
  const bracketSize = nextPowerOf2(n);
  const numRounds = Math.log2(bracketSize);
  const numByes = bracketSize - n;

  // Distribute players and byes into slots
  const slots = new Array(bracketSize).fill(null);
  const byePositions = new Set();
  let byesLeft = numByes;
  for (let i = bracketSize - 1; i >= 0 && byesLeft > 0; i -= 2) {
    byePositions.add(i);
    byesLeft--;
  }

  let pi = 0;
  for (let i = 0; i < bracketSize; i++) {
    slots[i] = byePositions.has(i) ? null : shuffled[pi++];
  }

  // Build rounds
  knockoutRounds = [];

  // First round
  const firstRound = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const p1 = slots[i];
    const p2 = slots[i + 1];
    const match = { player1: p1, player2: p2, winner: null, isBye: false };

    if (!p1 && !p2) {
      match.isBye = true;
    } else if (!p1) {
      match.winner = p2;
      match.isBye = true;
    } else if (!p2) {
      match.winner = p1;
      match.isBye = true;
    }
    firstRound.push(match);
  }
  knockoutRounds.push(firstRound);

  // Subsequent rounds
  for (let r = 1; r < numRounds; r++) {
    const numMatches = bracketSize / Math.pow(2, r + 1);
    const round = [];
    for (let i = 0; i < numMatches; i++) {
      round.push({ player1: null, player2: null, winner: null, isBye: false });
    }
    knockoutRounds.push(round);
  }

  // Auto-populate from byes
  propagateWinners(0);

  currentRoundIndex = findCurrentRound();
  thirdPlaceMatch = null;

  renderKnockout();
}

function propagateWinners(fromRound) {
  for (let r = fromRound; r < knockoutRounds.length - 1; r++) {
    const round = knockoutRounds[r];
    const nextRound = knockoutRounds[r + 1];

    for (let i = 0; i < round.length; i += 2) {
      const targetIdx = Math.floor(i / 2);
      if (round[i].winner) {
        nextRound[targetIdx].player1 = round[i].winner;
      }
      if (i + 1 < round.length && round[i + 1].winner) {
        nextRound[targetIdx].player2 = round[i + 1].winner;
      }

      // Auto-advance if one player is set and the other slot's source is a double-bye
      if (nextRound[targetIdx].player1 && nextRound[targetIdx].player2) {
        // Both set — playable match, don't auto-decide
      } else if (nextRound[targetIdx].player1 && !nextRound[targetIdx].player2) {
        const sourceMatch = round[i + 1];
        if (sourceMatch && sourceMatch.isBye && !sourceMatch.player1 && !sourceMatch.player2) {
          nextRound[targetIdx].winner = nextRound[targetIdx].player1;
          nextRound[targetIdx].isBye = true;
        }
      } else if (!nextRound[targetIdx].player1 && nextRound[targetIdx].player2) {
        const sourceMatch = round[i];
        if (sourceMatch && sourceMatch.isBye && !sourceMatch.player1 && !sourceMatch.player2) {
          nextRound[targetIdx].winner = nextRound[targetIdx].player2;
          nextRound[targetIdx].isBye = true;
        }
      }
    }
  }
}

function findCurrentRound() {
  for (let r = 0; r < knockoutRounds.length; r++) {
    const round = knockoutRounds[r];
    const hasUndecided = round.some((m) => !m.winner && m.player1 && m.player2);
    if (hasUndecided) return r;
  }
  return knockoutRounds.length - 1;
}

function selectKnockoutWinner(roundIdx, matchIdx, playerKey) {
  if (roundIdx !== currentRoundIndex) return;

  const match = knockoutRounds[roundIdx][matchIdx];
  if (match.isBye) return;
  if (!match.player1 || !match.player2) return;

  match.winner = playerKey === 'p1' ? match.player1 : match.player2;
  renderKnockout();
}

function selectThirdPlaceWinner(playerKey) {
  if (!thirdPlaceMatch) return;
  thirdPlaceMatch.winner = playerKey === 'p1' ? thirdPlaceMatch.player1 : thirdPlaceMatch.player2;
  renderKnockout();
}

function canAdvanceKnockout() {
  const round = knockoutRounds[currentRoundIndex];
  return round.every((m) => m.winner !== null);
}

function advanceRound() {
  if (!canAdvanceKnockout()) return;

  const round = knockoutRounds[currentRoundIndex];
  const nextRound = knockoutRounds[currentRoundIndex + 1];

  if (!nextRound) {
    showResults();
    return;
  }

  // Populate next round
  for (let i = 0; i < round.length; i += 2) {
    const targetIdx = Math.floor(i / 2);
    nextRound[targetIdx].player1 = round[i].winner;
    if (i + 1 < round.length) {
      nextRound[targetIdx].player2 = round[i + 1].winner;
    }
  }

  // Check if next round is the final (1 match) and current was semis (2 matches)
  if (nextRound.length === 1 && round.length >= 2) {
    const semiFinalLosers = [];
    for (const m of round) {
      if (m.player1 && m.player2 && m.winner) {
        const loser = m.winner === m.player1 ? m.player2 : m.player1;
        semiFinalLosers.push(loser);
      }
    }
    if (semiFinalLosers.length === 2) {
      thirdPlaceMatch = {
        player1: semiFinalLosers[0],
        player2: semiFinalLosers[1],
        winner: null,
      };
    }
  }

  currentRoundIndex++;
  renderKnockout();
}

function isKnockoutComplete() {
  const finalRound = knockoutRounds[knockoutRounds.length - 1];
  const finalDecided = finalRound.every((m) => m.winner);
  const thirdDecided = !thirdPlaceMatch || thirdPlaceMatch.winner;
  return finalDecided && thirdDecided;
}

function renderKnockout() {
  const container = $('bracket-container');
  const totalRounds = knockoutRounds.length;

  // Calculate bracket height
  const firstRoundMatches = knockoutRounds[0].length;
  const bracketHeight = Math.max(400, firstRoundMatches * 100);

  let html = `<div class="bracket" style="min-height:${bracketHeight}px">`;

  for (let r = 0; r < totalRounds; r++) {
    const round = knockoutRounds[r];
    const roundName = getRoundName(r, totalRounds);
    const isActive = r === currentRoundIndex;

    if (r > 0) {
      const prevRound = knockoutRounds[r - 1];
      html += `<div class="bracket-connector">`;
      for (let i = 0; i < prevRound.length; i += 2) {
        html += `<div class="connector-pair"></div>`;
      }
      html += `</div>`;
    }

    html += `<div class="bracket-round">`;
    html += `<div class="bracket-round-label ${isActive ? 'active-round' : ''}">${roundName}</div>`;

    for (let m = 0; m < round.length; m++) {
      const match = round[m];
      html += renderMatchCard(match, r, m, isActive);
    }

    html += `</div>`;
  }

  // Champion column
  const finalMatch = knockoutRounds[totalRounds - 1][0];
  html += `<div class="bracket-connector">
    <div class="connector-pair"></div>
  </div>`;
  html += `<div class="bracket-round">`;
  html += `<div class="bracket-round-label" style="color:var(--gold)">CHAMPION</div>`;
  html += `<div class="match-pair"><div class="match-card" style="border-color:var(--gold);text-align:center;padding:12px;">
    <span style="font-family:var(--font-display);font-size:1.3rem;letter-spacing:2px;color:${finalMatch.winner ? 'var(--gold)' : 'var(--text-dim)'}">
      ${finalMatch.winner ? '🏆 ' + escHtml(finalMatch.winner) : 'TBD'}
    </span>
  </div></div>`;
  html += `</div>`;

  html += `</div>`;
  container.innerHTML = html;

  // 3rd place section
  const tpSection = $('third-place-section');
  const tpContainer = $('third-place-match');
  if (thirdPlaceMatch) {
    tpSection.classList.remove('hidden');
    tpContainer.innerHTML = renderThirdPlaceCard(thirdPlaceMatch);
  } else {
    tpSection.classList.add('hidden');
  }

  // Round info
  const roundInfo = $('knockout-round-info');
  roundInfo.textContent = `${getRoundName(currentRoundIndex, totalRounds)} — Select winners by clicking player names`;

  // Action buttons
  const advanceBtn = $('advance-btn');
  const finishBtn = $('finish-btn');

  if (currentRoundIndex < totalRounds - 1 && canAdvanceKnockout()) {
    advanceBtn.classList.remove('hidden');
    const nextName = getRoundName(currentRoundIndex + 1, totalRounds);
    advanceBtn.textContent = `ADVANCE TO ${nextName} →`;
  } else {
    advanceBtn.classList.add('hidden');
  }

  if (currentRoundIndex === totalRounds - 1 && isKnockoutComplete()) {
    finishBtn.classList.remove('hidden');
  } else {
    finishBtn.classList.add('hidden');
  }
}

function renderMatchCard(match, roundIdx, matchIdx, isActiveRound) {
  const { player1, player2, winner, isBye } = match;
  const isPlayable = isActiveRound && player1 && player2 && !isBye;
  const isDecided = winner !== null;

  let classes = 'match-card';
  if (isPlayable && !isDecided) classes += ' active-match';
  if (isDecided && !isBye) classes += ' decided';
  if (isBye) classes += ' bye-match';

  let p1Classes = 'match-player';
  let p2Classes = 'match-player';

  if (isPlayable) {
    p1Classes += ' clickable';
    p2Classes += ' clickable';
  }
  if (winner === player1 && player1) {
    p1Classes += ' winner';
    if (player2) p2Classes += ' loser';
  }
  if (winner === player2 && player2) {
    p2Classes += ' winner';
    if (player1) p1Classes += ' loser';
  }
  if (!player1) p1Classes += isBye ? ' bye' : ' tbd';
  if (!player2) p2Classes += isBye ? ' bye' : ' tbd';

  const p1Click = isPlayable ? `onclick="selectKnockoutWinner(${roundIdx},${matchIdx},'p1')"` : '';
  const p2Click = isPlayable ? `onclick="selectKnockoutWinner(${roundIdx},${matchIdx},'p2')"` : '';

  const p1Label = player1 ? escHtml(player1) : (isBye ? 'BYE' : 'TBD');
  const p2Label = player2 ? escHtml(player2) : (isBye ? 'BYE' : 'TBD');

  return `<div class="match-pair"><div class="${classes}">
    <div class="${p1Classes}" ${p1Click}>
      <span class="match-player-name">${p1Label}</span>
      ${winner === player1 && player1 ? '<span class="winner-icon">◄ W</span>' : ''}
    </div>
    <div class="match-divider"></div>
    <div class="${p2Classes}" ${p2Click}>
      <span class="match-player-name">${p2Label}</span>
      ${winner === player2 && player2 ? '<span class="winner-icon">◄ W</span>' : ''}
    </div>
  </div></div>`;
}

function renderThirdPlaceCard(match) {
  const { player1, player2, winner } = match;

  let p1Classes = 'match-player clickable';
  let p2Classes = 'match-player clickable';

  if (winner === player1) {
    p1Classes += ' winner';
    p2Classes += ' loser';
  }
  if (winner === player2) {
    p2Classes += ' winner';
    p1Classes += ' loser';
  }

  return `<div class="match-card ${winner ? 'decided' : 'active-match'}">
    <div class="${p1Classes}" onclick="selectThirdPlaceWinner('p1')">
      <span class="match-player-name">${escHtml(player1)}</span>
      ${winner === player1 ? '<span class="winner-icon">◄ W</span>' : ''}
    </div>
    <div class="match-divider"></div>
    <div class="${p2Classes}" onclick="selectThirdPlaceWinner('p2')">
      <span class="match-player-name">${escHtml(player2)}</span>
      ${winner === player2 ? '<span class="winner-icon">◄ W</span>' : ''}
    </div>
  </div>`;
}

// ==================== LEAGUE TOURNAMENT ====================
function initLeague() {
  leagueMatches = [];
  const n = players.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      leagueMatches.push({
        player1: players[i],
        player2: players[j],
        winner: null,
      });
    }
  }

  // Shuffle match order for variety
  leagueMatches = shuffle(leagueMatches);
  renderLeague();
}

function setLeagueResult(matchIdx, playerKey) {
  const match = leagueMatches[matchIdx];
  const newWinner = playerKey === 'p1' ? match.player1 : match.player2;
  match.winner = match.winner === newWinner ? null : newWinner;
  renderLeague();
}

function calculateStandings() {
  const stats = {};
  players.forEach((p) => {
    stats[p] = { name: p, played: 0, wins: 0, losses: 0, points: 0 };
  });

  leagueMatches.forEach((m) => {
    if (m.winner) {
      const loser = m.winner === m.player1 ? m.player2 : m.player1;
      stats[m.winner].played++;
      stats[m.winner].wins++;
      stats[m.winner].points += 3;
      stats[loser].played++;
      stats[loser].losses++;
    }
  });

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });
}

function renderLeague() {
  const standings = calculateStandings();

  // Standings table
  const standingsHtml = `<table>
    <thead><tr>
      <th>#</th><th>OPERATOR</th><th class="center">P</th>
      <th class="center">W</th><th class="center">L</th><th class="center">PTS</th>
    </tr></thead>
    <tbody>${standings
      .map(
        (s, i) => `
      <tr class="rank-${i + 1}">
        <td>${i + 1}</td>
        <td class="standings-name">${escHtml(s.name)}</td>
        <td class="center">${s.played}</td>
        <td class="center">${s.wins}</td>
        <td class="center">${s.losses}</td>
        <td class="center standings-pts">${s.points}</td>
      </tr>`
      )
      .join('')}
    </tbody></table>`;

  $('standings-table').innerHTML = standingsHtml;

  // Matches
  const matchesHtml = leagueMatches
    .map((m, i) => {
      const decided = m.winner !== null;
      let p1Class = 'league-player';
      let p2Class = 'league-player';
      if (m.winner === m.player1) p1Class += ' winner';
      if (m.winner === m.player2) p2Class += ' winner';

      return `<div class="league-match-card ${decided ? 'decided' : ''}">
      <div class="${p1Class}" onclick="setLeagueResult(${i},'p1')">${escHtml(m.player1)}</div>
      <span class="league-vs">VS</span>
      <div class="${p2Class}" onclick="setLeagueResult(${i},'p2')">${escHtml(m.player2)}</div>
    </div>`;
    })
    .join('');

  $('league-matches').innerHTML = matchesHtml;

  // Finish button
  const allDecided = leagueMatches.every((m) => m.winner);
  const finishBtn = $('league-finish-btn');
  if (allDecided && leagueMatches.length > 0) {
    finishBtn.classList.remove('hidden');
  } else {
    finishBtn.classList.add('hidden');
  }
}

// ==================== RESULTS ====================
function showResults() {
  let champion, runnerUp, thirdPlace;
  let allParticipants = [];

  if (mode === 'knockout') {
    const finalMatch = knockoutRounds[knockoutRounds.length - 1][0];
    champion = finalMatch.winner;
    runnerUp = finalMatch.winner === finalMatch.player1 ? finalMatch.player2 : finalMatch.player1;

    if (thirdPlaceMatch && thirdPlaceMatch.winner) {
      thirdPlace = thirdPlaceMatch.winner;
    } else if (players.length >= 3) {
      for (const p of players) {
        if (p !== champion && p !== runnerUp) {
          thirdPlace = p;
          break;
        }
      }
    }
  } else {
    const standings = calculateStandings();
    if (standings.length > 0) champion = standings[0].name;
    if (standings.length > 1) runnerUp = standings[1].name;
    if (standings.length > 2) thirdPlace = standings[2].name;
    allParticipants = standings;
  }

  const showThird = thirdPlace && players.length >= 3;

  let html = `
    <div class="results-title">MISSION COMPLETE</div>
    <div class="podium">
      <div class="podium-place second">
        <div class="podium-avatar">🥈</div>
        <div class="podium-label">2ND PLACE</div>
        <div class="podium-name">${runnerUp ? escHtml(runnerUp) : '—'}</div>
        <div class="podium-block">2</div>
      </div>
      <div class="podium-place first">
        <div class="podium-avatar">🏆</div>
        <div class="podium-label">CHAMPION</div>
        <div class="podium-name">${champion ? escHtml(champion) : '—'}</div>
        <div class="podium-block">1</div>
      </div>
      ${showThird ? `<div class="podium-place third">
        <div class="podium-avatar">🥉</div>
        <div class="podium-label">3RD PLACE</div>
        <div class="podium-name">${escHtml(thirdPlace)}</div>
        <div class="podium-block">3</div>
      </div>` : ''}
    </div>`;

  if (mode === 'league' && allParticipants.length > 0) {
    html += `<div class="results-stats">
      <h3>FINAL STANDINGS</h3>
      <table>
        <thead><tr><th>#</th><th>OPERATOR</th><th>W</th><th>L</th><th>PTS</th></tr></thead>
        <tbody>${allParticipants
          .map(
            (s, i) => `<tr>
            <td>${i + 1}</td>
            <td class="standings-name">${escHtml(s.name)}</td>
            <td>${s.wins}</td><td>${s.losses}</td>
            <td class="standings-pts">${s.points}</td>
          </tr>`
          )
          .join('')}
        </tbody>
      </table>
    </div>`;
  }

  $('results-content').innerHTML = html;
  showScreen('results');
}

// ==================== RESET ====================
function resetTournament() {
  knockoutRounds = [];
  currentRoundIndex = 0;
  thirdPlaceMatch = null;
  leagueMatches = [];
  mode = null;

  document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('selected'));
  $('mode-status').textContent = '';

  updateStartButton();
  renderPlayers();
  showScreen('setup');
}

// ==================== INIT ====================
function init() {
  // Enter key to add player
  $('player-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addPlayer();
  });

  renderPlayers();
  updateStartButton();
}

document.addEventListener('DOMContentLoaded', init);
