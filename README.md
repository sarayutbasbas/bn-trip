# BN Trip

Mobile-first PWA สำหรับวางแผนท่องเที่ยวร่วมกัน 2 คน สร้างด้วย Next.js 16, React 19, Tailwind CSS 4 และ PostgreSQL 16

ฟอนต์ IBM Plex Sans และ IBM Plex Sans Thai ถูก bundle ภายในแอปผ่าน Fontsource จึงไม่ต้องเรียก Google Fonts และยังแสดงผลได้เมื่อใช้งานผ่าน Cloudflare Tunnel หรือเครือข่ายที่บล็อก font CDN

## ฟีเจอร์ในโปรเจกต์

- Dashboard สรุปทริป งบประมาณ ผู้ร่วมเดินทาง เที่ยวบิน และเลานจ์
- Day-by-Day Timeline แยกเช้า/บ่าย/เย็น พร้อมวิธีเดินทางและช่องใส่รูป
- Expense Tracker แยก Budget/Actual, เก็บสกุลเงินเดิม อัตราแลกเปลี่ยน ณ วันบันทึก และยอด THB
- หมวด Shopping แยกออกจากงบหลัก
- จัดการบัตรเครดิตและช่องทางชำระเงิน
- Google OAuth พร้อมสิทธิ์เจ้าของและผู้ร่วมทริปตามอีเมล
- Light/Dark mode และภาษา TH/EN (ค่าหน้าจอเก็บในอุปกรณ์)
- PWA manifest และ app icon พร้อมติดตั้งบนหน้าจอโฮม
- Responsive ตั้งแต่มือถือจนถึง Desktop
- แยกทริปที่กำลังจะมาถึงและทริปที่ผ่านมาแล้วตามวันกลับ
- อัปโหลดรูปปก JPG/PNG/WebP สูงสุด 8 MB และเก็บถาวรใน Docker volume `bntrip_uploads`

## Local และ Cloud แยกข้อมูลกัน

แอปรองรับสองโหมดโดยใช้ environment variables ชุดละที่ จึงไม่แชร์ฐานข้อมูลหรือรูปกันโดยอัตโนมัติ:

| สภาพแวดล้อม | ฐานข้อมูล | รูปที่อัปโหลด |
| --- | --- | --- |
| Local / Docker | PostgreSQL ที่ `localhost:5434` หรือ service `db` | Docker volume `bntrip_uploads` |
| Vercel | PostgreSQL จาก `DATABASE_URL` (แนะนำ Neon pooled URL) | Private Vercel Blob |

`STORAGE_BACKEND` รับค่า `local` หรือ `blob` หากไม่กำหนด แอปจะใช้ `blob` บน Vercel และใช้ `local` ในสภาพแวดล้อมอื่น URL รูปในฐานข้อมูลยังเป็น `/api/uploads/<filename>` เหมือนกันทั้งสองโหมด และ route นี้ตรวจ session ก่อนส่งรูปเสมอ

## โครงสร้างโปรเจกต์

```text
bn-trip/
├── app/
│   ├── api/
│   │   ├── auth/login, auth/logout
│   │   ├── expenses
│   │   └── trips, trips/[id]
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── db/
│   ├── init.sql              # PostgreSQL schema + demo user
│   └── schema.ts             # Drizzle schema
├── public/
│   ├── bn-trip-logo.png      # transparent PWA/app icon
│   └── manifest.webmanifest
├── src/
│   ├── components/bn-trip-app.tsx
│   └── lib/
│       ├── auth.ts
│       └── db.ts
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
└── package.json
```

## เริ่มใช้งานด้วย Docker (แนะนำ)

ต้องมี Docker Desktop หรือ Docker Engine + Compose plugin

1. เข้าโฟลเดอร์โปรเจกต์

   ```bash
   cd /Users/basukekung/Projects/bn-trip
   ```

2. สร้างไฟล์ environment

   ```bash
   cp .env.example .env
   ```

