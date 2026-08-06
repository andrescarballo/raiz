// Persistence backend.
//
// The prototype was written against a host-provided `window.storage`, which does
// not exist in a plain browser. This keeps that async shape — callers already
// await it — but backs it with localStorage so the game saves anywhere.
//
// `get` resolves to `{ value }` or null, never throws: a corrupt or blocked
// store (private mode, quota) must degrade to "no save", not to a broken game.

const available = (() => {
  try {
    const k = '__raiz_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

const memory = new Map();

export const storage = {
  async get(key) {
    if (!available) return memory.has(key) ? { value: memory.get(key) } : null;
    const value = localStorage.getItem(key);
    return value === null ? null : { value };
  },

  async set(key, value) {
    if (!available) { memory.set(key, String(value)); return; }
    localStorage.setItem(key, String(value));
  },

  async delete(key) {
    if (!available) { memory.delete(key); return; }
    localStorage.removeItem(key);
  }
};
