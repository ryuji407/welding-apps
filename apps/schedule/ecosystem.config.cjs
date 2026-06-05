module.exports = {
    apps: [{
        name: 'manufacturing-schedule-app',
        script: 'server.js',
        watch: true,
        ignore_watch: ['node_modules', 'logs', '.git'],
        watch_options: {
            followSymlinks: false
        },
        env: {
            NODE_ENV: 'development'
        },
        env_production: {
            NODE_ENV: 'production'
        },
        // Auto-restart settings
        max_memory_restart: '500M',
        restart_delay: 1000,
        // Logging
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true
    }]
};
