/**
 * @param {string} content
 * @returns {Record<string, string>[]}
 */
export function extractWorkflowPermissionsMaps(content) {
  /** @type {Record<string, string>[]} */
  const maps = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const blockMatch = /^\s*permissions:\s*$/.exec(line);
    if (!blockMatch) {
      continue;
    }
    const blockIndent = line.match(/^\s*/)?.[0].length ?? 0;
    /** @type {Record<string, string>} */
    const map = {};
    for (let j = i + 1; j < lines.length; j++) {
      const inner = lines[j];
      const trimmed = inner.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const indent = inner.match(/^\s*/)?.[0].length ?? 0;
      if (indent <= blockIndent) {
        break;
      }
      const kv = /^\s+([a-z0-9-]+):\s*([^\s#]+)\s*$/i.exec(inner);
      if (kv) {
        map[kv[1].toLowerCase()] = kv[2].toLowerCase();
      }
    }
    if (Object.keys(map).length > 0) {
      maps.push(map);
    }
  }

  return maps;
}

/**
 * @param {Record<string, string>} map
 * @param {Record<string, string>} expected
 */
export function permissionsMapEquals(map, expected) {
  const keys = Object.keys(expected);
  if (Object.keys(map).length !== keys.length) {
    return false;
  }
  for (const key of keys) {
    if (map[key] !== expected[key]) {
      return false;
    }
  }
  return true;
}
