const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const buildDir = path.join(repoRoot, 'build');
const nodeBinDir = path.join(buildDir, 'node-bin');
const t3codeStageDir = path.join(buildDir, 't3code-runtime');
const runtimeNodeModulesDir = path.join(t3codeStageDir, 'runtime-node-modules');
const nodeBinaryName = process.platform === 'win32' ? 'node.exe' : 'node';
const nodeSourcePath = process.execPath;
const nodeTargetPath = path.join(nodeBinDir, nodeBinaryName);
const t3codeRoot = path.join(repoRoot, 'resources', 't3code');
const t3codeServerRoot = path.join(t3codeRoot, 'apps', 'server');

const requiredPaths = [
  path.join(t3codeRoot, 'package.json'),
  path.join(t3codeServerRoot, 'package.json'),
  path.join(t3codeServerRoot, 'dist', 'index.mjs')
];

for (const requiredPath of requiredPaths) {
  if (!fs.existsSync(requiredPath)) {
    console.error(`Missing packaged runtime dependency: ${requiredPath}`);
    console.error(
      'Make sure the T3Code submodule is initialized and the server build output exists before packaging.'
    );
    process.exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveDependencyVersion(packageName, version, catalog) {
  if (version !== 'catalog:') {
    return version;
  }

  const resolved = catalog[packageName];
  if (!resolved) {
    throw new Error(`Missing catalog version for ${packageName}`);
  }

  return resolved;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const monorepoManifest = readJson(path.join(t3codeRoot, 'package.json'));
const serverManifest = readJson(path.join(t3codeServerRoot, 'package.json'));
const catalog = monorepoManifest?.workspaces?.catalog ?? {};

const runtimeDependencies = Object.fromEntries(
  Object.entries(serverManifest.dependencies ?? {}).map(([packageName, version]) => [
    packageName,
    resolveDependencyVersion(packageName, version, catalog)
  ])
);

const runtimeManifest = {
  name: '@spectrum/t3code-runtime',
  private: true,
  type: 'module',
  packageManager: monorepoManifest.packageManager,
  dependencies: runtimeDependencies
};

fs.mkdirSync(nodeBinDir, { recursive: true });
fs.copyFileSync(nodeSourcePath, nodeTargetPath);

if (process.platform !== 'win32') {
  fs.chmodSync(nodeTargetPath, 0o755);
}

fs.rmSync(t3codeStageDir, { recursive: true, force: true });
fs.mkdirSync(path.join(t3codeStageDir, 'apps', 'server'), { recursive: true });

writeJson(path.join(t3codeStageDir, 'package.json'), runtimeManifest);
writeJson(path.join(t3codeStageDir, 'apps', 'server', 'package.json'), {
  name: serverManifest.name ?? 't3',
  private: true,
  type: serverManifest.type ?? 'module'
});

fs.cpSync(
  path.join(t3codeServerRoot, 'dist'),
  path.join(t3codeStageDir, 'apps', 'server', 'dist'),
  { recursive: true, dereference: true }
);

execFileSync('bun', ['install', '--production', '--linker', 'hoisted'], {
  cwd: t3codeStageDir,
  stdio: 'inherit'
});

fs.renameSync(path.join(t3codeStageDir, 'node_modules'), runtimeNodeModulesDir);
fs.symlinkSync('.', path.join(runtimeNodeModulesDir, 'node_modules'), 'dir');

for (const cleanupPath of ['bun.lock', 'bun.lockb']) {
  fs.rmSync(path.join(t3codeStageDir, cleanupPath), { force: true });
}

console.log(`Prepared packaged Node runtime at ${nodeTargetPath}`);
console.log(`Prepared packaged T3Code runtime at ${t3codeStageDir}`);
