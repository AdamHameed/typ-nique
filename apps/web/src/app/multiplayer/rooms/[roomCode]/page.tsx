import { MultiplayerRoomClient } from "../../../../components/multiplayer-room-client";
import { SiteShell } from "../../../../components/site-shell";

export default async function MultiplayerRoomPage({
  params
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const resolvedParams = await params;

  return (
    <SiteShell>
      <MultiplayerRoomClient roomCode={resolvedParams.roomCode} />
    </SiteShell>
  );
}
