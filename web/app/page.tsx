import { DashboardShell } from "@/components/dashboard-shell";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/auth";
import { isMultiUserAuthEnabled } from "@/lib/auth-mode";
import { cn } from "@/lib/utils";

export default async function Home() {
  const multi = isMultiUserAuthEnabled();
  const session = multi ? await auth() : null;

  if (multi && !session?.user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saldu</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Iniciá sesión con Google para abrir tu planilla personal.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            const { signIn } = await import("@/auth");
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className={cn(buttonVariants({ size: "lg" }), "w-full justify-center")}
          >
            Entrar con Google
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Gastos y patrimonio
          </h1>
          <p className="text-muted-foreground text-sm">
            Tu resumen financiero personal
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {multi && session?.user ? (
            <form
              action={async () => {
                "use server";
                const { signOut } = await import("@/auth");
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Salir
              </button>
            </form>
          ) : null}
          <a
            href="https://github.com/gtala/Saldu"
            rel="noreferrer"
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Repo
          </a>
        </div>
      </header>

      <DashboardShell authMode={multi ? "multi" : "legacy"} />
    </div>
  );
}
