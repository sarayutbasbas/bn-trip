import { z } from "zod";
import { tripNoteSchema } from "@/src/lib/trip-note";

export const tripIdeaSchema=z.object({
  name:z.string().trim().min(1).max(160),countryCode:z.string().length(2),locationIds:z.array(z.string().min(3).max(800)).min(1).max(20),
  kind:z.enum(["planned","someday"]),targetMonth:z.number().int().min(1).max(12).nullable(),targetYear:z.number().int().min(2020).max(2200).nullable(),
  note:tripNoteSchema.default(""),coverImageUrl:z.string().max(500).default("/travel-postcard-fallback.jpg"),
}).strict().superRefine((value,context)=>{
  if(Boolean(value.targetMonth)!==Boolean(value.targetYear)){context.addIssue({code:"custom",path:["targetMonth"],message:"กรุณาเลือกเดือนและปีให้ครบ"});return;}
  if(value.kind==="planned"&&(!value.targetMonth||!value.targetYear)){context.addIssue({code:"custom",path:["targetMonth"],message:"กรุณาเลือกเดือนและปี"});return;}
  if(value.kind!=="planned"||!value.targetYear)return;
  const currentYear=new Date().getFullYear();
  if(value.targetYear<currentYear||value.targetYear>currentYear+20)context.addIssue({code:"custom",path:["targetYear"],message:`เลือกปีได้ตั้งแต่ ${currentYear} ถึง ${currentYear+20}`});
});
