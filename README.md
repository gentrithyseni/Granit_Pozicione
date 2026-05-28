# Graniti Web

Panel administrativ për menaxhimin e **paramasave dhe ofertave** të ndërtimit: regjistrim manual i pozicioneve, import Excel, shfletim dhe kërkim të të dhënave.

## Stack

- React 18 + TypeScript + Vite 6
- React Router 6
- Supabase (PostgreSQL + Auth + RLS)
- react-hook-form, xlsx, lucide-react

## Kërkesat

- Node.js 18+
- Llogari [Supabase](https://supabase.com) (projekt i ri ose ekzistues)

## Instalimi

```bash
npm install
cp .env.example .env
```

Plotëso `.env` me URL dhe anon key nga Supabase → **Settings → API**.

## Baza e të dhënave

1. Hap **SQL Editor** në Supabase Dashboard.
2. Ekzekuto skedarin [`database-schema.sql`](database-schema.sql) (tabelat + RLS).
3. Në **Authentication → Providers**, aktivizo **Email** (password).
4. Krijo përdoruesin e parë: **Authentication → Users → Add user** (email + fjalëkalim).

Politikat RLS lejojnë vetëm përdorues të **autentifikuar** (`authenticated`).

## Nisja lokale

```bash
npm run dev
```

Hap `http://localhost:5173` — hyr me email/fjalëkalim në `/login`.

## Skriptet

| Komanda | Përshkrim |
|---------|-----------|
| `npm run dev` | Server zhvillimi |
| `npm run build` | Build prod (`dist/`) |
| `npm run preview` | Preview i build-it |

## Struktura e projektit

```
App.tsx                 # Router kryesor
src/
  pages/                # Faqet e aplikacionit
  components/           # Shell, ProtectedRoute, ...
  context/              # Auth, Theme
  services/             # Thirrje Supabase
  lib/                  # supabase client, excel parser
  constants/            # Opsione transporti
database-schema.sql     # Skema PostgreSQL
```

## Faqet

| Rruga | Funksioni |
|-------|-----------|
| `/` | Ballina — statistika |
| `/register` | Regjistrim pozicioni me kostot |
| `/import` | Ngarkim Excel + undo |
| `/data` | Projektet, kategoritë, edit, CSV |
| `/search` | Kërkim global në pozicione |
| `/profile` | Profili dhe dalje |
| `/login` | Hyrje |

## Shënim sigurie

Mos commit-o `.env`. Çelësi `anon` është publik në frontend; mbrojtja vjen nga **Auth + RLS**, jo nga fshehja e key-it.
