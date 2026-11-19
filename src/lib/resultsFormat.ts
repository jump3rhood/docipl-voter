export type ResultRow = {
  teamId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string | null;
  votes: number;
  percent: number;
  rank: number;
};

export type ResultsPayload = { total: number; rows: ResultRow[] };

export function medalFor(row: Pick<ResultRow, 'rank' | 'votes'>): '🥇' | '🥈' | '🥉' | null {
  if (row.votes <= 0) return null;
  if (row.rank === 1) return '🥇';
  if (row.rank === 2) return '🥈';
  if (row.rank === 3) return '🥉';
  return null;
}

const votesFmt = new Intl.NumberFormat('en-IN');

export function formatVotes(n: number): string {
  return votesFmt.format(n);
}

export function formatPercent(p: number): string {
  return `${p.toFixed(1)}%`;
}

export function totalLabel(n: number): string {
  return `${formatVotes(n)} ${n === 1 ? 'vote' : 'votes'} cast`;
}
