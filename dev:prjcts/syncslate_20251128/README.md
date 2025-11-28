# SyncSlate AI

**SyncSlate AI** is a professional, browser-based digital slate and shot timing tool designed for filmmakers, content creators, and voice-over artists. It leverages Google Gemini AI for voice synthesis and provides a robust, zero-latency synchronization system for multi-device studio setups.

## 🚀 Key Features

*   **Precision Timeline:** Configurable duration and pre-roll with visual countdowns.
*   **AI Voice Synthesis:** Uses **Google Gemini 2.5 Flash** to generate custom voice cues ("Action", "Cut", numbers, and custom text) on the fly.
*   **Smart Cues:** Schedule text prompts to appear and be spoken at specific timestamps.
*   **Color Ranges:** Change the background color dynamically based on time to signal talent (e.g., Green for start, Red for wrap).
*   **Guest Mode (No Login Required):** Share a link to turn any tablet or phone into a synchronized slave display.
*   **Permission Management:** Guests can request control from the Host to manage the slate remotely.
*   **Multi-Language Support:** Auto-detects and supports English, Japanese, Chinese, French, German, Italian, Korean, and Hindi.

## 🔗 Sharing & Synchronization

SyncSlate is designed to be frictionless.

1.  **Host Mode:** The device that opens the app first acts as the Host.
2.  **Share:** Click "Share Link" to copy the URL or "Send via Email" to draft an invitation.
3.  **Guest Mode:** Any device opening the shared link enters Guest Mode immediately. **No login or account creation is required.**

### Technical Backing: Zero-Latency Synchronization

SyncSlate utilizes the **BroadcastChannel API** combined with a **Time-Reference Synchronization** architecture to achieve near-zero latency synchronization between tabs and windows.

*   **Absolute Time Reference (ATR):** Instead of streaming a "current time" value (which is subject to network jitter), the Host broadcasts a single `CMD_START` event containing a future-scheduled `startTime` (UTC timestamp + network buffer).
*   **Distributed Autonomous Execution:**
    *   **Host:** "I am starting the sequence at T=1000."
    *   **Client:** Receives message at T=950. Waits 50ms locally. At T=1000, it begins rendering frame 0.
    *   **Resilience:** Because every device calculates `currentFrame = Date.now() - startTime`, transient network lags do not cause the timer to drift. If a frame is dropped, the next frame automatically snaps to the correct absolute time.

### Audio Architecture (Production Note)

In the production environment, the audio system is designed with the following specifications:
*   **Individual Generation:** Countdown voices are generated one by one to ensure precision.
*   **Lightweight Data:** Audio assets are handled as small data files to minimize load.
*   **Pre-installed Voice:** The counting voice utilizes a pre-installed app voice model (via Gemini's Prebuilt Voice configuration) to ensure high-quality and consistent performance.

## 🛠️ Usage

### For Hosts
1.  Set the **Duration** and **Pre-Roll**.
2.  Add **Smart Cues** for script lines or direction.
3.  Click **"Load AI Voices"** to pre-generate audio using Gemini.
4.  Press **"START SLATE"**.

### For Guests
1.  Open the link provided by the Host.
2.  The screen will display "WAITING FOR HOST".
3.  When the Host starts, your screen will automatically sync.
4.  To control the slate, click the **Settings (Gear)** icon and select **"Request Control"**.

## 🏗️ Branding

**Powered by SyncSlate AI**
This application is a demonstration of modern web capabilities, combining Generative AI with real-time browser APIs to solve physical production problems without dedicated hardware.

---

## 🔮 Future Roadmap: Production Architecture

To scale this application from a browser-tab prototype to a field-ready production tool, the following architecture upgrades are planned:

### Phase 1: Cross-Device Synchronization (WebSocket)
Currently, `BroadcastChannel` limits sync to the same browser instance.
*   **Action:** Replace the communication layer with **Supabase Realtime** or **Firebase**.
*   **Logic:** The Host writes the `startTime` to a DB row; Clients subscribe to row changes.
*   **NTP Correction:** Implement a simple server-time offset calculation to sync PC (Host) and iPad (Client) clocks to within 50ms.

### Phase 2: Backend API & Security
*   **Action:** Move Google Gemini API calls to a serverless backend (e.g., Vercel Functions).
*   **Benefit:** Secure the `API_KEY` and implement rate limiting/caching for generated audio files.

### Phase 3: PWA & Offline-First
*   **Action:** Implement `vite-plugin-pwa` and Service Workers.
*   **Benefit:** Cache UI assets and generated audio. Allow the app to function in "Airplane Mode" once loaded, critical for remote shooting locations.

### Phase 4: Bundle Optimization
*   **Action:** Implement strict code splitting based on `VITE_APP_MODE=HOST` or `CLIENT`.
*   **Benefit:** The Client build will exclude all settings UI and configuration logic, resulting in an ultra-lightweight, high-performance bundle.

---

## 📐 Client App Specification (Design Prompt)

Use the following prompt to build the standalone "Client/Child" version of this application.

**Role:** Technical Architect
**Objective:** Create the "Slave Unit" for SyncSlate AI.

**Core Philosophy:**
The Client App is a pure "Render Node". It has **zero state authority**. It strictly visualizes the state broadcast by the Host. It must be extremely lightweight, URL-driven, and fail-safe.

**Requirements:**

1.  **No Configuration UI:**
    *   Remove all sliders, inputs, buttons, and toggle switches.
    *   The user cannot change Duration, Pre-roll, or Colors locally.
    *   *Exception:* A simple "Full Screen" button is allowed.

2.  **No Login / No Auth:**
    *   The app initializes immediately upon visiting the URL.
    *   It listens to `BroadcastChannel('sync-slate-v1')`.

3.  **Visual States:**
    *   **Standby (Idle):**
        *   Display: "WAITING FOR SIGNAL" or a large pulsing status icon.
        *   Visual: Subdued, professional, dark mode by default.
        *   Feedback: Must clearly indicate it is connected to the channel.
    *   **Armed (Buffer Period):**
        *   Triggered when `CMD_START` is received but `Date.now() < payload.startTime`.
        *   Display: "ARMED" or "STANDBY" in Yellow/Amber.
    *   **Running (Action):**
        *   Display: Large, high-contrast countdown/text.
        *   Logic: Renders frame based on `Math.floor((Date.now() - startTime) / 1000)`.
    *   **Ended (Cut):**
        *   Display: "CUT" in Red.

4.  **Technical Implementation:**
    *   **Sync Logic:** Use the exact same `tick` logic as the Host to ensure frame-perfect matching.
    *   **State Hydration:** On load, listen for `SYNC_STATE` to apply the Host's color theme and fonts immediately.

5.  **URL Behavior:**
    *   `?role=client` is implied by default.
    *   `?view=simple` could force a high-contrast OLED saver mode.

**Prompt for AI Generation:**
> "Build a React-based 'Slave Display' application for SyncSlate. It should have NO controls. It listens to a BroadcastChannel named 'sync-slate-v1'. When it receives a 'CMD_START' event with a 'startTime', it begins a requestAnimationFrame loop. It calculates time as (Date.now() - startTime). If time is negative, show 'ARMED'. If positive, show the elapsed seconds. It must support a 'SYNC_STATE' event to update its background colors and max duration from the Host. UI must be minimal: just the giant text in the center."