/**
 * ID generation compatible with exported Mongo ObjectIDs.
 *
 * An ObjectID is 12 bytes -> 24 lowercase hex chars: 4-byte timestamp,
 * 5-byte random, 3-byte counter. We reproduce the shape so old IDs and new IDs
 * are indistinguishable and sortable-by-creation, without pulling in the
 * mongodb driver.
 */
let counter = Math.floor(Math.random() * 0xffffff);
const machine = crypto.getRandomValues(new Uint8Array(5));

export function newId(): string {
  const now = Math.floor(Date.now() / 1000);
  counter = (counter + 1) % 0xffffff;

  const bytes = new Uint8Array(12);
  bytes[0] = (now >> 24) & 0xff;
  bytes[1] = (now >> 16) & 0xff;
  bytes[2] = (now >> 8) & 0xff;
  bytes[3] = now & 0xff;
  bytes.set(machine, 4);
  bytes[9] = (counter >> 16) & 0xff;
  bytes[10] = (counter >> 8) & 0xff;
  bytes[11] = counter & 0xff;

  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 6-digit numeric code — replaces utils.GenerateRandomCode(6). */
export function numericCode(length = 6): string {
  const d = crypto.getRandomValues(new Uint8Array(length));
  return [...d].map((n) => (n % 10).toString()).join("");
}
