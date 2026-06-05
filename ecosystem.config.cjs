module.exports = {
  apps: [
    {
      name: 'welding-manual',
      cwd: './apps/welding-manual',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '500M',
      restart_delay: 1000,
      error_file: './logs/welding-manual-err.log',
      out_file: './logs/welding-manual-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'schedule',
      cwd: './apps/schedule',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      restart_delay: 1000,
      error_file: './logs/schedule-err.log',
      out_file: './logs/schedule-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
