import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MultiplayerResultsClient } from "../../src/components/multiplayer-results-client";
import { createMultiplayerReplayFixture } from "../helpers/multiplayer-fixtures";

const mocks = vi.hoisted(() => ({
  getMultiplayerRoomResults: vi.fn()
}));

vi.mock("../../src/lib/api", () => ({
  getMultiplayerRoomResults: mocks.getMultiplayerRoomResults
}));

describe("MultiplayerResultsClient", () => {
  it("renders final placements and per-round replay data", async () => {
    mocks.getMultiplayerRoomResults.mockResolvedValue({
      data: createMultiplayerReplayFixture()
    });

    render(<MultiplayerResultsClient matchId="room-1" />);

    await waitFor(() => {
      expect(screen.getByText("Final placements")).toBeInTheDocument();
    });

    expect(screen.getByText(/#1 Ada/)).toBeInTheDocument();
    expect(screen.getByText(/540 points/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Round breakdown"));
    expect(screen.getByText(/Aligned Sum/)).toBeInTheDocument();
    expect(screen.getByText(/Accepted\./)).toBeInTheDocument();
  });

  it("renders diagnostics separately when explicitly requested", async () => {
    mocks.getMultiplayerRoomResults.mockResolvedValue({
      data: createMultiplayerReplayFixture()
    });

    render(<MultiplayerResultsClient matchId="room-1" includeDiagnostics />);

    await waitFor(() => {
      expect(screen.getByText("Race progression debug view")).toBeInTheDocument();
    });

    expect(screen.getByText(/session session-1/i)).toBeInTheDocument();
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
    expect(screen.getByText(/Room version/i)).toBeInTheDocument();
  });
});
