#!/bin/bash
# ===== AVTOTEST AAPANEL DEPLOY SCRIPT =====
# Ishlatish:
#   1. VPS ga kirganingizda shu faylni yarating:
#      nano deploy.sh
#   2. Shu kodni ichiga qo'ying, saqlang (Ctrl+X, Y, Enter)
#   3. Ishga tushiring:
#      chmod +x deploy.sh && ./deploy.sh
#
# ⚠️  GitHub repo URL ni pastda REPO_URL ga yozing!

set -e

# ============================
# 📌 SHU YERNI O'ZGARTIRING:
# ============================
REPO_URL="https://github.com/muhamadyorg/uzbek-ai-web-buddy.git"
DOMAIN="bt.muhamadyorg.uz"
# ============================

APP_DIR="/www/wwwroot/$DOMAIN"

echo ""
echo "🚀 Avtotest o'rnatilmoqda..."
echo "📌 Domen: $DOMAIN"
echo "📌 Repo: $REPO_URL"
echo ""

# 1. Node.js o'rnatish (agar yo'q bo'lsa)
if ! command -v node &> /dev/null; then
  echo "📦 Node.js o'rnatilmoqda..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "✅ Node.js: $(node -v)"
echo "✅ NPM: $(npm -v)"

# 2. Git o'rnatish (agar yo'q bo'lsa)
if ! command -v git &> /dev/null; then
  echo "📦 Git o'rnatilmoqda..."
  apt-get update && apt-get install -y git
fi

# 3. Build qilish
echo "📥 Repo clone qilinmoqda..."
cd /tmp
rm -rf avtotest-build
git clone "$REPO_URL" avtotest-build
cd avtotest-build

# 4. .env fayl yaratish (Supabase ulanishi)
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://tgomnedmsdifzlnkpbda.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb21uZWRtc2RpZnpsbmtwYmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcxMDgsImV4cCI6MjA4Njg0MzEwOH0.NA5X8hapkZXh8UOJi-wllApnxnzpKVrTIzOuB3zxEI4
VITE_SUPABASE_PROJECT_ID=tgomnedmsdifzlnkpbda
EOF

echo "🔨 Build qilinmoqda..."
npm install
npm run build

# 5. Fayllarni joylashtirish
echo "📂 Fayllar joylashtirilmoqda..."
mkdir -p "$APP_DIR"
rm -rf "$APP_DIR"/*
cp -r dist/* "$APP_DIR"/

# 6. aaPanel Nginx config yaratish
NGINX_CONF="/www/server/panel/vhost/nginx/${DOMAIN}.conf"

# Agar aaPanel config mavjud bo'lsa — faqat location blokini yangilash
if [ -f "$NGINX_CONF" ]; then
  echo "🔧 aaPanel Nginx config yangilanmoqda..."
  # root ni to'g'rilash
  sed -i "s|root .*|root $APP_DIR;|g" "$NGINX_CONF"
  # try_files qo'shish (SPA routing uchun)
  if ! grep -q "try_files" "$NGINX_CONF"; then
    sed -i '/index index.html/a\        try_files $uri $uri/ /index.html;' "$NGINX_CONF"
  fi
else
  echo "🆕 Nginx config yaratilmoqda..."
  mkdir -p /www/server/panel/vhost/nginx/
  cat > "$NGINX_CONF" << NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    root ${APP_DIR};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Static fayllar keshi
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Loglar
    access_log /www/wwwlogs/${DOMAIN}.log;
    error_log /www/wwwlogs/${DOMAIN}.error.log;
}
NGINX
fi

# 7. Nginx reload
echo "🔄 Nginx qayta ishga tushirilmoqda..."
nginx -t && nginx -s reload

# 8. Tozalash
cd /
rm -rf /tmp/avtotest-build

echo ""
echo "============================================"
echo "✅ Avtotest muvaffaqiyatli o'rnatildi!"
echo "============================================"
echo ""
echo "🌐 Sayt: http://${DOMAIN}"
echo ""
echo "📌 Admin kirish:"
echo "   Email: admin@avtotest.uz"
echo "   Parol: Admin123!"
echo ""
echo "🔒 SSL uchun: aaPanel → Website → ${DOMAIN} → SSL → Let's Encrypt"
echo ""
echo "============================================"
echo "📋 KEYINGI QADAMLAR:"
echo "============================================"
echo "1. DNS sozlash: ${DOMAIN} → A record → $(curl -s ifconfig.me 2>/dev/null || echo 'VPS_IP')"
echo "2. aaPanel → Website → saytni qo'shing (agar qo'shilmagan bo'lsa)"
echo "3. aaPanel → Website → ${DOMAIN} → SSL → Let's Encrypt bosing"
echo ""
