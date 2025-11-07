#!/usr/bin/env node
const { execSync } = require('child_process');
const port = process.env.PORT || 3000;
execSync(`next start -H 0.0.0.0 --port ${port}`, { stdio: 'inherit' });
