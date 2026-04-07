# Saldu (Next.js)

Stack **opción B**: Tailwind CSS v4, shadcn/ui (Base UI), Recharts, `next/font`.

## Desarrollo

```bash
cd web
npm install
npm run dev
```

Abre [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Componentes shadcn

```bash
npx shadcn@latest add dialog
```

## Notas

- Tema oscuro por defecto (`className="dark"` en `app/layout.tsx`).
- Variables de entorno de Sheets / API viven en la raíz del monorepo (`../.env`) cuando conectemos datos reales.
