import { MonthlySpendChart } from "@/components/monthly-spend-chart";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Saldu
          </h1>
          <p className="text-muted-foreground text-sm">
            Next.js + Tailwind v4 + shadcn + Recharts · datos vía{" "}
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

      <Tabs defaultValue="gastos" className="gap-4">
        <TabsList className="w-full max-w-md" variant="line">
          <TabsTrigger value="patrimonio">Patrimonio</TabsTrigger>
          <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
        </TabsList>
        <TabsContent value="patrimonio" className="text-muted-foreground text-sm">
          Placeholder: evolución de snapshots (Recharts / D3) — migración desde{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">server.js</code>.
        </TabsContent>
        <TabsContent value="ingresos" className="text-muted-foreground text-sm">
          Placeholder: barras por categoría de ingreso.
        </TabsContent>
        <TabsContent value="gastos" className="flex flex-col gap-3">
          <MonthlySpendChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}
