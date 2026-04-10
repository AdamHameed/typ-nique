"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type {
  GameSessionState,
  MultiplayerGatewayServerEvent,
  MultiplayerRoomCountdownEventPayload,
  MultiplayerRoomFinishedEventPayload,
  MultiplayerRoomPreview,
  MultiplayerRoomSnapshotEventPayload,
  MultiplayerRoomStandingsEventPayload,
  MultiplayerRoomState
} from "@typ-nique/types";
import {
  ApiError,
  encodeGatewayEvent,
  getMultiplayerGatewayUrl,
  getMultiplayerRoomPreview,
  getMultiplayerRoomSnapshot,
  joinMultiplayerRoom,
  leaveMultiplayerRoom,
  resetMultiplayerRoom,
  setMultiplayerReady,
  startMultiplayerCountdown
} from "../lib/api";
import { commitRoomEvent, createInitialRoomEventCursor, shouldAcceptRoomEvent as shouldAcceptCursorEvent } from "../lib/multiplayer-room-sync";

type ConnectionState = "idle" | "connecting" | "live" | "reconnecting" | "offline";
type HydrationState = "loading" | "preview" | "ready" | "error";

const HEARTBEAT_INTERVAL_MS = 15_000;
const RECONNECT_DELAY_MS = 1_500;

