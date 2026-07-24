import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { TelegramVerifiedUser } from "@/lib/telegram/verify";

export interface UpsertUserInput {
  telegramUser: TelegramVerifiedUser;
  timezone: string;
}

/**
 * Creates the user on first login, or updates the profile fields Telegram
 * may have changed (username, name, photo) on subsequent logins.
 *
 * The user's own chosen timezone (if already set via /api/settings) is
 * intentionally NOT overwritten here on every login — only set on create,
 * or when explicitly missing.
 */
export async function upsertUserFromTelegram(input: UpsertUserInput) {
  const { telegramUser, timezone } = input;

  const user = await prisma.user.upsert({
    where: { telegramId: telegramUser.id },
    create: {
      telegramId: telegramUser.id,
      username: telegramUser.username,
      firstName: telegramUser.firstName,
      lastName: telegramUser.lastName,
      languageCode: telegramUser.languageCode,
      photoUrl: telegramUser.photoUrl,
      timezone,
      lastLoginAt: new Date(),
      settings: {
        create: {
          language: telegramUser.languageCode === "en" ? "en" : "ru",
          timezone,
        },
      },
      resourceBalance: { create: {} },
    },
    update: {
      username: telegramUser.username,
      firstName: telegramUser.firstName,
      lastName: telegramUser.lastName,
      languageCode: telegramUser.languageCode,
      photoUrl: telegramUser.photoUrl,
      lastLoginAt: new Date(),
    },
  });

  return user;
}

export async function findUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}
