#!/bin/bash
# ===== AVTOTEST VPS DEPLOY SCRIPT =====
# Bu scriptni VPS serveringizda ishga tushiring
# Faqat birinchi marta: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🚀 Avtotest o'rnatilmoqda..."

# 1. Node.js o'rnatish (agar yo'q bo'lsa)
if ! command -v node &> /dev/null; then
  echo "📦 Node.js o'rnatilmoqda..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# 2. Nginx o'rnatish (agar yo'q bo'lsa)
if ! command -v nginx &> /dev/null; then
  echo "📦 Nginx o'rnatilmoqda..."
  sudo apt-get update
  sudo apt-get install -y nginx
fi

# 3. Loyihani clone qilish (GitHub URL ni o'zgartiring!)
REPO_URL="${1:-}"
if [ -z "$REPO_URL" ]; then
  echo "❌ GitHub repo URL kiriting!"
  echo "Ishlatish: ./deploy.sh https://github.com/USERNAME/REPO_NAME.git"
  exit 1
fi

APP_DIR="/var/www/avtotest"
sudo mkdir -p $APP_DIR
cd /tmp
rm -rf avtotest-build
git clone "$REPO_URL" avtotest-build
cd avtotest-build

# 4. .env fayl yaratish
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://tgomnedmsdifzlnkpbda.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb21uZWRtc2RpZnpsbmtwYmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcxMDgsImV4cCI6MjA4Njg0MzEwOH0.NA5X8hapkZXh8UOJi-wllApnxnzpKVrTIzOuB3zxEI4
VITE_SUPABASE_PROJECT_ID=tgomnedmsdifzlnkpbda
EOF

# 5. Build qilish
echo "🔨 Build qilinmoqda..."
npm install
npm run build

# 6. Fayllarni joylashtirish
sudo rm -rf $APP_DIR/*
sudo cp -r dist/* $APP_DIR/

# 7. Nginx sozlash
sudo tee /etc/nginx/sites-available/avtotest > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;
    root /var/www/avtotest;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Kesh sozlamalari
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/avtotest /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Tozalash
cd /
rm -rf /tmp/avtotest-build

echo ""
echo "✅ Avtotest muvaffaqiyatli o'rnatildi!"
echo "🌐 Brauzerda oching: http://$(curl -s ifconfig.me)"
echo ""
echo "📌 Admin kirish:"
echo "   Email: admin@avtotest.uz"
echo "   Parol: Admin123!"
