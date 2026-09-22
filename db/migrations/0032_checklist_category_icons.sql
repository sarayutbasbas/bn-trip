ALTER TABLE checklist_master_categories
  ADD COLUMN IF NOT EXISTS icon_key VARCHAR(40);

UPDATE checklist_master_categories SET icon_key=CASE
  WHEN lower(name) ~ 'เที่ยว|เดินทาง|flight|airport|ก่อนออก' THEN 'plane'
  WHEN lower(name) ~ 'เสื้อ|clothes|กระเป๋าเสื้อ' THEN 'shirt'
  WHEN lower(name) ~ 'ไอที|คอม|notebook|laptop|ชาร์|สายชาร์|อิเล็ก' THEN 'laptop'
  WHEN lower(name) ~ 'ยา|สุขภาพ|พยาบาล|medical' THEN 'medical'
  WHEN lower(name) ~ 'makeup|เครื่องสำอาง|คสอ' THEN 'sparkles'
  WHEN lower(name) ~ 'skin|ผิว|กันแดด' THEN 'heart'
  WHEN lower(name) ~ 'toiletries|ห้องน้ำ|อาบน้ำ|แปรงสีฟัน|แชมพู' THEN 'shower'
  WHEN lower(name) ~ 'hair|ผม|หวี|ไดร์' THEN 'scissors'
  WHEN lower(name) ~ 'accessories|เครื่องประดับ|นาฬิกา|แหวน|สร้อย' THEN 'watch'
  WHEN lower(name) ~ 'passport|เอกสาร|บัตรประชาชน' THEN 'passport'
  WHEN lower(name) ~ 'กล้อง|camera|เลนส์' THEN 'camera'
  WHEN lower(name) ~ 'ฉุกเฉิน|ภัยพิบัติ|ไฟฉาย' THEN 'flashlight'
  WHEN lower(name) ~ 'เงิน|บัตรเครดิต|wallet' THEN 'wallet'
  WHEN lower(name) ~ 'อาหาร|ขนม|food' THEN 'food'
  WHEN lower(name) ~ 'โรงแรม|ที่พัก|hotel' THEN 'bed'
  WHEN lower(name) ~ 'ช้อป|shopping|ของฝาก' THEN 'shopping'
  WHEN lower(name) ~ 'เด็ก|baby' THEN 'baby'
  WHEN lower(name) ~ 'สัตว์|หมา|แมว|pet' THEN 'pet'
  ELSE 'help' END
WHERE icon_key IS NULL OR icon_key='';

CREATE INDEX IF NOT EXISTS checklist_master_categories_icon_idx
  ON checklist_master_categories(user_id, icon_key);
