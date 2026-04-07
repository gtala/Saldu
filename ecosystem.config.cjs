/** PM2: mantiene el proceso vivo y reinicia si cae. */
module.exports = {
  apps: [
    {
      name: "gastos-preview",
      script: "server.js",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "120M",
      env: {
        NODE_ENV: "production",
        PORT: 3847,
        HOST: "127.0.0.1",
      },
    },
  ],
};
