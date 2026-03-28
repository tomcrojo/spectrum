const { spawn, spawnSync } = require('node:child_process')

const build = spawnSync(
  'npx',
  [
    'esbuild',
    'src/dev-server/index.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--outfile=.dev-server.cjs',
    '--external:better-sqlite3',
    '--external:node-pty',
    '--external:ws'
  ],
  {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: false
  }
)

if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

const child = spawn('npx', ['electron', '.dev-server.cjs'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: false,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1'
  }
})

function shutdown(signal) {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
