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
  "test/fixtures/theme-colors",
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

const TAILWIND_COLOR_UTILITY = new RegExp(
  `(?:^|[\\s"'\\\`])((?:bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|divide|caret|accent)-(?:${TAILWIND_PALETTE})(?:-(?:\\d{2,3}|950))?)(?=[\\s"'\\\`]|$)`,
  "g",
);

const ALLOWED_TAILWIND_TOKEN =
  /^(?:bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|divide|caret|accent)-(?:bg|surface|surface-2|ink|ink-muted|line|line-strong|accent|accent-hover|accent-ink|accent-soft|accent-text|error|error-soft)(?:\/\d+)?$/;

const CSS_COLOR_PROPERTIES =
  /(?:^|[;{])\s*(?:color|background|background-color|border-color|outline-color|fill|stroke|caret-color|text-decoration-color|box-shadow|filter)\s*:\s*([^;}{]+)/gi;

function isAllowlisted(rel) {
  return ALLOWLIST.has(rel);
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
  let match;
  while ((match = CSS_COLOR_PROPERTIES.exec(text)) !== null) {
    const value = match[1].trim().toLowerCase();
    if (
      value === "transparent" ||
      value === "currentcolor" ||
      value === "inherit" ||
      value === "none"
    ) {
      continue;
    }
    if (value.startsWith("var(")) {
      continue;
    }
    const tokens = value.split(/[\s,/]+/);
    for (const token of tokens) {
      const bare = token.replace(/!important$/, "");
      if (NAMED_CSS_COLORS.has(bare)) {
        return true;
      }
    }
  }
  return false;
}

function scanTailwindUtilities(text) {
  let match;
  while ((match = TAILWIND_COLOR_UTILITY.exec(text)) !== null) {
    const utility = match[1];
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
  const styleProp =
    /(?:color|backgroundColor|borderColor|outlineColor|fill|stroke)\s*:\s*["'`]([^"'`]+)["'`]/gi;
  let match;
  while ((match = styleProp.exec(text)) !== null) {
    const value = match[1].trim().toLowerCase();
    if (
      value === "transparent" ||
      value === "currentcolor" ||
      value === "inherit" ||
      value === "none"
    ) {
      continue;
    }
    if (value.startsWith("var(")) {
      continue;
    }
    if (NAMED_CSS_COLORS.has(value)) {
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
  }
  return reasons;
}

export { ALLOWLIST, SKIP_DIRS };
