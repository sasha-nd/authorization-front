import { NextAuthOptions, Session, JWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    user: {
      sub?: string;
      given_name?: string;
      family_name?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone_number?: string | null;
      address?: string | null;
    };
  }

  interface JWT {
    accessToken?: string;
    idToken?: string;
    given_name?: string;
    family_name?: string;
    sub?: string;
    name?: string | null;
    phone_number?: string | null;
    address?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "nevis",
      name: "Nevis",
      type: "oauth",
      wellKnown: "https://login.national-digital.getnevis.net/.well-known/openid-configuration",
      clientId: process.env.NEVIS_CLIENT_ID!,
      clientSecret: process.env.NEVIS_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid profile email phone address",
          claims: {
            id_token: {
              given_name: null,
              family_name: null,
              email: null,
              sub: null,
              phone_number: null,
              address: null,
            },
          },
        },
      },
      checks: ["pkce", "state"],

      // Map provider profile to NextAuth user object
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? null,
          email: profile.email ?? null,
          sub: profile.sub ?? null,
          given_name: profile.given_name ?? null,
          family_name: profile.family_name ?? null,
          phone_number: profile.phone_number ?? null,
          address: profile.address ?? null,
        };
      },
    },
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // Attach access + id tokens
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
      }

      // Attach names and extra fields from user on first login
      if (user) {
        token.given_name = (user as any).given_name;
        token.family_name = (user as any).family_name;
        token.sub = (user as any).sub;
        token.phone_number = (user as any).phone_number;
        token.address = (user as any).address;
      }

      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      session.accessToken = token.accessToken;
      session.idToken = token.idToken;

      session.user = {
        ...session.user,
        sub: token.sub as string,
        name: token.name as string ?? `${token.given_name ?? ""} ${token.family_name ?? ""}`,
        given_name: token.given_name as string ?? "",
        family_name: token.family_name as string ?? "",
        phone_number: token.phone_number as string ?? "",
        address: token.address as string ?? "",
      };

      return session;
    },
  },
};