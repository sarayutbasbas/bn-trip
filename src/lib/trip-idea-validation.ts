import { z } from "zod";

export const tripIdeaSchema=z.object({
  name:z.string().trim().min(1).max(160),countryCode:z.string().length(2),locationIds:z.array(z.string().min(3).max(800)).min(1).max(20),
  kind:z.enum(["planned","someday"]),targetMonth:z.number().int().min(1).max(12).nullable(),targetYear:z.number().int().min(2020).max(2200).nullable(),
  note:z.string().trim().max(500).default(""),coverImageUrl:z.string().max(500).default("/travel-postcard-fallback.jpg"),
}).strict().superRefine((value,context)=>{if(value.kind==="planned"&&(!value.targetMonth||!value.targetYear))context.addIssue({code:"custom",path:["targetMonth"],message:"กรุณาเลือกเดือนและปี"})});
