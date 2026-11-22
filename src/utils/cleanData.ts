function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively removes `undefined` values from plain objects and arrays before
 * writing to Cloud Firestore, while preserving `null`, primitives, Dates, and
 * Firestore FieldValue sentinels (e.g. `increment`, `arrayRemove`).
 */
export function cleanData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => cleanData(item)) as unknown as T;
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) {
        out[key] = cleanData(val);
      }
    }
    return out as T;
  }

  return value;
}
