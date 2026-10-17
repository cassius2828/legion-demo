import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { env } from "~/env";
import { saveGoogleOAuthTokens } from "~/server/auth/google-account";
import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface User {
    role?: string | null;
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      role: string | null;
    } & DefaultSession["user"];
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" "),
        },
      },
    }),
  ],
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      const userId = user?.id ?? (typeof token.id === "string" ? token.id : token.sub);
      if (!userId) return token;
      const row = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      });
      if (!row) return token;
      token.id = row.id;
      token.name = row.name;
      token.email = row.email;
      token.role = row.role;
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: typeof token.id === "string" ? token.id : "",
        role: typeof token.role === "string" ? token.role : null,
        name: typeof token.name === "string" ? token.name : session.user.name,
        email: typeof token.email === "string" ? token.email : session.user.email,
      },
    }),
  },
  events: {
    async signIn({ user, account }) {
      if (!user.id || account?.provider !== "google" || !account.providerAccountId) {
        return;
      }
      await saveGoogleOAuthTokens({
        userId: user.id,
        providerAccountId: account.providerAccountId,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
      });
    },
  },
} satisfies NextAuthConfig;
