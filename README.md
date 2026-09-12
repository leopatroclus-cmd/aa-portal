# AA Portal

Aero Africa Operations Portal — internal dashboard with two sections:

- **Agent Network** — global agent directory (Global + Africa tabs, filterable by country/city/primary)
- **BU Report** — monthly financial dashboard for all Aero Africa business units (FYE 2026)

## Setup

```bash
npm install
cp .env.local.example .env.local
# Add your Google API key to .env.local
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Google Sheets API key (read-only access to the AA sheets) |

## Data Sources

- **Agent Network**: Google Sheet `10wxWr6jsmn7n7gSPfQpbJvH8OXEPR9AZv7IgxnIdbPk`
- **BU Report**: Google Sheet `1rL0tyudLrOlRZN03oj8BLoMdsRpCxePb6DxTJ4w3_oc`

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add `GOOGLE_API_KEY` environment variable
4. Deploy

Both pages are server-rendered on demand — data is always fresh.
