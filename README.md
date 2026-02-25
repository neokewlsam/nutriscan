# 🥗 NutriScan — AI-Powered Nutrition Tracker

Snap a meal photo → Get instant calorie count, weight estimate, macro breakdown, sugar spike prediction, insulin resistance risk, and personalized recommendations.

## Complete File List

```
nutriscan/
├── backend/
│   ├── main.py                  ← FastAPI server (all APIs)
│   ├── requirements.txt         ← Python dependencies
│   └── indian_meals_kb.json     ← Indian meal knowledge base (reference)
├── frontend/
│   └── App.jsx                  ← React app (all screens)
└── README.md                    ← This file
```

**That's it — 4 files to run the entire app.**

---

## Quick Start (5 minutes)

### Step 1: Start Backend

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Set your Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
# Windows: set ANTHROPIC_API_KEY=sk-ant-your-key-here

# Start server
uvicorn main:app --reload --port 8000
```

 Backend running at http://localhost:8000
 API docs at http://localhost:8000/docs

### Step 2: Start Frontend

```bash
# Create React app
npm create vite@latest nutriscan-ui -- --template react
cd nutriscan-ui

# Replace src/App.jsx with frontend/App.jsx
cp ../frontend/App.jsx src/App.jsx

# Run
npm install
npm run dev
```

✅ Frontend running at http://localhost:5173

### Step 3: Use the App

1. Open http://localhost:5173
2. Register with your profile (name, weight, height, health goal, conditions)
3. Go to Scan tab → snap/upload a meal photo
4. Get full analysis instantly

---

## What Each Meal Scan Returns

| Field | Description | Example |
|-------|-------------|---------|
| **meal_format** | Detected meal type | South Indian Mutt Bhojan on Patravali |
| **meal_name** | Descriptive name | Karnataka Temple Meal |
| **total_calories** | Total kcal | 695 |
| **total_weight_g** | Total meal weight in grams | 565 |
| **macros** | Protein, Carbs, Fat, Fiber (grams) | P:16g C:110g F:18g Fb:8g |
| **items** | Each detected item with name, portion, weight_g, calories | Puliyogare • ~150g • 210 cal |
| **sugar_spike** | Glycemic impact, peak mg/dL, time to peak, explanation | Moderate-High, ~145 mg/dL, 35 min |
| **insulin_resistance** | Risk level (low/moderate/high) + explanation | Moderate — rice heavy but offset by dal protein |
| **micronutrients** | Notable vitamins/minerals + what's lacking | Notable: B vitamins, Iron. Lacking: Calcium |
| **healthiness_score** | 1-10 rating | 7/10 |
| **recommendations** | Personalized improvement suggestions | Add more protein via extra dal serving |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Create account with profile |
| POST | `/api/login` | Sign in, get auth token |
| GET | `/api/profile` | Get user profile |
| PUT | `/api/profile` | Update profile |
| POST | `/api/meals/analyze` | Upload photo → AI analysis |
| GET | `/api/dashboard/today` | Today's meals + summary |
| GET | `/api/dashboard/history?days=7` | Daily summaries |
| GET | `/api/dashboard/meals` | Full meal history |
| GET | `/api/dashboard/stats` | Lifetime stats |

---

## Mobile App (PWA)

Add to `vite.config.js`:

```bash
npm install vite-plugin-pwa -D
```

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NutriScan',
        short_name: 'NutriScan',
        theme_color: '#0a0f1a',
        background_color: '#0a0f1a',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
```

Then on mobile: Open URL → Browser menu → "Add to Home Screen"

---

## Production Notes

| Concern | Development | Production |
|---------|-------------|------------|
| Database | SQLite (nutriscan.db) | PostgreSQL |
| Images | Truncated in DB | AWS S3 / GCS |
| Auth | Simple token | JWT + refresh tokens / Auth0 |
| API Key | In backend only | Secrets manager (never in frontend) |
| CORS | Allow all | Restrict to your domain |
| Rate Limit | None | Per-user limits on /meals/analyze |
| Hosting | localhost | Backend: Railway/Render, Frontend: Vercel |
