#!/bin/bash
# Script de setup inicial do servidor Hostinger VPS
# Execute uma vez como root: bash deploy/setup.sh

set -e

echo "==> Instalando Node.js 20 via nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20

echo "==> Instalando PM2 e dependências globais..."
npm install -g pm2

echo "==> Instalando Nginx..."
apt-get update -q
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Clonando repositório..."
mkdir -p /var/www
cd /var/www
git clone https://github.com/tiagofachini/agendaradvbr.git agendaradvbr
cd agendaradvbr

echo "==> Instalando dependências..."
npm install
npm install --prefix client
npm install --prefix server

echo "==> Buildando frontend..."
npm run build

echo "==> Gerando Prisma client..."
cd server && npx prisma generate && cd ..

echo ""
echo "======================================================"
echo "PRÓXIMOS PASSOS MANUAIS:"
echo "======================================================"
echo "1. Crie o arquivo /var/www/agendaradvbr/.env com suas variáveis"
echo "   cp .env.example .env && nano .env"
echo ""
echo "2. Registre a migration já aplicada no Supabase:"
echo "   cd server && npx prisma migrate resolve --applied 20250418000000_init"
echo ""
echo "3. Copie o nginx.conf:"
echo "   cp deploy/nginx.conf /etc/nginx/sites-available/agendaradvbr"
echo "   ln -s /etc/nginx/sites-available/agendaradvbr /etc/nginx/sites-enabled/"
echo "   nginx -t && systemctl reload nginx"
echo ""
echo "4. Gere SSL:"
echo "   certbot --nginx -d agendar.adv.br -d www.agendar.adv.br"
echo ""
echo "5. Inicie a aplicação com PM2:"
echo "   pm2 start ecosystem.config.cjs --env production"
echo "   pm2 save && pm2 startup"
echo "======================================================"
