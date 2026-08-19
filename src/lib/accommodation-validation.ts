import { z } from "zod";

const nightDescriptionsSchema = z
  .record(z.string().regex(/^\d+$/), z.string().trim().max(2000))
  .refine((value) => Object.keys(value).length <= 32)
  .default({});

export const accommodationSchema = z.object({
  name: z.string().trim().min(1).max(180),
  location: z.string().trim().max(1000).default(""),
  description: z.string().trim().max(2000).default(""),
  nightDescriptions: nightDescriptionsSchema,
  checkInDay: z.number().int().min(1),
  checkOutDay: z.number().int().min(2),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  foreignAmount: z.number().nonnegative(),
  currency: z.string().length(3),
  exchangeRate: z.number().positive(),
  rateDate: z.preprocess(
    (value) => typeof value === "string" ? value.slice(0, 10) : value,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ),
  paymentMethod: z.string().trim().min(1).max(260),
  creditCardId: z.string().uuid().nullable().optional(),
  paymentOwnerName: z.string().max(120).nullable().optional(),
  splitMemberIds: z.array(z.string().uuid()).max(20),
}).superRefine((value, context) => {
  const invalidDay = Object.keys(value.nightDescriptions).some((day) => {
    const dayNumber = Number(day);
    return dayNumber < value.checkInDay || dayNumber >= value.checkOutDay;
  });
  if (invalidDay) {
    context.addIssue({
      code: "custom",
      path: ["nightDescriptions"],
      message: "รายละเอียดรายวันอยู่นอกช่วงวันที่พัก",
    });
  }
});
