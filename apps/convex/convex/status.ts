import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getUserStatus = query({
  args: { userId: v.number() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("userSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const session = sessions.sort((a, b) => b._creationTime - a._creationTime)[0] ?? null;
    const lockdownEntries = await ctx.db.query("lockdown").collect();
    const lockdown = lockdownEntries[lockdownEntries.length - 1] ?? null;

    return {
      session,
      lockdown: lockdown?.isLocked ?? false,
    };
  },
});

export const getUser = query({
  args: { userId: v.number() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    return users.find((u) => u.id === args.userId) ?? null;
  },
});

export const updateSessionStatus = mutation({
  args: {
    sessionId: v.id("userSessions"),
    status: v.union(
      v.literal("active"),
      v.literal("parked"),
      v.literal("departing"),
      v.literal("exited"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { status: args.status });
    return { ok: true };
  },
});

export const createSession = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("userSessions", {
      userId: args.userId,
      userName: args.userName,
      status: args.status,
      slotCode: args.slotCode,
      slotId: args.slotId,
      assignedAt: args.assignedAt,
    });
    return { id, ...args };
  },
});

export const markDeparting = mutation({
  args: { sessionId: v.id("userSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { status: "departing" });
    return { ok: true };
  },
});

export const markParked = mutation({
  args: { sessionId: v.id("userSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { status: "parked" });
    return { ok: true };
  },
});

export const markExited = mutation({
  args: { sessionId: v.id("userSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { status: "exited" });
    return { ok: true };
  },
});

export const activateLockdown = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const entries = await ctx.db.query("lockdown").collect();
    const existing = entries[entries.length - 1] ?? null;

    if (existing) {
      await ctx.db.patch(existing._id, { isLocked: true, triggeredAt: now, resolvedAt: undefined });
    } else {
      await ctx.db.insert("lockdown", { isLocked: true, triggeredAt: now });
    }

    return { isLocked: true };
  },
});

export const deactivateLockdown = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const entries = await ctx.db.query("lockdown").collect();
    const existing = entries[entries.length - 1] ?? null;

    if (existing) {
      await ctx.db.patch(existing._id, { isLocked: false, resolvedAt: now });
    } else {
      await ctx.db.insert("lockdown", { isLocked: false, resolvedAt: now });
    }

    return { isLocked: false };
  },
});

// Create or update user
export const upsertUser = mutation({
  args: {
    id: v.optional(v.number()),
    name: v.string(),
    phone: v.string(),
    licenseNumber: v.string(),
    vehicleNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;

    if (id) {
      const existing = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("id"), id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { ...data, updatedAt: new Date().toISOString() });
        return { id, ...data };
      }
    }

    // Auto-increment id
    const users = await ctx.db.query("users").collect();
    const newId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;

    await ctx.db.insert("users", {
      id: newId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { id: newId, ...data };
  },
});
