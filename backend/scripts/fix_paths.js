const fs = require('fs');
const path = require('path');

function replaceInDir(dir, replacements) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath, replacements);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            for (const [from, to] of replacements) {
                if (content.includes(from)) {
                    content = content.split(from).join(to);
                    modified = true;
                }
            }
            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

// Fix unit tests: ../../../src/ -> ../../../
replaceInDir(path.join(__dirname, '../src/__tests__/unit'), [
    ['../../../src/', '../../../']
]);

// Fix integration tests: ../../ -> ../../../src/ (for specific src folders)
// Let's be precise to avoid breaking external modules.
const srcFolders = ['app', 'models', 'controllers', 'services', 'middleware', 'utils', 'config'];
const integrationReplacements = srcFolders.map(folder => [`../../${folder}`, `../../../src/${folder}`]);
integrationReplacements.push(['../../app.js', '../../../src/app.js']);

replaceInDir(path.join(__dirname, '../tests/integration/phase-tests'), integrationReplacements);

console.log("Done fixing paths.");
