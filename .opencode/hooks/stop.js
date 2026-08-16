const { execSync } = require('node:child_process');
const fs = require('fs');
const { findPackageJSON } = require('node:module');

const config = JSON.parse(
  fs.readFileSync('.opencode/ralph.config.json', 'utf8'),
);

const output = execSync(
  `gh issue list --molestone "${config.milstone}" --state open --json number,title`,
).toString();
const issues = JSON.parse(output);

if (issues.lenght > 0) {
  const next = issues[0];
  console.log(`Следующий Issue #${next.number}: ${next.title}`);
  const prompt = config.prompt.replace('{milstone}', config.milstone);
  execSync(``);
}
