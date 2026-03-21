import { KnockoutState, LeagueMatch, LeagueState, Match, Standing } from "@/types/tournament";

function nextPowerOf2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getRoundName(roundIndex: number, totalRounds: number) {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return "FINAL";
  if (fromEnd === 1) return "SEMIFINALS";
  if (fromEnd === 2) return "QUARTERFINALS";
  return `ROUND ${roundIndex + 1}`;
}

export function initKnockout(players: string[]): KnockoutState {
  const shuffled = shuffle(players);
  const n = shuffled.length;
  const bracketSize = nextPowerOf2(n);
  const numRounds = Math.log2(bracketSize);
  const numByes = bracketSize - n;

  const slots = new Array<string | null>(bracketSize).fill(null);
  const byePositions = new Set<number>();
  let byesLeft = numByes;
  for (let i = bracketSize - 1; i >= 0 && byesLeft > 0; i -= 2) {
    byePositions.add(i);
    byesLeft--;
  }

  let pi = 0;
  for (let i = 0; i < bracketSize; i++) {
    slots[i] = byePositions.has(i) ? null : shuffled[pi++];
  }

  const rounds: Match[][] = [];

  const firstRound: Match[] = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const p1 = slots[i];
    const p2 = slots[i + 1];
    const match: Match = { player1: p1, player2: p2, winner: null, isBye: false };

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
  rounds.push(firstRound);

  for (let r = 1; r < numRounds; r++) {
    const numMatches = bracketSize / Math.pow(2, r + 1);
    const round: Match[] = [];
    for (let i = 0; i < numMatches; i++) {
      round.push({ player1: null, player2: null, winner: null, isBye: false });
    }
    rounds.push(round);
  }

  const state: KnockoutState = {
    rounds,
    currentRoundIndex: 0,
    thirdPlaceMatch: null,
  };

  propagateWinners(state, 0);
  state.currentRoundIndex = findCurrentRound(state);
  return state;
}

function propagateWinners(state: KnockoutState, fromRound: number) {
  for (let r = fromRound; r < state.rounds.length - 1; r++) {
    const round = state.rounds[r];
    const nextRound = state.rounds[r + 1];

    for (let i = 0; i < round.length; i += 2) {
      const targetIdx = Math.floor(i / 2);
      if (round[i].winner) {
        nextRound[targetIdx].player1 = round[i].winner;
      }
      if (i + 1 < round.length && round[i + 1].winner) {
        nextRound[targetIdx].player2 = round[i + 1].winner;
      }
    }
  }
}

export function findCurrentRound(state: KnockoutState) {
  for (let r = 0; r < state.rounds.length; r++) {
    const round = state.rounds[r];
    const hasUndecided = round.some((m) => !m.winner && m.player1 && m.player2);
    if (hasUndecided) return r;
  }
  return state.rounds.length - 1;
}

export function setKnockoutWinner(
  state: KnockoutState,
  roundIdx: number,
  matchIdx: number,
  playerKey: "p1" | "p2",
) {
  const cloned: KnockoutState = structuredClone(state);
  if (roundIdx !== cloned.currentRoundIndex) return cloned;

  const match = cloned.rounds[roundIdx][matchIdx];
  if (!match || match.isBye || !match.player1 || !match.player2) return cloned;

  match.winner = playerKey === "p1" ? match.player1 : match.player2;
  return cloned;
}

export function canAdvanceKnockout(state: KnockoutState) {
  const round = state.rounds[state.currentRoundIndex];
  return round.every((m) => m.winner !== null);
}

