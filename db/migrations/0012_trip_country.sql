ALTER TABLE trips ADD COLUMN IF NOT EXISTS country_code CHAR(2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS country_name VARCHAR(120);

UPDATE trips
SET country_code = CASE
      WHEN lower(destination) LIKE '%japan%' OR destination LIKE '%ญี่ปุ่น%' OR timezone = 'Asia/Tokyo' THEN 'JP'
      WHEN lower(destination) LIKE '%china%' OR destination LIKE '%จีน%' OR timezone = 'Asia/Shanghai' THEN 'CN'
      WHEN lower(destination) LIKE '%korea%' OR destination LIKE '%เกาหลี%' OR timezone = 'Asia/Seoul' THEN 'KR'
      WHEN lower(destination) LIKE '%taiwan%' OR destination LIKE '%ไต้หวัน%' OR timezone = 'Asia/Taipei' THEN 'TW'
      WHEN lower(destination) LIKE '%hong kong%' OR destination LIKE '%ฮ่องกง%' OR timezone = 'Asia/Hong_Kong' THEN 'HK'
      WHEN lower(destination) LIKE '%singapore%' OR destination LIKE '%สิงคโปร์%' OR timezone = 'Asia/Singapore' THEN 'SG'
      WHEN lower(destination) LIKE '%vietnam%' OR destination LIKE '%เวียดนาม%' OR timezone = 'Asia/Ho_Chi_Minh' THEN 'VN'
      WHEN lower(destination) LIKE '%malaysia%' OR destination LIKE '%มาเลเซีย%' OR timezone = 'Asia/Kuala_Lumpur' THEN 'MY'
      WHEN lower(destination) LIKE '%indonesia%' OR destination LIKE '%อินโดนีเซีย%' OR timezone = 'Asia/Jakarta' THEN 'ID'
      WHEN lower(destination) LIKE '%thailand%' OR destination LIKE '%ไทย%' OR timezone = 'Asia/Bangkok' THEN 'TH'
      ELSE country_code
    END,
    country_name = CASE
      WHEN lower(destination) LIKE '%japan%' OR destination LIKE '%ญี่ปุ่น%' OR timezone = 'Asia/Tokyo' THEN 'Japan'
      WHEN lower(destination) LIKE '%china%' OR destination LIKE '%จีน%' OR timezone = 'Asia/Shanghai' THEN 'China'
      WHEN lower(destination) LIKE '%korea%' OR destination LIKE '%เกาหลี%' OR timezone = 'Asia/Seoul' THEN 'South Korea'
      WHEN lower(destination) LIKE '%taiwan%' OR destination LIKE '%ไต้หวัน%' OR timezone = 'Asia/Taipei' THEN 'Taiwan'
      WHEN lower(destination) LIKE '%hong kong%' OR destination LIKE '%ฮ่องกง%' OR timezone = 'Asia/Hong_Kong' THEN 'Hong Kong'
      WHEN lower(destination) LIKE '%singapore%' OR destination LIKE '%สิงคโปร์%' OR timezone = 'Asia/Singapore' THEN 'Singapore'
      WHEN lower(destination) LIKE '%vietnam%' OR destination LIKE '%เวียดนาม%' OR timezone = 'Asia/Ho_Chi_Minh' THEN 'Vietnam'
      WHEN lower(destination) LIKE '%malaysia%' OR destination LIKE '%มาเลเซีย%' OR timezone = 'Asia/Kuala_Lumpur' THEN 'Malaysia'
      WHEN lower(destination) LIKE '%indonesia%' OR destination LIKE '%อินโดนีเซีย%' OR timezone = 'Asia/Jakarta' THEN 'Indonesia'
      WHEN lower(destination) LIKE '%thailand%' OR destination LIKE '%ไทย%' OR timezone = 'Asia/Bangkok' THEN 'Thailand'
      ELSE country_name
    END
WHERE country_code IS NULL OR country_name IS NULL;
