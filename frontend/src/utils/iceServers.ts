/**
 * Shared ICE server configuration for WebRTC connections.
 *
 * Reads ICE servers from `VITE_ICE_SERVERS` (JSON array). If the env
 * var is unset or invalid, falls back to Google's public STUN server
 * so existing behavior is unchanged.
 *
 * Example env value:
 * VITE_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]
 */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export function getIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined;
  if (!raw) return DEFAULT_ICE_SERVERS;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as RTCIceServer[];
    }
  } catch {
    console.warn(
      "Invalid VITE_ICE_SERVERS value — falling back to default STUN"
    );
  }

  return DEFAULT_ICE_SERVERS;
}