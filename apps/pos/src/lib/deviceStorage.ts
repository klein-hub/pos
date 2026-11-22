/**
 * A small synchronous key-value store that survives a reload. On web this is
 * localStorage; where none exists (native, private mode, blocked storage) it
 * falls back to memory, so callers never have to care whether it persisted.
 */
const memory = new Map<string, string>();

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = storage()?.getItem(key) ?? memory.get(key) ?? null;
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    storage()?.setItem(key, raw);
  } catch {
    // Quota or blocked storage: the in-memory copy still serves this session.
  }
}

export function removeKey(key: string): void {
  memory.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing to do.
  }
}