3. เปลี่ยน `POSTGRES_PASSWORD` และ `AUTH_SECRET` ใน `.env` ก่อนใช้งานจริง โดยสร้าง secret ได้ด้วย

   ```bash
   openssl rand -base64 32
   ```

4. สร้างและเปิดทั้งแอปกับฐานข้อมูล

   ```bash
   docker compose up --build
   ```

5. เปิด [http://localhost:8001](http://localhost:8001)

Compose จะเปิด `cloudflared` พร้อมกันและตั้ง `restart: unless-stopped` ให้ทั้ง app, database และ tunnel เมื่อ Docker Engine เริ่มหลังเปิดเครื่อง container ทั้งสามจะกลับมาทำงานอัตโนมัติ ควรตั้ง Docker Desktop ให้เปิดตอน Login บน macOS ด้วย

เครื่องนี้ติดตั้ง LaunchAgent ชื่อ `com.bntrip.autostart` ซึ่งเรียก `scripts/start-bn-trip.sh` ตอน Login เพื่อเปิด OrbStack และ Docker stack โดยไม่ต้องสั่งด้วยตนเอง ไฟล์ต้นฉบับอยู่ใน `launchd/com.bntrip.autostart.plist`

ใน Cloudflare Zero Trust → Networks → Tunnels → Public Hostname ให้กำหนด Service URL เป็น `http://app:8001` เนื่องจาก cloudflared และแอปอยู่ใน Docker network เดียวกัน

การเข้าสู่ระบบใช้ Google Account เท่านั้น โดยต้องตั้งค่า `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` และ Redirect URI ก่อนใช้งาน

แอปเปิดที่พอร์ต `8001` ส่วน PostgreSQL เปิดให้เครื่อง host เชื่อมต่อที่ `5434` และใช้ `5432` ภายใน Docker network เพื่อไม่ให้ชนกับพอร์ตแอปและโปรเจกต์อื่น

หยุดระบบด้วย `docker compose down` ข้อมูลฐานข้อมูลยังคงอยู่ใน named volume `bntrip_postgres_data` หากต้องการลบข้อมูลทดสอบทั้งหมดให้ใช้ `docker compose down -v` (คำสั่งนี้ลบฐานข้อมูลถาวร)

## รันแบบ Development

1. เปิด PostgreSQL อย่างเดียว

   ```bash
   docker compose up db -d
   ```

2. ติดตั้งแพ็กเกจ

   ```bash
   npm install
   ```

3. สร้าง `.env.local`

   ```env
   DATABASE_URL=postgresql://bntrip:change-me-for-production@localhost:5434/bntrip
   AUTH_SECRET=your-long-random-secret
   ```

   รหัสผ่านใน URL ต้องตรงกับ `POSTGRES_PASSWORD` ที่ใช้ตอนสร้าง container ครั้งแรก

4. เปิด development server

   ```bash
   npm run dev
   ```

5. ตรวจ production build

   ```bash
   npm run build
   ```

## Deploy ขึ้น Vercel + Neon + Private Blob

### 1. สร้าง Vercel project

Import private repository `sarayutbasbas/bn-trip` ใน Vercel โดยใช้ค่า Framework Preset เป็น Next.js และค่า build อื่นใช้ค่าเริ่มต้นได้ทั้งหมด

### 2. สร้าง cloud storage

ในหน้า Vercel project:

1. ไปที่ Storage/Marketplace แล้วเพิ่ม Neon Postgres เลือก region ใกล้กับ Vercel Function
2. ตรวจว่า integration สร้าง `DATABASE_URL` ให้ project แล้ว
3. สร้าง Blob store แบบ **Private** แล้วเชื่อมกับ project รุ่นใหม่จะเพิ่ม `BLOB_STORE_ID` และใช้ OIDC token อายุสั้นอัตโนมัติ (store รุ่นเก่าอาจใช้ `BLOB_READ_WRITE_TOKEN`)
4. เพิ่ม environment variables สำหรับ Production และ Preview:

   ```env
   STORAGE_BACKEND=blob
   DATABASE_POOL_MAX=1
   AUTH_SECRET=<production-secret-อย่างน้อย-32-ตัวอักษร>
   ```

5. เพิ่ม Google OAuth variables สำหรับ Production (เก็บ Client Secret เป็น Sensitive):

   ```env
   GOOGLE_CLIENT_ID=<Google OAuth web client ID>
   GOOGLE_CLIENT_SECRET=<Google OAuth web client secret>
   APP_URL=https://bn-trip.vercel.app
   GOOGLE_REDIRECT_URI=https://bn-trip.vercel.app/api/auth/google/callback
   GOOGLE_OWNER_EMAIL=sarayutkongpeng@gmail.com
   ```

6. ใน Google Cloud Console เพิ่มค่าตรงตัวดังนี้:

   - Authorized JavaScript origin: `https://bn-trip.vercel.app`
   - Authorized redirect URI: `https://bn-trip.vercel.app/api/auth/google/callback`

Google OAuth ไม่รองรับ wildcard callback สำหรับ preview URL ที่เปลี่ยนทุก deployment จึงใช้ production alias `bn-trip.vercel.app` เป็น callback หลัก

ห้ามนำ `.env`, database URL, Blob token หรือ production secret ขึ้น Git โดยเด็ดขาด

### 3. สร้าง schema และบัญชีแรกบน cloud

สร้างไฟล์ `.env.cloud.local` ในเครื่อง ไฟล์นี้ถูก `.gitignore` ไว้อยู่แล้ว:

```env
DATABASE_URL=postgresql://<neon-pooled-url>?sslmode=require
INITIAL_DISPLAY_NAME=<ชื่อที่แสดง>
GOOGLE_OWNER_EMAIL=sarayutkongpeng@gmail.com
```

จากนั้นรัน:

```bash
node --env-file=.env.cloud.local scripts/setup-cloud-db.mjs
```

สคริปต์รันใน transaction, สร้าง schema ที่ยังไม่มี และ upsert บัญชีเจ้าของตาม `GOOGLE_OWNER_EMAIL`

หากต้องย้ายข้อมูลจาก PostgreSQL เดิมไปฐานข้อมูล cloud ให้สำรองฐานข้อมูลปลายทางก่อน แล้วรันสคริปต์ต่อไปนี้ สคริปต์จะล้างเฉพาะตารางของ BN Trip ที่ปลายทางก่อนคัดลอกข้อมูลทั้งหมด:

```bash
SOURCE_DATABASE_URL=postgresql://<source> \
DATABASE_URL=postgresql://<target> \
ALLOW_TARGET_REPLACE=yes \
npm run db:migrate:data
```

### 4. Deploy และตรวจระบบ

กด Deploy/Redeploy ใน Vercel แล้วตรวจตามลำดับ:

- Login ด้วย Google Account เจ้าของ
- เปิด `/api/health` ต้องได้ `{"status":"ok"}`
- สร้างทริปทดสอบ
- อัปโหลดรูป แล้ว refresh หน้าเพื่อยืนยันว่ารูปยังเปิดได้
- Logout แล้วลองเปิด URL รูป ต้องได้รับ `401 Unauthorized`

การ push เข้า branch `main` หลังเชื่อม GitHub แล้วจะ deploy production ให้อัตโนมัติ ส่วน local Docker จะยังใช้ข้อมูลและรูปเดิมในเครื่อง

## Database model

- `users` — Google identity, email, รูปโปรไฟล์, ชื่อที่แสดง, theme และ locale
- `trips` — ชื่อทริป ปลายทาง จำนวนวัน ผู้ร่วมเดินทาง งบหลักและ Shopping
- `itineraries` — วัน ช่วงเวลา สถานที่ รูป และการเดินทางระหว่างจุด
- `expenses` — Budget/Actual, สกุลเดิม, stamped rate, THB, payment method และ Shopping flag
- `credit_cards` — ชื่อเรียกบัตร brand และเลขท้าย 4 หลัก (ไม่เก็บเลขบัตรเต็ม)
- `flights` — เที่ยวบิน สนามบิน เวลา และ booking reference
- `lounges` — เลานจ์ สนามบิน terminal สิทธิ์เข้าใช้ และเที่ยวบินที่เกี่ยวข้อง

เมื่อสร้าง volume ใหม่ PostgreSQL จะรัน `db/init.sql` อัตโนมัติ การแก้ไฟล์ init ภายหลังจะไม่ย้อนกลับไปแก้ฐานข้อมูลเดิม ควรใช้ migration สำหรับ production

## Currency stamping

ตอนบันทึก expense ระบบคำนวณ `amount_thb = foreign_amount × exchange_rate` และเก็บ `foreign_amount`, `currency`, `exchange_rate`, `amount_thb`, `rate_stamped_at` พร้อมกัน ทำให้ยอดย้อนหลังไม่เปลี่ยนตามเรตใหม่ ในรุ่นตัวอย่างผู้ใช้กรอกเรตเอง จุดต่อยอดที่เหมาะสมคือเชื่อม API อัตราแลกเปลี่ยนในฝั่ง server แล้วให้ผู้ใช้ยืนยันก่อนบันทึก

## Security note

บัญชี demo มีไว้สำหรับ local development เท่านั้น ก่อนนำขึ้นใช้งานจริงควรเปลี่ยนรหัสผ่าน, ใช้ HTTPS, ตั้ง `AUTH_SECRET` แบบสุ่ม, จำกัด rate ของ login endpoint และสำรอง PostgreSQL ตามรอบเวลา

## Backup และกู้คืน

Git เก็บโค้ด, schema และ migrations แต่ **ไม่เก็บข้อมูล PostgreSQL หรือไฟล์ใน Docker volumes** ระบบ backup จึงสร้าง snapshot ที่มีทั้ง `database.dump` และ `uploads.tar.gz` พร้อม checksum ในชุดเดียวกัน

แนะนำให้เก็บตามหลัก 3-2-1:

1. ข้อมูลจริงใน server
2. snapshot รายวันบน external HDD
3. สำเนาเข้ารหัสนอกสถานที่บน Cloudflare R2 ผ่าน `rclone crypt`

ตั้งค่า local/external backup:

```bash
cp .env.backup.example .env.backup
# แก้ BNTRIP_BACKUP_DIR ให้เป็น path ของ external HDD
npm run backup
```

ถ้าตั้ง `BNTRIP_RCLONE_REMOTE` สคริปต์จะส่ง snapshot ขึ้น remote หลังตรวจสอบไฟล์แล้ว ค่านี้ควรชี้ไปที่ **crypt remote** ของ rclone ไม่ใช่ R2 remote ตรง ๆ เพื่อให้ชื่อไฟล์และเนื้อหาถูกเข้ารหัสก่อนออกจากเครื่อง ห้าม commit `.env.backup` หรือรหัสผ่าน rclone ขึ้น Git

ไฟล์ตัวอย่าง `launchd/com.bntrip.backup.plist` รันทุกวันเวลา 03:15 น. หลังตั้งค่าและทดสอบ `npm run backup` สำเร็จแล้วจึงคัดลอกไปที่ `~/Library/LaunchAgents/` และโหลดด้วย `launchctl`

ตรวจรายการใน snapshot และกู้คืนด้วย:

```bash
ls -la /path/to/snapshot
RESTORE_CONFIRM=restore-bn-trip npm run restore -- /path/to/snapshot
```

การ restore จะตรวจ checksum, หยุด app ชั่วคราว แล้ว **แทนที่ฐานข้อมูลและไฟล์อัปโหลดปัจจุบันทั้งหมด** ควรทดสอบกู้คืนบนเครื่อง/สภาพแวดล้อมทดลองเป็นระยะ เพราะ backup ที่ไม่เคยทดสอบ restore ยังถือว่าเชื่อถือไม่ได้

## Logo

โลโก้ BN Trip อยู่ที่ `public/bn-trip-logo.png` เป็น PNG โปร่งใส ใช้กับ navbar, favicon และ PWA icon ส่วน `bn-trip-logo-source.png` คือไฟล์ต้นฉบับพื้น chroma key
