module.exports = {
  apps: [
    {
      name: 'schedule',
      cwd: 'C:\\Users\\SHOP4\\welding-apps\\apps\\schedule',
      script: 'C:\\Program Files\\nodejs\\npm.cmd',
      args: 'run dev',
      interpreter: 'C:\\Windows\\System32\\cmd.exe',
      interpreter_args: '/c',
    },
    {
      name: 'welding-manual',
      cwd: 'C:\\Users\\SHOP4\\welding-apps\\apps\\welding-manual',
      script: 'C:\\Program Files\\nodejs\\npm.cmd',
      args: 'run dev',
      interpreter: 'C:\\Windows\\System32\\cmd.exe',
      interpreter_args: '/c',
    },
  ],
};
