import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { NodeSSH } from 'node-ssh';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'deploy.config.json');

if (!fs.existsSync(configPath)) {
  console.error('未找到 deploy.config.json，请先补充部署配置。');
  process.exit(1);
}

const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const config = {
  host: process.env.DEPLOY_HOST || fileConfig.host,
  port: Number(process.env.DEPLOY_PORT || fileConfig.port || 22),
  username: process.env.DEPLOY_USERNAME || fileConfig.username,
  password: process.env.DEPLOY_PASSWORD || fileConfig.password,
  remoteBaseDir: process.env.DEPLOY_BASE_DIR || fileConfig.remoteBaseDir || '/var/www/maki-math',
  domain: process.env.DEPLOY_DOMAIN || fileConfig.domain || '',
  backendPort: Number(process.env.DEPLOY_BACKEND_PORT || fileConfig.backendPort || 3000),
  configureNginx: fileConfig.configureNginx !== false,
  email: process.env.DEPLOY_EMAIL || fileConfig.email || ''
};

if (
  !config.host ||
  !config.username ||
  !config.password ||
  !config.remoteBaseDir ||
  !config.domain ||
  !config.email
) {
  console.error('部署配置不完整，请检查 deploy.config.json 或环境变量。');
  process.exit(1);
}

const ssh = new NodeSSH();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const remoteTmpBase = `/tmp/maki-frontend-deploy-${timestamp}`;
const remoteUploadDir = `${remoteTmpBase}/frontend`;
const remoteFrontendDir = `${config.remoteBaseDir}/frontend`;

const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function toPosixPath(value) {
  return value.replaceAll('\\', '/');
}

function collectFiles(baseDir, currentDir = baseDir, files = []) {
  const entries = fs.readdirSync(currentDir, {
    withFileTypes: true
  });
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(baseDir, absolutePath, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    files.push({
      absolutePath,
      relativePath: toPosixPath(path.relative(baseDir, absolutePath))
    });
  }
  return files;
}

const nginxConfig = `server {
    listen 80;
    listen [::]:80;
    server_name ${config.domain};
    client_max_body_size 50m;

    location /api/ {
        proxy_pass http://127.0.0.1:${config.backendPort}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root ${remoteFrontendDir};
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
`;

async function main() {
  console.log('开始本地构建前端...');

  const buildResult =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], {
          cwd: rootDir,
          env: process.env,
          stdio: 'inherit',
          windowsHide: true
        })
      : spawnSync('npm', ['run', 'build'], {
          cwd: rootDir,
          env: process.env,
          stdio: 'inherit'
        });

  if (buildResult.error) {
    throw buildResult.error;
  }

  if (buildResult.status !== 0) {
    throw new Error('本地前端构建失败');
  }

  const localDistDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(path.join(localDistDir, 'index.html'))) {
    throw new Error('未生成前端构建产物（dist/index.html 不存在）');
  }

  console.log(`开始连接 ${config.username}@${config.host}:${config.port} ...`);

  await ssh.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    tryKeyboard: false
  });

  console.log('连接成功，准备上传前端构建产物...');
  const uploadFiles = collectFiles(localDistDir);
  let uploadedCount = 0;

  const remotePrep = await ssh.execCommand(`
set -e
mkdir -p ${quote(remoteUploadDir)}
mkdir -p ${quote(remoteFrontendDir)}
`);

  if (remotePrep.code !== 0) {
    throw new Error(remotePrep.stderr || '远程目录初始化失败');
  }

  const uploaded = await ssh.putDirectory(localDistDir, remoteUploadDir, {
    recursive: true,
    concurrency: 8,
    tick: (localPath, _remotePath, error) => {
      if (error) {
        return;
      }
      const stat = fs.existsSync(localPath) ? fs.statSync(localPath) : null;
      if (!stat?.isFile()) {
        return;
      }
      uploadedCount += 1;
      console.log(
        `[${uploadedCount}/${uploadFiles.length}] ${toPosixPath(path.relative(localDistDir, localPath))}`
      );
    }
  });

  if (!uploaded) {
    throw new Error('前端产物文件上传失败');
  }

  console.log('上传完成，开始远程部署前端服务与 Nginx...');

  const deployScript = `
set -e

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx curl

mkdir -p ${quote(config.remoteBaseDir)}
mkdir -p ${quote(remoteUploadDir)}
mkdir -p ${quote(remoteFrontendDir)}

if [ -d ${quote(remoteFrontendDir)} ]; then
  find ${quote(remoteFrontendDir)} -mindepth 1 -maxdepth 1 -exec rm -rf {} +
fi

cp -a ${quote(`${remoteUploadDir}/.`)} ${quote(remoteFrontendDir)}/

if [ ${config.configureNginx ? '1' : '0'} = "1" ]; then
NGINX_SITE_DIR=""
NGINX_SITE_PATH=""

if [ -d /etc/nginx/sites-available ]; then
  NGINX_SITE_DIR="/etc/nginx/sites-available"
  NGINX_SITE_PATH="/etc/nginx/sites-available/${config.domain}"
elif [ -d /etc/nginx/conf.d ]; then
  NGINX_SITE_DIR="/etc/nginx/conf.d"
  NGINX_SITE_PATH="/etc/nginx/conf.d/${config.domain}.conf"
else
  mkdir -p /etc/nginx/conf.d
  NGINX_SITE_DIR="/etc/nginx/conf.d"
  NGINX_SITE_PATH="/etc/nginx/conf.d/${config.domain}.conf"
fi

cat > "$NGINX_SITE_PATH" <<'EOF'
${nginxConfig}
EOF

if [ -d /etc/nginx/sites-enabled ] && [ -f "$NGINX_SITE_PATH" ]; then
  ln -sf "$NGINX_SITE_PATH" "/etc/nginx/sites-enabled/${config.domain}"
fi

rm -f /etc/nginx/conf.d/default.conf || true
rm -f /etc/nginx/sites-enabled/default || true

nginx -t
systemctl enable nginx
systemctl restart nginx

certbot --nginx --non-interactive --agree-tos -m ${quote(config.email)} -d ${quote(config.domain)} --redirect

nginx -t
systemctl reload nginx
else
  nginx -t
  echo "保留现有 Nginx 配置与 HTTPS 证书，仅更新前端文件。"
fi

rm -rf ${quote(remoteTmpBase)}
`;

  const deployResult = await ssh.execCommand(`bash -lc ${quote(deployScript)}`, {
    onStdout: (chunk) => process.stdout.write(chunk.toString()),
    onStderr: (chunk) => process.stderr.write(chunk.toString())
  });

  if (deployResult.code !== 0) {
    throw new Error(deployResult.stderr || '远程前端部署失败');
  }

  console.log(`前端部署完成：${remoteFrontendDir}`);
}

main()
  .catch((error) => {
    console.error('部署失败：', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    ssh.dispose();
  });
