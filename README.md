This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

**Bourbonomics** — [Game rules](docs/GAME_RULES.md) and [web game plan](docs/WEB_GAME_PLAN.md) are in the repo.

### Rickhouses and Kentucky Bourbon Trail® regions

The six in-game rickhouses (`rickhouse-0` … `rickhouse-5`) are named for the six official **[Kentucky Bourbon Trail® regions](https://kybourbontrail.com/regions/)** (see also `lib/rickhouses.ts`):

| Id | Region |
|----|--------|
| `rickhouse-0` | Northern Region |
| `rickhouse-1` | Louisville Region |
| `rickhouse-2` | Central Region |
| `rickhouse-3` | Lexington Region |
| `rickhouse-4` | Bardstown Region |
| `rickhouse-5` | Western Region |

Capacities per slot are **3, 4, 5, 6, 4, 5** barrels (same index order as the table).

## Getting Started

### Run with SST (full game API + WebSocket)

```bash
npx sst dev
```

Then open the Next.js URL shown by SST. The API and WebSocket use `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.

### Run Next.js against your deployed SST backend

To run the frontend locally while using the API and WebSocket from a deployed stage (e.g. `dandango`):

1. Copy the env template and fill in your stage’s URLs:
   ```bash
   cp .env.example .env.local
   ```
2. Get the URLs from either:
   - **SST Console** — [Open your app](https://console.sst.dev/local/bourbonomics/dandango) → select your stage → **Outputs** (or the resource URLs for **Api** and **Ws**).
   - **Terminal** — Run `npx sst dev --stage dandango` once and note the **apiUrl** and **wsUrl** in the output (or in the Console link it prints).
3. Edit `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=https://xxxxxxxx.execute-api.REGION.amazonaws.com
   NEXT_PUBLIC_WS_URL=wss://xxxxxxxx.execute-api.REGION.amazonaws.com/dandango
   ```
   Use `https` for the API and `wss` for the WebSocket (same host, replace `https` with `wss`).
4. Start Next.js:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000); the app will use the API and WebSocket from your SST stage.

### Run Next.js only (no backend)

```bash
npm run dev
```

Without `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL`, the lobby and game pages will not be able to create or join games.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
