const { spawn } = require('node:child_process')
const net = require('node:net')

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host })

    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })

    socket.once('error', () => {
      resolve(false)
    })
  })
}

async function main() {
  let devServer = null

  if (!(await isPortOpen(3001))) {
    devServer = spawn('node', ['scripts/dev-server.cjs'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false
    })
  } else {
    process.stdout.write('Reusing existing dev server on ws://localhost:3001\n')
  }

  const vite = spawn('npx', ['vite', '--config', 'vite.browser.config.ts'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false
  })

  function shutdown(signal) {
    if (vite.exitCode === null) {
      vite.kill(signal)
    }
    if (devServer && devServer.exitCode === null) {
      devServer.kill(signal)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  vite.on('exit', (code, signal) => {
    shutdown('SIGTERM')
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
