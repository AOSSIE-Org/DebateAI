// dangerfile.js — enforces the PR description template
// Docs: https://danger.systems/js/
const body = danger.github.pr.body || "";
const normalizedBody = body.replace(/\r\n/g, "\n");

const issues = [];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasCheckedChecklistItem(itemText) {
  const escapedItem = escapeRegex(itemText).replace(/\s+/g, "\\s+");
  const checkedItemPattern = new RegExp(`-\\s*\\[[xX]\\]\\s*${escapedItem}`, "i");
  return checkedItemPattern.test(normalizedBody);
}

// ---------------------------------------------------------------------------
// 1. Required section headings (tolerant to spacing and casing)
// ---------------------------------------------------------------------------
const requiredSections = [
  {
    label: "### Addressed Issues:",
    pattern: /#{3}\s+addressed\s+issues:/i,
  },
  {
    label: "## Checklist",
    pattern: /#{2}\s+checklist/i,
  },
];

const missingSections = requiredSections
  .filter((section) => !section.pattern.test(normalizedBody))
  .map((section) => section.label);

if (!normalizedBody.trim()) {
  fail("PR description is empty. Please follow the PR template.");
}

if (missingSections.length > 0) {
  issues.push(
    `**PR description is missing required sections:**\n` +
      missingSections.map((s) => `- \`${s}\``).join("\n") +
      `\n\nPlease follow the [PR template](.github/PULL_REQUEST_TEMPLATE.md).`
  );
}

// ---------------------------------------------------------------------------
// 2. Issue link — warn on placeholder and missing issue reference
// ---------------------------------------------------------------------------
if (/\bfixes\s*#\s*\(\s*issue\s*number\s*\)/i.test(normalizedBody)) {
  issues.push(
    "Please replace the placeholder `Fixes #(issue number)` with the actual " +
      "issue number (e.g. `Fixes #42`)."
  );
} else if (!/\b(fixes|closes|resolves)\s*#\d+\b/i.test(normalizedBody)) {
  issues.push(
    "No issue linked. Consider adding `Fixes #<number>` (e.g. `Fixes #42`) " +
      "under the **Addressed Issues** section."
  );
}

// ---------------------------------------------------------------------------
// 3. Checklist — required items must be checked
// ---------------------------------------------------------------------------
const requiredChecklistItems = [
  "My PR addresses a single issue",
  "My code follows the project's code style",
  "My changes generate no new warnings or errors",
];

const missingRequired = requiredChecklistItems.filter(
  (item) => !hasCheckedChecklistItem(item)
);

if (missingRequired.length > 0) {
  issues.push(
    "Some required checklist items are not completed:\n" +
      missingRequired.map((item) => `- ${item}`).join("\n")
  );
}

if (issues.length > 0) {
  message(`
### ⚠️ PR Template Check

These are non-blocking, but please fix:

${issues.map((issue) => `- ${issue}`).join("\n")}
  `);
}
