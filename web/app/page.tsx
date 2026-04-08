import { DashboardShell } from "@/components/dashboard-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Gastos y patrimonio
          </h1>
          <p className="text-muted-foreground text-sm">
            Saldu · Next.js + Tailwind + shadcn + D3 treemap ·{" "}
            <code className="bg-muted rounded px-1 text-xs">/api/data</code>
          </p>
        </div>
        <a
          href="https://github.com/gtala/Saldu"
          rel="noreferrer"
          target="_blank"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Repo
        </a>
      </header>

      <DashboardShell />
    </div>
  );
}
