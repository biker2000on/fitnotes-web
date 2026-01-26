'use server';

import { db } from '@/db';
import { userSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';

export async function getUserSettings() {
  const user = await requireAuth();

  let settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, user.id),
  });

  // Create default settings if none exist
  if (!settings) {
    const [newSettings] = await db.insert(userSettings).values({
      userId: user.id,
    }).returning();
    settings = newSettings;
  }

  return settings;
}
