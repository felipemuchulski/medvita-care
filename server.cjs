const { existsSync } = require('node:fs');
const path = require('node:path');

// Same entry name works from the repository or the published output directory.
const directory = existsSync(path.join(__dirname, 'deploy/start.cjs'))
  ? path.join(__dirname, 'deploy')
  : __dirname;
require(path.join(directory, 'start.cjs'));