export function useMultiplayerRoom(roomCode: string) {
  const normalizedRoomCode = roomCode.trim().toUpperCase();
  const [room, setRoom] = useState<MultiplayerRoomState | null>(null);
  const [preview, setPreview] = useState<MultiplayerRoomPreview | null>(null);
  const [hydratedSessionState, setHydratedSessionState] = useState<GameSessionState | null>(null);
  const [hydrationState, setHydrationState] = useState<HydrationState>("loading");
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);
  const eventCursorRef = useRef(createInitialRoomEventCursor());
  const latestRoomRef = useRef<MultiplayerRoomState | null>(null);

  useEffect(() => {
    latestRoomRef.current = room;
  }, [room]);

  useEffect(() => {
    void hydrateRoom();

    return () => {
      shouldReconnectRef.current = false;
      clearTimers();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [normalizedRoomCode]);

  useEffect(() => {
    if (!room) {
      disconnectSocket();
      return;
    }

    connectSocket();

    return () => {
      disconnectSocket();
    };
  }, [room?.id, normalizedRoomCode]);

  useEffect(() => {
    if (!room?.countdownEndsAt || room.status !== "countdown") {
      return;
    }

    const refreshDelayMs = Math.max(0, new Date(room.countdownEndsAt).getTime() - Date.now()) + 150;
    const timeoutId = window.setTimeout(() => {
      void hydrateRoom();
    }, refreshDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [room?.countdownEndsAt, room?.status]);

  async function hydrateRoom() {
    setError(null);
    setHydrationState("loading");

    const shouldAttemptMemberSnapshot = getRememberedRoomCode() === normalizedRoomCode;

    if (!shouldAttemptMemberSnapshot) {
      try {
        const previewResponse = await getMultiplayerRoomPreview(normalizedRoomCode);
        setPreview(previewResponse.data);
        setRoom(null);
        setHydratedSessionState(null);
        setHydrationState("preview");
        return;
      } catch (previewError) {
        const message = previewError instanceof Error ? previewError.message : "Unable to load room.";
        setError(message);
        setHydrationState("error");
        return;
      }
    }

    try {
      const snapshot = await getMultiplayerRoomSnapshot(normalizedRoomCode);
      eventCursorRef.current = {
        roomId: snapshot.data.id,
        roomVersion: snapshot.data.roomVersion,
        eventSequence: 0
      };
      setRoom(snapshot.data);
      setHydratedSessionState(null);
      setPreview(null);
      setHydrationState("ready");
      rememberRoomCode(normalizedRoomCode);
      return;
    } catch (snapshotError) {
      if (!(snapshotError instanceof ApiError) || snapshotError.status !== 403) {
        if (snapshotError instanceof ApiError && snapshotError.status === 404) {
          setError("That room code does not exist.");
          setHydrationState("error");
          return;
        }
      } else {
        try {
          const previewResponse = await getMultiplayerRoomPreview(normalizedRoomCode);
          setPreview(previewResponse.data);
          setRoom(null);
          setHydratedSessionState(null);
          setHydrationState("preview");
          return;
        } catch (previewError) {
          const message = previewError instanceof Error ? previewError.message : "Unable to load room.";
          setError(message);
          setHydrationState("error");
          return;
        }
      }

      const message = snapshotError instanceof Error ? snapshotError.message : "Unable to load room.";
      setError(message);
      setHydrationState("error");
    }
  }

  function connectSocket() {
    if (typeof window === "undefined") {
      return;
    }

    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    clearTimers();
    setConnectionState(room ? "connecting" : "idle");

    const socket = new WebSocket(getMultiplayerGatewayUrl());
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setConnectionState("connecting");
    });

    socket.addEventListener("message", (event) => {
      handleGatewayMessage(event.data);
    });

    socket.addEventListener("close", () => {
      clearTimers();

      if (!shouldReconnectRef.current || !latestRoomRef.current) {
        setConnectionState("offline");
        return;
      }

      setConnectionState("reconnecting");
      reconnectTimerRef.current = window.setTimeout(() => {
        connectSocket();
      }, RECONNECT_DELAY_MS);
    });

    socket.addEventListener("error", () => {
      setConnectionState("offline");
    });
  }

  function disconnectSocket() {
    clearTimers();

    if (socketRef.current) {
      const socket = socketRef.current;
      socketRef.current = null;
      socket.close();
    }
  }

  function clearTimers() {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (heartbeatTimerRef.current) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }

  function handleGatewayMessage(raw: string) {
    let event: MultiplayerGatewayServerEvent<unknown>;

    try {
      event = JSON.parse(raw) as MultiplayerGatewayServerEvent<unknown>;
    } catch {
      return;
    }

    if (event.type !== "connection.ready" && event.type !== "connection.heartbeat_ack" && !shouldAcceptRoomEvent(event)) {
      return;
    }

    if (event.type !== "connection.ready" && event.type !== "connection.heartbeat_ack") {
      eventCursorRef.current = commitRoomEvent(eventCursorRef.current, event);
    }

    switch (event.type) {
      case "connection.ready":
        setConnectionState("live");
        subscribeToRoom();
        heartbeatTimerRef.current = window.setInterval(() => {
          sendGatewayEvent({ type: "player.heartbeat", payload: {} });
        }, HEARTBEAT_INTERVAL_MS);
        return;

      case "connection.heartbeat_ack":
        setConnectionState("live");
        return;

      case "room.snapshot": {
      const payload = event.payload as MultiplayerRoomSnapshotEventPayload;
        setRoom((current) => ({
          ...payload.room,
          localPlayerId: payload.room.localPlayerId ?? current?.localPlayerId ?? null,
          localSessionId: payload.room.localSessionId ?? current?.localSessionId ?? payload.sessionState?.id ?? null
        }));
        setHydratedSessionState(payload.sessionState ?? null);
        setPreview(null);
        setHydrationState("ready");
        setError(null);
        return;
      }

      case "room.countdown": {
        const payload = event.payload as MultiplayerRoomCountdownEventPayload;
        setRoom((current) =>
          current
            ? {
                ...current,
                roomVersion: event.roomVersion,
                status: "countdown",
                countdownEndsAt: payload.countdownEndsAt,
                countdownRemainingMs: payload.countdownRemainingMs,
                raceStartsAt: payload.raceStartsAt,
                startedRoundIndex: payload.startedRoundIndex,
                isLocked: payload.isLocked
              }
            : current
        );
        return;
      }

      case "room.standings": {
        const payload = event.payload as MultiplayerRoomStandingsEventPayload;
        setRoom((current) =>
          current
            ? {
                ...current,
                roomVersion: event.roomVersion,
                standings: payload.standings,
                finalPlacements:
                  current.status === "completed"
                    ? payload.standings.filter((entry) => entry.finalPlace !== null)
                    : current.finalPlacements
              }
            : current
        );
        return;
      }

      case "room.finished": {
        const payload = event.payload as MultiplayerRoomFinishedEventPayload;
        setRoom((current) =>
          current
            ? {
                ...current,
                roomVersion: event.roomVersion,
                status: "completed",
                endedAt: payload.finishedAt,
                finalPlacements: payload.placements
              }
            : current
        );
        return;
      }

      case "room.left":
        eventCursorRef.current = createInitialRoomEventCursor();
        clearRememberedRoomCode(normalizedRoomCode);
        setRoom(null);
        setHydratedSessionState(null);
        setPreview(null);
        setHydrationState("preview");
        return;

      case "room.error": {
        const payload = event.payload as { message?: string };
        setError(payload.message ?? "Multiplayer connection error.");
        return;
      }
    }
  }

  function subscribeToRoom() {
    sendGatewayEvent({
      type: "room.subscribe",
      roomVersion: latestRoomRef.current ? eventCursorRef.current.roomVersion : undefined,
      payload: {
        roomCode: normalizedRoomCode
      }
    });
  }

  function sendGatewayEvent(event: { type: string; roomVersion?: number; payload?: Record<string, unknown> }) {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      encodeGatewayEvent({
        type: event.type as never,
        roomVersion: event.roomVersion ?? (latestRoomRef.current ? eventCursorRef.current.roomVersion : undefined),
        payload: event.payload ?? {}
      })
    );
  }

  function join() {
    startTransition(async () => {
      setError(null);

      try {
        const response = await joinMultiplayerRoom(normalizedRoomCode);
        rememberRoomCode(normalizedRoomCode);
        eventCursorRef.current = {
          roomId: response.data.id,
          roomVersion: response.data.roomVersion,
          eventSequence: 0
        };
        setRoom(response.data);
        setHydratedSessionState(null);
        setPreview(null);
        setHydrationState("ready");
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : "Unable to join room.");
      }
    });
  }

  function leave() {
    const currentRoom = latestRoomRef.current;

    if (!currentRoom) {
      return;
    }

    startTransition(async () => {
      try {
        await leaveMultiplayerRoom(currentRoom.id);
        clearRememberedRoomCode(normalizedRoomCode);
        eventCursorRef.current = createInitialRoomEventCursor();
        setPreview(null);
        setRoom(null);
        setHydratedSessionState(null);
        setHydrationState("loading");
        disconnectSocket();
        window.location.assign("/multiplayer");
      } catch (leaveError) {
        setError(leaveError instanceof Error ? leaveError.message : "Unable to leave room.");
      }
    });
  }

  function resetToLobby() {
    const currentRoom = latestRoomRef.current;

    if (!currentRoom) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await resetMultiplayerRoom(currentRoom.id);
        eventCursorRef.current = {
          roomId: response.data.id,
          roomVersion: response.data.roomVersion,
          eventSequence: 0
        };
        setRoom(response.data);
        setHydratedSessionState(null);
        setPreview(null);
        setHydrationState("ready");
        setError(null);
      } catch (resetError) {
        setError(resetError instanceof Error ? resetError.message : "Unable to reopen the lobby.");
      }
    });
  }

  function toggleReady(ready: boolean) {
    const currentRoom = latestRoomRef.current;

    if (!currentRoom) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await setMultiplayerReady(currentRoom.id, ready);
        eventCursorRef.current = {
          roomId: response.data.id,
          roomVersion: response.data.roomVersion,
          eventSequence: 0
        };
        setRoom(response.data);
      } catch (readyError) {
        setError(readyError instanceof Error ? readyError.message : "Unable to update readiness.");
      }
    });
  }

  function startCountdown() {
    const currentRoom = latestRoomRef.current;

    if (!currentRoom) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await startMultiplayerCountdown(currentRoom.id);
        eventCursorRef.current = {
          roomId: response.data.id,
          roomVersion: response.data.roomVersion,
          eventSequence: 0
        };
        setRoom(response.data);
      } catch (countdownError) {
        setError(countdownError instanceof Error ? countdownError.message : "Unable to start countdown.");
      }
    });
  }

  return {
    room,
    preview,
    hydratedSessionState,
    hydrationState,
    connectionState,
    error,
    isPending,
    join,
    leave,
    resetToLobby,
    toggleReady,
    startCountdown,
    refresh: hydrateRoom
  };

  function shouldAcceptRoomEvent(event: MultiplayerGatewayServerEvent<unknown>) {
    return shouldAcceptCursorEvent(eventCursorRef.current, event);
  }
}

function getRememberedRoomCode() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("typ-nique:last-multiplayer-room");
}

function rememberRoomCode(roomCode: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("typ-nique:last-multiplayer-room", roomCode);
}

function clearRememberedRoomCode(roomCode?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const remembered = window.localStorage.getItem("typ-nique:last-multiplayer-room");

  if (!roomCode || remembered === roomCode) {
    window.localStorage.removeItem("typ-nique:last-multiplayer-room");
  }
}
