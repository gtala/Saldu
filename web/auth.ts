import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { setUserGoogleRefreshToken } from "@/lib/google-user-oauth-redis";

const googleAuthParams: Record<string, string> = {
  scope: [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    // `drive.file` solo ve archivos creados por la app o elegidos con el file picker;
    // copiar una plantilla compartida por ID requiere acceso amplio al Drive del usuario.
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ].join(" "),
  access_type: "offline",
  response_type: "code",
};

const promptConsent = process.env.AUTH_GOOGLE_PROMPT_CONSENT?.trim();
const scopeVersion = process.env.AUTH_GOOGLE_SCOPE_VERSION?.trim();
const forceNoPrompt =
  promptConsent === "0" || promptConsent?.toLowerCase() === "false";
// Sin `prompt=consent`, Google suele usar prompt=none y NO reenvía refresh_token al reloguear.
// Eso deja Redis sin token aunque el scope en la URL sea correcto (ver callback en logs).
if (
  !forceNoPrompt &&
  (promptConsent === "1" ||
    promptConsent?.toLowerCase() === "true" ||
    Boolean(scopeVersion))
) {
  googleAuthParams.prompt = "consent";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      authorization: {
        params: googleAuthParams,
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "google" && account.refresh_token) {
        const sub =
          (typeof token.sub === "string" && token.sub) ||
          (account.providerAccountId as string | undefined);
        if (sub) {
          await setUserGoogleRefreshToken(sub, account.refresh_token);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
