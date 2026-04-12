import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const getAllSlots = query({
  args: {},
  handler: async (ctx) => {
    const slots = await ctx.db.query("slotSensors").collect();
    return slots.sort((a, b) => a.sensorIndex - b.sensorIndex);
  },
});

export const updateAllSlots = mutation({
  args: {
    slots: v.array(
      v.object({
        slotId: v.number(),
        slotCode: v.string(),
        sensorIndex: v.number(),
        isOccupied: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const slot of args.slots) {
      const existing = await ctx.db
        .query("slotSensors")
        .withIndex("by_slot", (q) => q.eq("slotId", slot.slotId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { isOccupied: slot.isOccupied });
      } else {
        await ctx.db.insert("slotSensors", slot);
      }
    }
    return { ok: true };
  },
});
