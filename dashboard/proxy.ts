// Next.js 16 renamed `middleware` to `proxy` (nodejs runtime). The NextAuth
// wrapper enforces the `authorized` callback in lib/auth.ts, redirecting
// unauthenticated visitors to /login on every matched route.
export { auth as proxy } from "@/lib/auth";

export const config = {
  // Run on everything except Next internals, the auth API, and static assets
  // (images, the widget loader .js, fonts). Public paths like /login and the
  // chatbot embeds are allowed through by the `authorized` callback.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|txt|xml|woff2?)$).*)",
  ],
};
