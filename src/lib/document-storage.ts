export const DOCUMENT_QUOTA_BYTES=100*1024*1024;
export const PDF_LIMIT_BYTES=10*1024*1024;
export const IMAGE_LIMIT_BYTES=3*1024*1024;
export const DOCUMENT_TYPES={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp"} as const;

export function validateDocument(mimeType:string,size:number){
  if(!(mimeType in DOCUMENT_TYPES))return "รองรับ PDF, JPG, PNG และ WebP";
  const limit=mimeType==="application/pdf"?PDF_LIMIT_BYTES:IMAGE_LIMIT_BYTES;
  if(!Number.isFinite(size)||size<=0)return "ไฟล์ไม่ถูกต้อง";
  if(size>limit)return mimeType==="application/pdf"?"PDF ต้องมีขนาดไม่เกิน 10 MB":"รูปภาพต้องมีขนาดไม่เกิน 3 MB";
  return null;
}

export function documentExtension(mimeType:string){return DOCUMENT_TYPES[mimeType as keyof typeof DOCUMENT_TYPES]}
