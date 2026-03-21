export type TournamentMode = "knockout" | "league";
export type TournamentStatus = "active" | "completed";

export interface Match {
  player1: string | null;
  player2: string | null;
  winner: string | null;
  isBye?: boolean;
}

export interface KnockoutState {
  rounds: Match[][];
  currentRoundIndex: number;
  thirdPlaceMatch: Match | null;
}

export interface LeagueMatch {
  player1: string;
  player2: string;
  winner: string | null;
}

export interface LeagueState {
  matches: LeagueMatch[];
}

export interface Standing {
  name: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
}

export interface TournamentRecord {
  id: string;
  user_id: string;
  participant_ids: string[];
  name: string;
  mode: TournamentMode;
  status: TournamentStatus;
  players: string[];
  state: KnockoutState | LeagueState | null;
  results: {
    champion?: string;
    runnerUp?: string;
    thirdPlace?: string;
  } | null;
  created_at: string;
  completed_at: string | null;
}
