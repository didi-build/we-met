/**
 * Cloudflare account API for D1/R2 provision (create-if-missing, exact-name lookup).
 * Uses fetch against api.cloudflare.com so CI does not depend on wrangler --json on create/list.
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * @typedef {object} CloudflareApiClient
 * @property {(name: string) => Promise<{ name: string, uuid: string } | null>} getD1Database
 * @property {(name: string) => Promise<boolean>} r2BucketExists
 * @property {(name: string) => Promise<{ name: string, uuid: string }>} createD1Database
 * @property {(name: string) => Promise<void>} createR2Bucket
 */

/**
 * @param {unknown} body
 */
export function parseCloudflareJsonBody(body, label) {
  if (typeof body !== "string" || !body.trim()) {
    throw new Error(`Cloudflare API ${label} returned empty body`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Cloudflare API ${label} returned unparseable JSON`);
  }
}

/**
 * @param {unknown} payload
 */
export function extractD1Row(payload) {
  if (!payload || typeof payload !== "object") return null;
  const row = payload;
  const name = typeof row.name === "string" ? row.name : null;
  const uuid =
    typeof row.uuid === "string"
      ? row.uuid
      : typeof row.database_id === "string"
        ? row.database_id
        : typeof row.id === "string"
          ? row.id
          : null;
  if (!name || !uuid) return null;
  return { name, uuid };
}

/**
 * @param {number} status
 * @param {unknown[]} errors
 */
export function isCloudflareNotFound(status) {
  return status === 404;
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {{ accountId: string, apiToken: string }} config
 * @returns {CloudflareApiClient}
 */
export function createCloudflareProvisionClient(fetchImpl, config) {
  const { accountId, apiToken } = config;
  if (!accountId?.trim()) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
  }
  if (!apiToken?.trim()) {
    throw new Error("CLOUDFLARE_API_TOKEN is required");
  }

  async function request(method, path, body) {
    const label = `${method} ${path}`;
    const response = await fetchImpl(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = parseCloudflareJsonBody(text, label);
    if (!data.success) {
      const errors = data.errors ?? [];
      if (isCloudflareNotFound(response.status)) {
        const err = new Error(`Cloudflare API ${label}: not found`);
        err.isNotFound = true;
        throw err;
      }
      const message =
        errors
          .map((e) => e?.message)
          .filter(Boolean)
          .join("; ") || `HTTP ${response.status}`;
      throw new Error(`Cloudflare API ${label} failed: ${message}`);
    }
    if (data.result === undefined || data.result === null) {
      throw new Error(`Cloudflare API ${label} returned no result`);
    }
    return data.result;
  }

  return {
    async getD1Database(name) {
      try {
        const result = await request(
          "GET",
          `/accounts/${accountId}/d1/database?name=${encodeURIComponent(name)}`,
        );
        if (!Array.isArray(result)) {
          throw new Error(
            `Cloudflare API D1 list for ${name} returned non-array result`,
          );
        }
        const matches = [];
        for (const item of result) {
          const row = extractD1Row(item);
          if (!row) {
            throw new Error(`Cloudflare API D1 list returned unexpected shape`);
          }
          if (row.name === name) matches.push(row);
        }
        if (matches.length === 0) return null;
        if (matches.length > 1) {
          throw new Error(
            `Cloudflare API D1 list for ${name} matched more than one database`,
          );
        }
        return matches[0];
      } catch (err) {
        if (err.isNotFound) return null;
        throw err;
      }
    },
    async r2BucketExists(name) {
      try {
        await request(
          "GET",
          `/accounts/${accountId}/r2/buckets/${encodeURIComponent(name)}`,
        );
        return true;
      } catch (err) {
        if (err.isNotFound) return false;
        throw err;
      }
    },
    async createD1Database(name) {
      const result = await request("POST", `/accounts/${accountId}/d1/database`, {
        name,
      });
      const row = extractD1Row(result);
      if (!row) {
        throw new Error(`Cloudflare API D1 create ${name} returned unexpected shape`);
      }
      return row;
    },
    async createR2Bucket(name) {
      await request("POST", `/accounts/${accountId}/r2/buckets`, { name });
    },
  };
}
