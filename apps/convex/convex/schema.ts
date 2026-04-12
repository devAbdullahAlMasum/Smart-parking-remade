import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    id: v.number(),
    name: v.string(),
    phone: v.string(),
    licenseNumber: v.string(),
    vehicleNumber: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  userSessions: defineTable({
    userId: v.number(),
    userName: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("parked"),
      v.literal("departing"),
      v.literal("exited"),
    ),
    slotCode: v.string(),
    slotId: v.number(),
    assignedAt: v.string(),
  }).index("by_user", ["userId"]),

  displayState: defineTable({
    mode: v.string(),
    title: v.string(),
    subtitle: v.string(),
    qrValue: v.optional(v.string()),
    assignedSlotCode: v.optional(v.string()),
    locationId: v.optional(v.number()),
    updatedAt: v.string(),
  }),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  lockdown: defineTable({
    isLocked: v.boolean(),
    triggeredAt: v.optional(v.string()),
    resolvedAt: v.optional(v.string()),
  }),

  slotSensors: defineTable({
    slotId: v.number(),
    slotCode: v.string(),
    isOccupied: v.boolean(),
    sensorIndex: v.number(),
  }).index("by_slot", ["slotId"]),
});
