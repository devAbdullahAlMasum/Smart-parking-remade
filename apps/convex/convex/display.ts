import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getDisplayState = query({
  args: {},
  handler: async (ctx) => {
    const display = await ctx.db.query("displayState").first();
    return display ?? null;
  },
});

export const setDisplayState = mutation({
  args: {
    mode: v.string(),
    title: v.string(),
    subtitle: v.string(),
    qrValue: v.optional(v.string()),
    assignedSlotCode: v.optional(v.string()),
    locationId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("displayState").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: new Date().toISOString(),
      });
      return existing._id;
    }

    return ctx.db.insert("displayState", {
      ...args,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const resetDisplayToIdle = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("displayState").first();
    const idleState = {
      mode: "idle",
      title: "Waiting for car",
      subtitle: "Drive to the gate to start parking.",
      qrValue: undefined,
      assignedSlotCode: undefined,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, idleState);
    } else {
      await ctx.db.insert("displayState", idleState);
    }
    return { ok: true };
  },
});
