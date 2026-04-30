module.exports = {
  apps: [{
    name: 'scrutinise-ingest',
    script: 'D:/Dropbox/GitHub/scrutinise-prototype/scrutinise-web/node_modules/ts-node/dist/bin.js',
    args: '-P D:/Dropbox/GitHub/scrutinise-prototype/scripts/tsconfig.json --transpile-only D:/Dropbox/GitHub/scrutinise-prototype/scripts/legislation/ingest.ts --full',
    cwd: 'D:/Dropbox/GitHub/scrutinise-prototype/scripts',
    env: {
      NODE_PATH: 'D:/Dropbox/GitHub/scrutinise-prototype/scrutinise-web/node_modules'
    },
    autorestart: true,
    stop_exit_codes: [0],
    max_restarts: 10,
    min_uptime: '60s',
    watch: false,
    error_file: 'D:/Dropbox/GitHub/scrutinise-prototype/scripts/legislation/pm2-ingest-error.log',
    out_file: 'D:/Dropbox/GitHub/scrutinise-prototype/scripts/legislation/pm2-ingest-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
