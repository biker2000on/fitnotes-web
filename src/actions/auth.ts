'use server';

import { db } from '@/db';
import { users, categories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signIn } from '@/lib/auth';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Default categories to seed for new users
const defaultCategories = [
  { name: 'Shoulders', color: '#8E44AD' },
  { name: 'Triceps', color: '#27AE60' },
  { name: 'Biceps', color: '#F39C12' },
  { name: 'Chest', color: '#C0392B' },
  { name: 'Back', color: '#2980B9' },
  { name: 'Legs', color: '#55AA55' },
  { name: 'Abs', color: '#2C3E50' },
  { name: 'Cardio', color: '#7F8C8D' },
];

export async function register(data: unknown) {
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Validation failed' };
  }

  const { name, email, password } = parsed.data;

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return { error: 'Email already registered' };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const [user] = await db.insert(users).values({
    name,
    email,
    passwordHash,
  }).returning();

  if (!user) {
    return { error: 'Failed to create user' };
  }

  // Seed default categories
  await db.insert(categories).values(
    defaultCategories.map((cat, index) => ({
      userId: user.id,
      name: cat.name,
      color: cat.color,
      sortOrder: index,
    }))
  );

  // Auto sign in
  await signIn('credentials', { email, password, redirect: false });

  return { success: true };
}
