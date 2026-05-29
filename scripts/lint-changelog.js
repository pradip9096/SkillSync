const fs = require('fs');
const path = require('path');

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

if (!fs.existsSync(changelogPath)) {
  console.log('No CHANGELOG.md found. Skipping lint.');
  process.exit(0);
}

const changelog = fs.readFileSync(changelogPath, 'utf8');
const validCategories = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

// Find the [Unreleased] section (everything between ## [Unreleased] and the next ## [Version])
const unreleasedMatch = changelog.match(/## \[Unreleased\]([\s\S]*?)## \[\d+\.\d+\.\d+\]/);

if (unreleasedMatch) {
  const unreleasedSection = unreleasedMatch[1];
  const categoryRegex = /### (.+)/g;
  let match;
  
  while ((match = categoryRegex.exec(unreleasedSection)) !== null) {
    const category = match[1].trim();
    if (!validCategories.includes(category)) {
      console.error(`\n❌ Error: Invalid category '### ${category}' found under ## [Unreleased] in CHANGELOG.md.`);
      console.error(`Only the standard Keep a Changelog categories are allowed: ${validCategories.join(', ')}\n`);
      process.exit(1);
    }
  }
}

console.log("✅ CHANGELOG.md validation passed.");
process.exit(0);
