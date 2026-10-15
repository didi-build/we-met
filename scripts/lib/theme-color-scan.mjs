const ALLOWLIST = new Set([
  "src/theme/tokens/green.light.css",
  "src/theme/tokens/green.dark.css",
  "design/Hi.dc.html",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".open-next",
  "dist",
  "coverage",
  "test-results",
  "design",
]);

const CSS_LITERAL_PATTERNS = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\brgb\s*\(/i,
  /\brgba\s*\(/i,
  /\bhsl\s*\(/i,
  /\bhsla\s*\(/i,
  /\boklch\s*\(/i,
  /\boklab\s*\(/i,
];

const NAMED_CSS_COLORS = new Set([
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
]);

const TAILWIND_PALETTE =
  "white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const TAILWIND_UTILITY_NAMES =
  "bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|divide|caret|accent";

const ALLOWED_TAILWIND_TOKEN =
  /^(?:bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|divide|caret|accent)-(?:bg|surface|surface-2|ink|ink-muted|line|line-strong|accent|accent-hover|accent-ink|accent-soft|accent-text|error|error-soft)(?:\/\d{1,3})?$/;

const CSS_COLOR_PROPERTY_NAMES = [
  "color",
  "background",
  "background-color",
  "background-image",
  "border",
  "outline",
  "fill",
  "stroke",
  "caret-color",
  "accent-color",
  "text-decoration",
  "text-decoration-color",
  "text-shadow",
  "box-shadow",
  "filter",
  "column-rule",
  "scrollbar-color",
].join("|");

const CSS_COLOR_PROPERTY_EXTRA =
  "border(?:-(?:top|right|bottom|left))?(?:-(?:color|width|style))?|border-(?:block|inline)(?:-(?:start|end))?(?:-(?:color|width|style))?|outline(?:-(?:color|width|style|offset))?";

const CSS_DECLARATION_PROPERTY = `(?:${CSS_COLOR_PROPERTY_NAMES}|${CSS_COLOR_PROPERTY_EXTRA})`;

const INLINE_STYLE_PROPERTY =
  "(?:color|background(?:Color|Image)?|border(?:Top|Right|Bottom|Left|Block|Inline|Start|End)?(?:Color|Width|Style)?|outline(?:Color|Width|Style|Offset)?|fill|stroke|caretColor|accentColor|textDecoration(?:Color)?|textShadow|boxShadow|filter|columnRule|scrollbarColor)";

function isAllowlisted(rel) {
  if (ALLOWLIST.has(rel)) {
    return true;
  }
  if (rel.startsWith("src/theme/tokens/") && rel.endsWith(".css")) {
    return true;
  }
  if (rel === "scripts/generate-card-palette-css.mjs") {
    return true;
  }
  return false;
}

const TAILWIND_VARIANT_PREFIX = "(?:(?:[\\w-]+|\\[[^\\]]+\\]|data-\\[[^\\]]+\\]):)*";

function tailwindColorUtilityRegex() {
  return new RegExp(
    `(?:^|[\\s"'\\\`])((?:${TAILWIND_VARIANT_PREFIX}!?)(?:${TAILWIND_UTILITY_NAMES})-(?:${TAILWIND_PALETTE})(?:-(?:\\d{2,3}|950))?(?:\\/\\d{1,3})?!?)(?=[\\s"'\\\`]|$)`,
    "g",
  );
}

function cssDeclarationRegex() {
  return new RegExp(
    `(?:^|[;{}\\n])\\s*(?:/\\*[^*]*(?:\\*(?!/)[^*]*)*\\*/\\s*)*(${CSS_DECLARATION_PROPERTY})\\s*:\\s*([^;}]*)`,
    "gi",
  );
}

function inlineStyleRegex() {
  return new RegExp(`${INLINE_STYLE_PROPERTY}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`, "gi");
}

function normalizeTailwindUtility(className) {
  let utility = className;
  const lastColon = utility.lastIndexOf(":");
  if (lastColon !== -1) {
    utility = utility.slice(lastColon + 1);
  }
  if (utility.startsWith("!")) {
    utility = utility.slice(1);
  }
  if (utility.endsWith("!")) {
    utility = utility.slice(0, -1);
  }
  return utility;
}

function isAllowedCssColorValue(value) {
  const trimmed = value.trim().toLowerCase();
  return (
    trimmed === "transparent" ||
    trimmed === "currentcolor" ||
    trimmed === "inherit" ||
    trimmed === "none"
  );
}

function stripVarFunctions(value) {
  let result = "";
  let i = 0;
  while (i < value.length) {
    const rest = value.slice(i);
    const varMatch = rest.match(/^var\s*\(/i);
    if (varMatch) {
      i += varMatch[0].length;
      let depth = 1;
      while (i < value.length && depth > 0) {
        const ch = value[i];
        if (ch === "(") {
          depth += 1;
        } else if (ch === ")") {
          depth -= 1;
        }
        i += 1;
      }
      result += " ";
      continue;
    }
    result += value[i];
    i += 1;
  }
  return result;
}

function valueContainsOffendingColor(value) {
  if (isAllowedCssColorValue(value)) {
    return false;
  }
  const withoutVar = stripVarFunctions(value);
  const trimmed = withoutVar.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (isAllowedCssColorValue(trimmed)) {
    return false;
  }
  const lower = withoutVar.toLowerCase();
  if (scanCssLiterals(lower)) {
    return true;
  }
  return tokenListContainsNamed(lower);
}

function valueContainsNamedColor(value) {
  return valueContainsOffendingColor(value);
}

function tokenListContainsNamed(lower) {
  for (const name of NAMED_CSS_COLORS) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(lower)) {
      return true;
    }
  }
  return false;
}

function scanCssLiterals(text) {
  for (const pattern of CSS_LITERAL_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function scanCssNamedColors(text) {
  const re = cssDeclarationRegex();
  for (const match of text.matchAll(re)) {
    const value = match[2];
    if (valueContainsNamedColor(value)) {
      return true;
    }
  }
  return false;
}

function scanTailwindUtilities(text) {
  const re = tailwindColorUtilityRegex();
  for (const match of text.matchAll(re)) {
    const utility = normalizeTailwindUtility(match[1]);
    if (ALLOWED_TAILWIND_TOKEN.test(utility)) {
      continue;
    }
    if (utility.endsWith("-transparent")) {
      continue;
    }
    return true;
  }
  return false;
}

function scanTsLiterals(text) {
  for (const pattern of CSS_LITERAL_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function scanInlineStyleNamedColors(text) {
  const re = inlineStyleRegex();
  for (const match of text.matchAll(re)) {
    if (valueContainsOffendingColor(match[1])) {
      return true;
    }
  }
  return false;
}

const JSX_COLOR_ATTR = "(?:fill|stroke|stopColor|floodColor|lightingColor|color)";

function jsxColorAttrRegex() {
  return new RegExp(`${JSX_COLOR_ATTR}=["']([^"']+)["']`, "gi");
}

function isAllowedJsxAttrColorValue(value) {
  const trimmed = value.trim().toLowerCase();
  return (
    trimmed === "currentcolor" ||
    trimmed === "none" ||
    trimmed === "transparent" ||
    trimmed === "inherit"
  );
}

function scanJsxColorAttributes(text) {
  const re = jsxColorAttrRegex();
  for (const match of text.matchAll(re)) {
    const raw = match[1];
    if (isAllowedJsxAttrColorValue(raw)) {
      continue;
    }
    if (valueContainsOffendingColor(raw)) {
      return true;
    }
  }
  return false;
}

export function scanFileContent(rel, text, ext) {
  if (isAllowlisted(rel)) {
    return [];
  }
  const reasons = [];
  if (ext === ".css") {
    if (scanCssLiterals(text)) {
      reasons.push("css-literal");
    }
    if (scanCssNamedColors(text)) {
      reasons.push("css-named");
    }
  }
  if (ext === ".ts" || ext === ".tsx" || ext === ".mjs") {
    if (scanTsLiterals(text)) {
      reasons.push("ts-literal");
    }
    if (scanTailwindUtilities(text)) {
      reasons.push("tailwind-palette");
    }
    if (scanInlineStyleNamedColors(text)) {
      reasons.push("inline-named");
    }
    if (scanJsxColorAttributes(text)) {
      reasons.push("jsx-attr");
    }
  }
  return reasons;
}

export { ALLOWLIST, SKIP_DIRS };
