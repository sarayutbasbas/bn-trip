import { z } from "zod";
import { safeBookingUrl } from "./booking-url";
import { expensePayerSchema } from "./expense-payer-validation";

const nightDescriptionsSchema = z
  .record(z.string().regex(/^\d+$/), z.string().trim().max(2000))
  .refine((value) => Object.keys(value).length <= 32)
  .default({});

const nightBedtimesSchema = z
  .record(
    z.string().regex(/^\d+$/),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  )
  .refine((value) => Object.keys(value).length <= 32)
  .default({});

export const accommodationSchema = z.object({
  name: z.string().trim().min(1).max(180),
  location: z.string().trim().max(1000).default(""),
  bookingUrl: z.string().trim().max(2000).refine(value => !value || Boolean(safeBookingUrl(value)), "กรุณาใส่ลิงก์ที่พักแบบ https:// หรือ http://").default(""),
  paidBy: expensePayerSchema.nullable().optional(),
  splitGuestIds: z.array(z.string().uuid()).max(100).default([]),
  bookingPlatform: z
    .enum(["agoda", "trip.com", "booking.com", "klook", "traveloka", "direct"])
    .or(z.literal(""))
    .default(""),
  includesBreakfast: z.boolean().default(false),
  paymentStatus: z.enum(["paid", "pending"]).optional(),
  paymentDate: z.string().date().optional(),
  breakfastDays: z.array(z.number().int()).max(32).optional(),
  sourceAccommodationId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().trim().max(2000).nullable().default(null),
  description: z.string().trim().max(2000).default(""),
  nightDescriptions: nightDescriptionsSchema,
  nightBedtimes: nightBedtimesSchema,
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
  if (!value.paymentDate && !value.paymentStatus) context.addIssue({code:"custom",path:["paymentDate"],message:"กรุณาเลือกวันที่จ่ายเงิน"});
  if (value.breakfastDays?.some(day => day <= value.checkInDay || day > value.checkOutDay)) {
    context.addIssue({code:"custom",path:["breakfastDays"],message:"วันอาหารเช้าต้องอยู่หลังคืนที่พักและไม่เกินวันเช็กเอาต์"});
  }
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
  const invalidBedtimeDay = Object.keys(value.nightBedtimes).some((day) => {
    const dayNumber = Number(day);
    return dayNumber < value.checkInDay || dayNumber >= value.checkOutDay;
  });
  if (invalidBedtimeDay) {
    context.addIssue({
      code: "custom",
      path: ["nightBedtimes"],
      message: "เวลานอนรายวันอยู่นอกช่วงวันที่พัก",
    });
  }
});
