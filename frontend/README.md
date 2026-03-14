# 🛡️ Cradle Guard

A React + TypeScript baby safety monitor powered by the **Gemini Vision API**. Point a camera at a room, detect hazards, define dangerous actions, and get alerted in real time.

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 18, TypeScript, Vite        |
| Styling   | Tailwind CSS, Framer Motion       |
| AI        | Google Gemini 1.5 Flash (Vision)  |
| Camera    | WebRTC `getUserMedia`             |
| Routing   | React Router v6                   |
| Toasts    | react-hot-toast                   |

---

## Getting Started

### 1. Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier works)

### 2. Install dependencies

```bash
cd cradle-guard
npm install
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for production

```bash
npm run build
npm run preview
```

---

## How to Use

### Step 01 — Room Setup
1. Enter your **Gemini API key** in the input field (used only in your browser, never sent to any server other than Google's)
2. Click **Start Camera** — allow camera permissions when prompted
3. Point the camera at the room where your baby will be
4. Click **Scan Room** — Gemini Vision analyses the frame and returns a list of detected hazards with severity ratings

### Step 02 — Dangerous Actions
1. Click **Generate** to have Gemini create a list of specific dangerous scenarios based on the hazards found (e.g. "Baby pulls lamp off nightstand")
2. Toggle actions on/off using the toggle switches
3. Add your own custom alerts in the input box (e.g. "baby touches the lamp")
4. Remove any actions you don't want

### Step 03 — Alert Settings
1. Choose one or more **notification methods**:
   - **Push Notification** — browser notification to your device
   - **Sound Alarm** — plays an audio beep through your speakers
   - **Email Alert** — enter your email (you'll need a backend/service like EmailJS to actually send)
   - **SMS / Text** — enter your phone number (requires Twilio or similar)
2. Set **Detection Sensitivity** (Low / Medium / High)
3. Click **Activate Monitor**

### Monitor Screen
- Live camera feed with a real-time scan line
- Gemini checks a frame every **8 seconds**
- Any triggered danger actions appear as alerts
- All events are logged with timestamps
- Click **Stop Monitoring** to return to settings

---

## Project Structure

```
cradle-guard/
├── src/
│   ├── api/
│   │   └── gemini.ts          # All Gemini API calls
│   ├── components/
│   │   ├── OceanBackground.tsx
│   │   └── PageHeader.tsx
│   ├── context/
│   │   └── AppContext.tsx      # Global state
│   ├── hooks/
│   │   └── useCamera.ts        # WebRTC camera hook
│   ├── pages/
│   │   ├── Home.tsx            # Main menu
│   │   ├── Setup.tsx           # Camera + hazard scan
│   │   ├── Actions.tsx         # Dangerous actions
│   │   ├── Alerts.tsx          # Alert settings
│   │   └── Monitor.tsx         # Live monitoring
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

---

## Deploying to Raspberry Pi

Cradle Guard is a pure frontend app — no server needed. To run it on a Raspberry Pi:

```bash
# On your dev machine
npm run build

# Copy the dist/ folder to your Pi
scp -r dist/ pi@raspberrypi.local:~/cradle-guard

# On the Pi — serve with any static server
npx serve dist
# or
python3 -m http.server 3000 --directory dist
```

Then open a browser on the Pi (or from another device on the same network) at `http://raspberrypi.local:3000`.

> **Tip:** For best results on a Pi camera, set `facingMode: 'environment'` (already configured in `useCamera.ts`).

---

## Notes

- Your Gemini API key is **never stored** — it lives only in React state and is cleared on page refresh
- The monitor checks one frame every 8 seconds to stay within free API rate limits — adjust `INTERVAL_MS` in `Monitor.tsx` to change this
- Email and SMS alerts are UI-only in this version; wire them up to [EmailJS](https://www.emailjs.com/) or [Twilio](https://www.twilio.com/) to fully activate
