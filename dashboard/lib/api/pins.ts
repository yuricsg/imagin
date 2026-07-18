const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window !== "undefined" ? "" : "http://localhost:4000");

function parseCommandIds(data: unknown): string[] {
  const ids = (data as { commandIds?: unknown })?.commandIds;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string")
    : [];
}

/** Reads the operator's pinned command ids from the backend. */
export async function fetchPinnedCommands(email: string): Promise<string[]> {
  const res = await fetch(
    `${API_BASE}/api/users/pinned-commands?email=${encodeURIComponent(email)}`,
  );
  if (!res.ok) throw new Error(`GET pinned-commands ${res.status}`);
  return parseCommandIds(await res.json());
}

/** Persists the operator's pinned command ids, returning the saved order. */
export async function savePinnedCommands(
  email: string,
  commandIds: string[],
): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/users/pinned-commands`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, commandIds }),
  });
  if (!res.ok) throw new Error(`PUT pinned-commands ${res.status}`);
  return parseCommandIds(await res.json());
}
