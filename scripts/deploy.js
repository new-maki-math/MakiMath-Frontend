import { spawnSync } from 'node:child_process';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { NodeSSH } from 'node-ssh';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const host = process.env.DEPLOY_HOST || '';
const username = process.env.DEPLOY_USER || '';
const privateKey = process.env.DEPLOY_SSH_KEY || '';
const knownHosts = process.env.DEPLOY_KNOWN_HOSTS || '';
const hostKeys = knownHosts
  .split(/\r?\n/)
  .map((line) => line.trim().split(/\s+/))
  .filter(([hosts, type, key]) => hosts?.split(',').includes(host) && type && key)
  .map(([, , key]) => Buffer.from(key, 'base64'));

if (!host || !username || !privateKey || hostKeys.length === 0) {
  console.error(
    'Set DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, and a matching DEPLOY_KNOWN_HOSTS in .env.'
  );
  process.exit(1);
}

if (process.argv.includes('--acl')) {
  console.error('ACL mode is not supported. Use pnpm deploy.');
  process.exit(1);
}

const base = '/var/www/maki-frontend';
const releaseId = `local-${Date.now()}-${randomUUID()}`;
const release = `${base}/releases/${releaseId}`;
const ssh = new NodeSSH();

async function runRemote(command) {
  const result = await ssh.execCommand(command);
  if (result.code !== 0) {
    throw new Error(result.stderr || `Remote command failed (${result.code})`);
  }
  return result;
}

async function main() {
  console.log('✅ Check and build');
  const build =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'pnpm check'], {
          cwd: rootDir,
          env: process.env,
          stdio: 'inherit',
          windowsHide: true
        })
      : spawnSync('pnpm', ['check'], {
          cwd: rootDir,
          env: process.env,
          stdio: 'inherit'
        });
  if (build.error) {
    throw build.error;
  }
  if (build.status !== 0) {
    throw new Error('Check and build failed');
  }

  const dist = path.join(rootDir, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error('dist/index.html was not generated');
  }

  console.log('🔐 Configure SSH');
  await ssh.connect({
    host,
    username,
    privateKey,
    tryKeyboard: false,
    hostVerifier: (key) =>
      hostKeys.some((expected) => expected.length === key.length && timingSafeEqual(expected, key))
  });

  console.log('🚀 Upload and activate release');
  await runRemote(`umask 022; mkdir -p '${base}/releases'; mkdir '${release}'`);
  const uploaded = await ssh.putDirectory(dist, release, {
    recursive: true,
    concurrency: 8
  });
  if (!uploaded) {
    throw new Error('Upload failed; the current release was not changed');
  }

  await runRemote(`set -e
chmod -R a+rX '${release}'
test -f '${release}/index.html'
if [ -e '${base}/current' ] && [ ! -L '${base}/current' ]; then
  echo 'current exists and is not a symlink; deployment stopped' >&2
  exit 1
fi
ln -s '${release}' '${base}/.current-${releaseId}'
mv -Tf '${base}/.current-${releaseId}' '${base}/current'`);
  console.log(`Release activated: ${release}`);
}

main()
  .catch((error) => {
    console.error('Deployment failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    ssh.dispose();
  });
