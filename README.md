# VKU Field Survey

A modern, high-performance web and mobile application designed for conducting field surveys of facilities and equipment at Vietnam - Korea University of Information and Communication Technology (VKU). 

Built with an **Offline-First** mindset to handle unreliable network conditions, ensuring surveyors never lose data.

## 🚀 Key Features

*   **Edge-to-Edge UI**: Fully utilizes screen space, adapting elegantly to iOS and Android notches using safe-area configurations and Capacitor v8+.
*   **3D Facility Viewer**: Features a hardware-accelerated 3D environment via React Three Fiber to visualize building layouts. Implements graceful fallback to 2D when WebGL context is lost to save RAM.
*   **Native Camera Integration**: Directly utilizes device cameras via `@capacitor/camera` and handles high-resolution images efficiently by converting them to `Blob` objects, preventing Out-Of-Memory (OOM) crashes.
*   **Offline Background Sync**: Automatically detects internet connectivity and securely batches pending survey forms (including images) to a remote backend (e.g., Cloudflare Workers/Hono) without blocking the main UI thread.
*   **Deadlock Recovery**: Implements an optimistic locking mechanism for IndexedDB records with an auto-recovery feature that unlocks stuck synchronization transactions after 5 minutes on app restart.

## 🛠️ Technology Stack

*   **Frontend Framework**: React (TypeScript) via Vite for rapid development.
*   **State Management**: Zustand for lightweight, boilerplate-free global state (`NetworkStore` and `FormStore`).
*   **UI/CSS**: TailwindCSS with custom plugins for dynamic safe-area insets.
*   **3D Graphics**: `react-three-fiber` and `@react-three/drei` (with `frameloop="demand"` for extreme performance).
*   **Local Database**: IndexedDB (via `idb` wrapper) for storing draft forms as `PENDING_SYNC`.
*   **Mobile Engine**: Capacitor (v8.3.2+) for native device access (Camera, Network, StatusBar).

## 📁 Architecture

The project strictly follows the **Feature-Sliced Design (FSD)** methodology:
*   `app/`: Global providers, routers, and application initialization.
*   `processes/`: Complex cross-feature workflows (e.g., Background Sync).
*   `pages/`: Route components.
*   `widgets/`: High-level composed UI (SurveyForm, 3DViewerWidget).
*   `features/`: User interaction logic (TakePhoto).
*   `entities/`: Business data models and Zustand stores (Network, Survey).
*   `shared/`: Reusable utilities, API configs, and DB wrappers.

## ⚙️ How to Run

### Prerequisites
*   Node.js (v18+)
*   Android Studio (for Pixel 8 simulation)

### Installation

1. Install Node modules:
```bash
npm install
```

2. Run development server (Web Browser):
```bash
npm run dev
```

### Mobile Deployment (Android)

1. Build the React web assets:
```bash
npm run build
```

2. Sync the web assets into the Capacitor Android project:
```bash
npx cap sync android
```

3. Open in Android Studio to test on a Pixel 8 Simulator:
```bash
npx cap open android
```
*(Alternatively, run `npx cap run android` if an emulator is already running).*

## 🔒 License
Proprietary. VKU Internal Use Only.
