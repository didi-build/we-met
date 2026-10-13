/**
 * @param {string} content
 * @returns {number}
 */
export function longestBacktickRun(content) {
  let max = 0;
  let run = 0;
  for (const ch of content) {
    if (ch === "`") {
      run += 1;
      if (run > max) {
        max = run;
      }
    } else {
      run = 0;
    }
  }
  return max;
}

/**
 * Markdown code fence long enough that content cannot close it early.
 *
 * @param {string} content
 * @param {string} [language]
 * @returns {string}
 */
export function formatMarkdownCodeFence(content, language = "") {
  const tickCount = Math.max(3, longestBacktickRun(content) + 1);
  const fence = "`".repeat(tickCount);
  const langSuffix = language ? language : "";
  return `${fence}${langSuffix}\n${content}\n${fence}\n`;
}
