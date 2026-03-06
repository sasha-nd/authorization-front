import { NextAuthOptions, Session, JWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    scopes?: string[];
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
    scopes?: string[];
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
          scope: "openid profile email phone address roles",
          claims: {
            id_token: {
              given_name: null,
              family_name: null,
              email: null,
              sub: null,
              phone_number: null,
              address: null,
              secrole: null,
              role: null,
              roles: null,
              "ch.adnovum.nevis.roles": null,
              "urn:nevis:roles": null,
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

  pages: {
    signIn: "/",
    signOut: "/",
    error: "/",
  },

  events: {
    async signOut({ token }) {
      // Revoke tokens at Nevis when user signs out
      if (token?.accessToken) {
        try {
          const revokeEndpoint = "https://login.national-digital.getnevis.net/oauth/revoke";
          const clientId = process.env.NEVIS_CLIENT_ID;
          const clientSecret = process.env.NEVIS_CLIENT_SECRET;
          
          if (clientId && clientSecret) {
            await fetch(revokeEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
              },
              body: new URLSearchParams({
                token: token.accessToken as string,
                token_type_hint: "access_token",
              }),
            });
            console.log("[authOptions] ✅ Token revoked on signOut");
          }
        } catch (error) {
          console.error("[authOptions] Error revoking token on signOut:", error);
        }
      }
    },
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // Attach access + id tokens
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        
        console.log("[authOptions] ========== TOKEN DUMP ==========");
        console.log("[authOptions] Access Token:", account.access_token);
        console.log("[authOptions] ID Token:", account.id_token);
        console.log("[authOptions] ===================================");

        // Extract scopes/roles from the access token or id token payload.
        // Nevis puts granted scopes in the access_token and may put roles
        // in the id_token under "scope", "roles", or "groups".
        try {
          const { jwtDecode } = await import("jwt-decode");

          let decodedAccess: any = {};
          let decodedId: any = {};

          if (account.access_token) {
            decodedAccess = jwtDecode(account.access_token);
            console.log("[authOptions] decoded Access token:", JSON.stringify(decodedAccess, null, 2));
          }
          if (account.id_token) {
            decodedId = jwtDecode(account.id_token);
            console.log("[authOptions] decoded ID token:", JSON.stringify(decodedId, null, 2));
          }

          // Primary source: account.scope (the granted scopes from the token response).
          // Nevis lists "support" here for users that have the support role.
          // Fall back to the scope claim inside the access_token or ID token.
          const combined = { ...decodedId, ...decodedAccess };
          
          // Extract roles from nevisAuth session variable: ${sess:ch.nevis.session.secroles}
          // This is configured in the Authorization Server to include user roles in tokens.
          // The secroles claim contains a comma-separated list like: "Main,nevisIdm.SelfAdmin,support.support"
          const nevisRoles = combined["urn:nevis:roles"] ?? decodedId["urn:nevis:roles"] ?? [];
          const secrolesRaw = combined["secroles"] ?? decodedAccess["secroles"] ?? "";
          
          console.log("[authOptions] urn:nevis:roles claim:", nevisRoles);
          console.log("[authOptions] secroles claim:", secrolesRaw);
          
          // Parse secroles: comma-separated string → array
          const secrolesArray: string[] = typeof secrolesRaw === "string" && secrolesRaw
            ? secrolesRaw.split(",").map(r => r.trim()).filter(Boolean)
            : [];
          
          // Combine both role sources
          const allRoles = Array.isArray(nevisRoles) ? [...nevisRoles, ...secrolesArray] : secrolesArray;
          
          // Extract role names from "app.role" format (e.g., "support.support" → "support")
          const extractedRoles: string[] = allRoles
            .map((roleStr: string) => {
              const parts = roleStr.split(".");
              return parts.length > 1 ? parts[parts.length - 1] : roleStr;
            })
            .filter(Boolean);
          
          console.log("[authOptions] Extracted roles from all sources:", extractedRoles);
          
          // Check for legacy role/secrole claims (fallback)
          const secRole = combined.secrole ?? 
                          decodedId.secrole ?? 
                          combined["ch.adnovum.nevis.roles"] ?? 
                          decodedId["ch.adnovum.nevis.roles"] ??
                          combined.role ??
                          decodedId.role;
          
          const rawScope: string | string[] =
            account.scope ??
            combined.scope ??
            combined.scopes ??
            combined.roles ??
            combined.groups ??
            combined.authorities ??
            secRole ??
            "";

          let tokenScopes: string[] = typeof rawScope === "string"
            ? rawScope.split(" ").filter(Boolean)
            : (rawScope as string[]);
          
          // Merge extracted roles into tokenScopes
          tokenScopes = [...new Set([...tokenScopes, ...extractedRoles])];
          
          console.log("[authOptions] Legacy secrole claim:", secRole);
          console.log("[authOptions] All access token claims:", Object.keys(decodedAccess));
          console.log("[authOptions] All ID token claims:", Object.keys(decodedId));
          console.log("[authOptions] Initial tokenScopes after role extraction:", tokenScopes);

          // Also call the userinfo endpoint with the access_token — Nevis may
          // include role/scope claims there that are not in the JWT itself.
          if (account.access_token) {
            try {
              const userInfoRes = await fetch(
                "https://login.national-digital.getnevis.net/oauth/userinfo",
                {
                  headers: {
                    Authorization: `Bearer ${account.access_token}`,
                    Accept: "application/json",
                  },
                }
              );
              if (userInfoRes.ok) {
                const userInfo = await userInfoRes.json();
                console.log("[authOptions] userinfo response:", JSON.stringify(userInfo));
                // Nevis may return roles/scopes as extra claims in userinfo
                const extraRaw: string | string[] =
                  userInfo.roles ??
                  userInfo.groups ??
                  userInfo.scope ??
                  userInfo.scopes ??
                  userInfo["https://national-digital.getnevis.net/roles"] ??
                  "";
                const extraScopes: string[] = typeof extraRaw === "string"
                  ? extraRaw.split(" ").filter(Boolean)
                  : (extraRaw as string[]);
                tokenScopes = [...new Set([...tokenScopes, ...extraScopes])];
              } else {
                console.warn("[authOptions] userinfo fetch failed:", userInfoRes.status);
              }
            } catch (uiErr) {
              console.warn("[authOptions] userinfo fetch error:", uiErr);
            }
          }

          // The Nevis token only contains OIDC scopes (openid, profile, …).
          // Roles are stored in NevisIDM and must be fetched separately.
          const profileId = combined["ch.adnovum.nevisidm.profileId"] ?? combined["urn:nevis:profile_id"];
          const clientExtId = process.env.NEVI_IDM_CLIENT_EXTID;
          const idmToken = process.env.NEVI_IDM_TOKEN ?? process.env.NEVIS_IDM_TOKEN ?? process.env.NEVIS_API_KEY;

          if (profileId && clientExtId && idmToken) {
            try {
              const idmRes = await fetch(
                `https://api.national-digital.getnevis.net/nevisidm/api/core/v1/${clientExtId}/users/${profileId}/roles`,
                {
                  headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${idmToken}`,
                  },
                }
              );
              if (idmRes.ok) {
                const idmData = await idmRes.json();
                // NevisIDM returns an array of role objects with a "name" or "extId" field
                const roles: string[] = (Array.isArray(idmData) ? idmData : idmData.roles ?? idmData.items ?? [])
                  .map((r: any) => (r.name ?? r.extId ?? r.id ?? "").toLowerCase())
                  .filter(Boolean);
                console.log("[authOptions] IDM roles for", profileId, ":", roles);
                // Merge IDM roles into scopes so session.scopes contains them
                tokenScopes = [...new Set([...tokenScopes, ...roles])];
              } else {
                console.warn("[authOptions] IDM roles fetch failed:", idmRes.status, await idmRes.text());
              }
            } catch (idmErr) {
              console.warn("[authOptions] IDM roles fetch error:", idmErr);
            }
          }

          token.scopes = tokenScopes;
          console.log("[authOptions] ✅ Final resolved scopes/roles:", token.scopes);
        } catch (e) {
          console.error("[authOptions] failed to decode token:", e);
          token.scopes = (account.scope ?? "").split(" ").filter(Boolean);
        }
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
      session.scopes = token.scopes ?? [];

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