export function advanceKnockoutRound(state: KnockoutState): KnockoutState {
  const cloned: KnockoutState = structuredClone(state);
  if (!canAdvanceKnockout(cloned)) return cloned;

  const round = cloned.rounds[cloned.currentRoundIndex];
  const nextRound = cloned.rounds[cloned.currentRoundIndex + 1];
  if (!nextRound) return cloned;

  for (let i = 0; i < round.length; i += 2) {
    const targetIdx = Math.floor(i / 2);
    nextRound[targetIdx].player1 = round[i].winner;
    if (i + 1 < round.length) {
      nextRound[targetIdx].player2 = round[i + 1].winner;
    }
  }

  if (nextRound.length === 1 && round.length >= 2) {
    const semiFinalLosers: string[] = [];
    for (const m of round) {
      if (m.player1 && m.player2 && m.winner) {
        semiFinalLosers.push(m.winner === m.player1 ? m.player2 : m.player1);
      }
    }
    if (semiFinalLosers.length === 2) {
      cloned.thirdPlaceMatch = {
        player1: semiFinalLosers[0],
        player2: semiFinalLosers[1],
        winner: null,
      };
    }
  }

  cloned.currentRoundIndex += 1;
  return cloned;
}

export function setThirdPlaceWinner(state: KnockoutState, playerKey: "p1" | "p2") {
  const cloned: KnockoutState = structuredClone(state);
  if (!cloned.thirdPlaceMatch) return cloned;
  const winner = playerKey === "p1" ? cloned.thirdPlaceMatch.player1 : cloned.thirdPlaceMatch.player2;
  cloned.thirdPlaceMatch.winner = winner;
  return cloned;
}

export function isKnockoutComplete(state: KnockoutState) {
  const finalRound = state.rounds[state.rounds.length - 1];
  const finalDecided = finalRound.every((m) => m.winner);
  const thirdDecided = !state.thirdPlaceMatch || !!state.thirdPlaceMatch.winner;
  return finalDecided && thirdDecided;
}

export function knockoutResults(state: KnockoutState, players: string[]) {
  const finalMatch = state.rounds[state.rounds.length - 1][0];
  const champion = finalMatch?.winner ?? undefined;
  const runnerUp =
    finalMatch?.winner === finalMatch?.player1 ? finalMatch?.player2 ?? undefined : finalMatch?.player1 ?? undefined;

  let thirdPlace = state.thirdPlaceMatch?.winner ?? undefined;
  if (!thirdPlace && players.length >= 3) {
    thirdPlace = players.find((p) => p !== champion && p !== runnerUp);
  }

  return { champion, runnerUp, thirdPlace };
}

export function initLeague(players: string[]): LeagueState {
  const matches: LeagueMatch[] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      matches.push({ player1: players[i], player2: players[j], winner: null });
    }
  }
  return { matches: shuffle(matches) };
}

export function setLeagueWinner(state: LeagueState, matchIdx: number, playerKey: "p1" | "p2") {
  const cloned: LeagueState = structuredClone(state);
  const match = cloned.matches[matchIdx];
  if (!match) return cloned;
  const nextWinner = playerKey === "p1" ? match.player1 : match.player2;
  match.winner = match.winner === nextWinner ? null : nextWinner;
  return cloned;
}

export function leagueCompleted(state: LeagueState) {
  return state.matches.length > 0 && state.matches.every((m) => !!m.winner);
}

export function calculateStandings(players: string[], state: LeagueState): Standing[] {
  const stats: Record<string, Standing> = {};
  players.forEach((p) => {
    stats[p] = { name: p, played: 0, wins: 0, losses: 0, points: 0 };
  });

  state.matches.forEach((m) => {
    if (!m.winner) return;
    const loser = m.winner === m.player1 ? m.player2 : m.player1;
    stats[m.winner].played += 1;
    stats[m.winner].wins += 1;
    stats[m.winner].points += 3;
    stats[loser].played += 1;
    stats[loser].losses += 1;
  });

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });
}

export function leagueResults(players: string[], state: LeagueState) {
  const standings = calculateStandings(players, state);
  return {
    champion: standings[0]?.name,
    runnerUp: standings[1]?.name,
    thirdPlace: standings[2]?.name,
    standings,
  };
}
