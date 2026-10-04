export const DOCUMENT_QUOTA_BYTES=5*1024*1024;
export const DOCUMENT_QUOTA_MESSAGE="พื้นที่เอกสารไม่เพียงพอ ทริปนี้เก็บเอกสารได้รวมสูงสุด 5 MB กรุณาลบเอกสารที่ไม่ใช้ก่อนอัปโหลดเพิ่ม";
export const PDF_LIMIT_BYTES=DOCUMENT_QUOTA_BYTES;
export const IMAGE_LIMIT_BYTES=3*1024*1024;
export const DOCUMENT_TYPES={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp"} as const;

export function validateDocument(mimeType:string,size:number){
  if(!(mimeType in DOCUMENT_TYPES))return "รองรับ PDF, JPG, PNG และ WebP";
  const limit=mimeType==="application/pdf"?PDF_LIMIT_BYTES:IMAGE_LIMIT_BYTES;
  if(!Number.isFinite(size)||size<=0)return "ไฟล์ไม่ถูกต้อง";
  if(size>limit)return mimeType==="application/pdf"?DOCUMENT_QUOTA_MESSAGE:"รูปภาพต้องมีขนาดไม่เกิน 3 MB";
  return null;
}

export function documentExtension(mimeType:string){return DOCUMENT_TYPES[mimeType as keyof typeof DOCUMENT_TYPES]}
