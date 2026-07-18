import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/** Server-side API base (mirrors lib/dashboard.ts). */
const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

/** Paths served to the public — never gated behind the login. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    // The embeddable widget + iframe run on clients' sites, anonymously.
    pathname.startsWith("/embed") ||
    pathname.includes("/embed")
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      // Credentials are verified by the backend against the users table; only
      // admin-provisioned accounts return a user. Anything else → null → denied.
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        try {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) return null;
          const data = (await res.json()) as {
            user?: { id: string; email: string; name: string | null };
          };
          if (!data.user) return null;
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? undefined,
          };
        } catch {
          // Backend unreachable → treat as failed sign-in rather than crash.
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // Used by the proxy (middleware) wrapper to gate every matched route.
    authorized({ request, auth }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return Boolean(auth?.user);
    },
  },
});
