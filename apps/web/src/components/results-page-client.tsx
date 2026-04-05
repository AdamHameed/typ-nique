"use client";

import { useEffect, useState } from "react";
import type { GameSessionResult, PersonalLeaderboardResponse } from "@typ-nique/types";
import { getPersonalLeaderboards, getSessionResults } from "../lib/api";
import { ResultsOverview } from "./results-overview";

export function ResultsPageClient({ runId }: { runId: string }) {
  const [result, setResult] = useState<GameSessionResult | null>(null);
  const [personal, setPersonal] = useState<PersonalLeaderboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");

      const [resultResponse, personalResponse] = await Promise.all([
        getSessionResults(runId).catch(() => null),
        getPersonalLeaderboards(runId, 5).catch(() => null)
      ]);

      if (cancelled) {
        return;
      }

      if (!resultResponse?.data) {
        setStatus("error");
        return;
      }

      setResult(resultResponse.data);
      setPersonal(personalResponse?.data ?? null);
      setStatus("ready");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (status === "loading") {
    return <p className="texnique-note">Loading results...</p>;
  }

  if (status === "error" || !result) {
    return <p className="texnique-note">Result not found.</p>;
  }

  return <ResultsOverview result={result} personal={personal} />;
}
