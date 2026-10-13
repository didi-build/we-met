const USES_RE = /^\s*(?:-\s+)?uses:\s+([^@\s]+)@/gm;
const SECRET_RE = /secrets\.([A-Z0-9_]+)/g;
const SECRET_EXPR_RE = /\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/g;
const ENV_LINE_RE = /^\s*environment:\s*([^\s#]+)\s*$/gm;
const ON_BLOCK_TRIGGER_RE =
  /^\s{0,2}(pull_request_target|pull_request|push|workflow_dispatch|workflow_call|schedule|repository_dispatch|release|issues|issue_comment|discussion|discussion_comment|workflow_run|registry_package|watch|fork|create|delete|pull_request_review|pull_request_review_comment|check_run|check_suite|status|deployment|deployment_status|public|label|milestone|project|project_card|project_column|package|page_build|member|team_add|star|gollum|commit_comment|merge_group)(?:\s*:|$)/gm;

const PRIVILEGED_ENVIRONMENTS = new Set(["production", "migrate-nonprod"]);
const CLOUDFLARE_TOKEN_SECRET_RE = /CLOUDFLARE_API_TOKEN_[A-Z0-9_]+/g;

/**
 * @param {string} usesValue e.g. actions/checkout or didi-build/foo/bar
 * @returns {string | null} owner segment, or null for local ./ paths
 */
export function parseUsesOwner(usesValue) {
  const trimmed = usesValue.trim();
  if (trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return null;
  }
  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    return trimmed;
  }
  return trimmed.slice(0, slash);
}

/**
 * @param {string} content
 * @returns {{
 *   environments: string[];
 *   secrets: string[];
 *   triggers: string[];
 *   permissionKeys: string[];
 *   usesOwners: string[];
 * }}
 */
export function extractWorkflowMetadata(content) {
  const environments = new Set();
  const secrets = new Set();
  const triggers = new Set();
  const permissionKeys = new Set();
  const usesOwners = new Set();

  for (const match of content.matchAll(USES_RE)) {
    const owner = parseUsesOwner(match[1]);
    if (owner) {
      usesOwners.add(owner);
    }
  }

  for (const match of content.matchAll(SECRET_RE)) {
    secrets.add(match[1]);
  }
  for (const match of content.matchAll(SECRET_EXPR_RE)) {
    secrets.add(match[1]);
  }

  for (const match of content.matchAll(ENV_LINE_RE)) {
    const value = match[1].trim();
    if (!value.startsWith("${{")) {
      environments.add(value);
    }
  }

  const lines = content.split("\n");
  let inPermissions = false;
  let permissionsIndent = 0;
  let inEnvironmentBlock = false;
  let environmentIndent = 0;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (/^\s*permissions:\s*$/.test(line)) {
      inPermissions = true;
      permissionsIndent = line.match(/^\s*/)?.[0].length ?? 0;
      continue;
    }
    if (inPermissions) {
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (trimmed && indent <= permissionsIndent) {
        inPermissions = false;
      } else {
        const keyMatch = /^\s+([a-z-]+):/.exec(line);
        if (keyMatch) {
          permissionKeys.add(keyMatch[1]);
        }
      }
    }

    if (/^\s*environment:\s*$/.test(line)) {
      inEnvironmentBlock = true;
      environmentIndent = line.match(/^\s*/)?.[0].length ?? 0;
      continue;
    }
    if (inEnvironmentBlock) {
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (trimmed && indent <= environmentIndent) {
        inEnvironmentBlock = false;
      } else {
        const nameMatch = /^\s+name:\s*([^\s#${}]+)/.exec(line);
        if (nameMatch) {
          environments.add(nameMatch[1].trim());
        }
      }
    }
  }

  for (const match of content.matchAll(ON_BLOCK_TRIGGER_RE)) {
    triggers.add(match[1]);
  }

  return {
    environments: [...environments].sort(),
    secrets: [...secrets].sort(),
    triggers: [...triggers].sort(),
    permissionKeys: [...permissionKeys].sort(),
    usesOwners: [...usesOwners].sort(),
  };
}

/**
 * @param {string} content
 * @returns {string[]}
 */
export function findHighSeverityContentSignals(content) {
  const signals = [];
  if (/\bpull_request_target\b/.test(content)) {
    signals.push("trigger: pull_request_target");
  }
  for (const env of PRIVILEGED_ENVIRONMENTS) {
    if (new RegExp(`\\b${env}\\b`).test(content)) {
      signals.push(`environment reference: ${env}`);
    }
  }
  for (const match of content.matchAll(CLOUDFLARE_TOKEN_SECRET_RE)) {
    signals.push(`secret name: ${match[0]}`);
  }
  return [...new Set(signals)].sort();
}

/**
 * @param {string[]} usesOwners
 * @param {string} trustedOrg
 * @returns {string[]}
 */
export function findUntrustedUsesOwners(usesOwners, trustedOrg) {
  const allowed = new Set(["actions", trustedOrg]);
  return usesOwners.filter((owner) => !allowed.has(owner));
}
