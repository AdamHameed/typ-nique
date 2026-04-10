import { timingSafeEqual } from "node:crypto";

export function matchesSecret(candidate: string, secret: string) {
  const candidateBuffer = Buffer.from(candidate);
  const secretBuffer = Buffer.from(secret);

  if (candidateBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, secretBuffer);
}
