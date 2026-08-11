# BN Trip

Mobile-first PWA สำหรับวางแผนท่องเที่ยวร่วมกัน 2 คน สร้างด้วย Next.js 16, React 19, Tailwind CSS 4 และ PostgreSQL 16

ฟอนต์ IBM Plex Sans และ IBM Plex Sans Thai ถูก bundle ภายในแอปผ่าน Fontsource จึงไม่ต้องเรียก Google Fonts และยังแสดงผลได้เมื่อใช้งานผ่าน Cloudflare Tunnel หรือเครือข่ายที่บล็อก font CDN

## ฟีเจอร์ในโปรเจกต์

- Dashboard สรุปทริป งบประมาณ ผู้ร่วมเดินทาง เที่ยวบิน และเลานจ์
- Day-by-Day Timeline แยกเช้า/บ่าย/เย็น พร้อมวิธีเดินทางและช่องใส่รูป
- Expense Tracker แยก Budget/Actual, เก็บสกุลเงินเดิม อัตราแลกเปลี่ยน ณ วันบันทึก และยอด THB
- หมวด Shopping แยกออกจากงบหลัก
- จัดการบัตรเครดิตและช่องทางชำระเงิน
- Shared Trip ID สำหรับคู่เดินทางเข้าถึงข้อมูลชุดเดียวกัน
- Light/Dark mode และภาษา TH/EN (ค่าหน้าจอเก็บในอุปกรณ์)
- PWA manifest และ app icon พร้อมติดตั้งบนหน้าจอโฮม
- Responsive ตั้งแต่มือถือจนถึง Desktop
- แยกทริปที่กำลังจะมาถึงและทริปที่ผ่านมาแล้วตามวันกลับ
- อัปโหลดรูปปก JPG/PNG/WebP สูงสุด 8 MB และเก็บถาวรใน Docker volume `bntrip_uploads`

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

บัญชีตัวอย่าง:

- Shared Trip ID: `BNTOGETHER`
- Password: `bntogether`

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

## Database model

- `users` — Shared ID, password hash, theme, locale
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

## Logo

โลโก้ BN Trip อยู่ที่ `public/bn-trip-logo.png` เป็น PNG โปร่งใส ใช้กับ navbar, favicon และ PWA icon ส่วน `bn-trip-logo-source.png` คือไฟล์ต้นฉบับพื้น chroma key
