import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAllSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").collect();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  },
});

export const getSetting = query({
  args: { key: v.string(), defaultValue: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return setting?.value ?? args.defaultValue;
  },
});

export const updateSetting = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: args.value });
    }

    return { ok: true };
  },
});

export const initSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("settings").collect();
    if (existing.length === 0) {
      await ctx.db.insert("settings", { key: "display_timeout_seconds", value: "30" });
      await ctx.db.insert("settings", { key: "gate_open_seconds", value: "5" });
      await ctx.db.insert("settings", { key: "parked_delay_seconds", value: "120" });
    }
    return { ok: true };
  },
});
