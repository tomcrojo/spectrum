const { spawn } = require('node:child_process')
const path = require('node:path')
const esbuild = require('esbuild')

try {
  esbuild.buildSync({
    entryPoints: ['src/dev-server/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: '.dev-server.cjs',
    absWorkingDir: process.cwd(),
    alias: {
      '@shared': path.resolve(process.cwd(), 'src/shared')
    },
    external: ['better-sqlite3', 'electron', 'node-pty', 'ws']
  })
} catch (error) {
  console.error(error)
  process.exit(1)
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
