import type { LeaderboardEntryView } from "@typ-nique/types";
import { Card } from "@typ-nique/ui";

export function LeaderboardTable({ entries }: { entries: LeaderboardEntryView[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Top daily runs</h2>
        <p className="text-sm text-slate-400">Seeded starter data</p>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Accuracy</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/30">
            {entries.map((entry) => (
              <tr key={entry.userName}>
                <td className="px-4 py-3 font-medium text-white">{entry.userName}</td>
                <td className="px-4 py-3">{entry.score}</td>
                <td className="px-4 py-3">{Math.round(entry.accuracy * 100)}%</td>
                <td className="px-4 py-3 text-slate-400">{entry.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
