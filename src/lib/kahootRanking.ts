export interface RankablePlayer {
  id: string;
  score: number;
}

/** Standard competition ranking (1-2-2-4) */
export function getCompetitionRank(players: RankablePlayer[], playerId: string): number {
  const player = players.find((p) => p.id === playerId);
  if (!player) return players.length;
  const higher = players.filter((p) => p.score > player.score).length;
  return higher + 1;
}

export function buildPlayerRanks(players: RankablePlayer[]): Record<string, number> {
  const ranks: Record<string, number> = {};
  for (const p of players) {
    ranks[p.id] = getCompetitionRank(players, p.id);
  }
  return ranks;
}
