import { describe, expect, it } from "vitest";
import type { MultiplayerGatewayServerEvent } from "@typ-nique/types";
import { commitRoomEvent, createInitialRoomEventCursor, shouldAcceptRoomEvent } from "../../src/lib/multiplayer-room-sync";

function buildEvent(overrides: Partial<MultiplayerGatewayServerEvent<unknown>>): MultiplayerGatewayServerEvent<unknown> {
  return {
    type: "room.snapshot",
    roomId: "room-1",
    roomVersion: 1,
    eventSequence: 1,
    occurredAt: "2026-04-10T12:00:00.000Z",
    payload: {},
    ...overrides
  };
}

describe("multiplayer room sync cursor", () => {
  it("accepts the first event and advances the cursor", () => {
    const initial = createInitialRoomEventCursor();
    const event = buildEvent({});

    expect(shouldAcceptRoomEvent(initial, event)).toBe(true);
    expect(commitRoomEvent(initial, event)).toEqual({
      roomId: "room-1",
      roomVersion: 1,
      eventSequence: 1
    });
  });

  it("rejects stale events from an older room version", () => {
    const cursor = {
      roomId: "room-1",
      roomVersion: 3,
      eventSequence: 2
    };

    expect(shouldAcceptRoomEvent(cursor, buildEvent({ roomVersion: 2, eventSequence: 99 }))).toBe(false);
  });

  it("rejects duplicate or out-of-order events within the same room version", () => {
    const cursor = {
      roomId: "room-1",
      roomVersion: 4,
      eventSequence: 7
    };

    expect(shouldAcceptRoomEvent(cursor, buildEvent({ roomVersion: 4, eventSequence: 7 }))).toBe(false);
    expect(shouldAcceptRoomEvent(cursor, buildEvent({ roomVersion: 4, eventSequence: 6 }))).toBe(false);
    expect(shouldAcceptRoomEvent(cursor, buildEvent({ roomVersion: 4, eventSequence: 8 }))).toBe(true);
  });

  it("rejects events targeting a different room once subscribed", () => {
    const cursor = {
      roomId: "room-1",
      roomVersion: 1,
      eventSequence: 1
    };

    expect(shouldAcceptRoomEvent(cursor, buildEvent({ roomId: "room-2", roomVersion: 2, eventSequence: 1 }))).toBe(false);
  });

  it("accepts a reconnect snapshot with a newer room version and resets ordering from there", () => {
    const cursor = {
      roomId: "room-1",
      roomVersion: 2,
      eventSequence: 9
    };
    const reconnectSnapshot = buildEvent({
      type: "room.snapshot",
      roomVersion: 5,
      eventSequence: 1
    });

    expect(shouldAcceptRoomEvent(cursor, reconnectSnapshot)).toBe(true);

    const nextCursor = commitRoomEvent(cursor, reconnectSnapshot);
    expect(nextCursor).toEqual({
      roomId: "room-1",
      roomVersion: 5,
      eventSequence: 1
    });

    expect(shouldAcceptRoomEvent(nextCursor, buildEvent({ roomVersion: 4, eventSequence: 99 }))).toBe(false);
    expect(shouldAcceptRoomEvent(nextCursor, buildEvent({ roomVersion: 5, eventSequence: 2 }))).toBe(true);
  });
});
