# VibeDrive: Open World Ambient Driving Simulator

VibeDrive is a premium, immersive, and relaxing 3D ambient driving simulator built with Three.js and the Web Audio API. Cruise through gorgeous scenic presets or generate dynamic roads anywhere in the world using OpenStreetMap integration.

---

## 🚀 How to Launch the Site

Since this project uses ES modules, dynamic asset loading, and Three.js dependencies, **it cannot be run by simply opening `index.html` in your browser**. It requires a local development server.

Follow these simple steps to get the simulator running:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your computer.

### Step 1: Install Dependencies
Open your terminal (PowerShell, Command Prompt, or bash) in the project's root directory and run:
```bash
npm install
```
*(Note: If the `node_modules` folder is already present, you can skip this step, but running it is a safe way to ensure everything is correct.)*

### Step 2: Start the Development Server
Run the following command to start the Vite dev server:
```bash
npm run dev
```

### Step 3: Open the Simulator
Once the server starts, it will display a local address (usually `http://localhost:5173/`).
- **Control + Click** the link in your terminal, or
- Copy and paste `http://localhost:5173/` into any modern web browser (Chrome, Edge, Firefox, or Safari).

---

## 🎮 Controls Reference

Drive and customize your experience with the following keyboard layout:

| Key(s) | Action |
| :--- | :--- |
| **`W` / `A` / `S` / `D`** or **Arrow Keys** | Accelerate, Steer, Brake (Auto-reverses when stopped) |
| **`SPACEBAR`** | Handbrake (Hold to drift) |
| **`SHIFT` / `CTRL`** | Shift gear Up / Down (incl. Neutral & Reverse in manual mode) |
| **`C`** | Cycle through camera perspectives |
| **`V`** | Toggle Auto-Pilot (Cruise Control) |

---

## ✨ Features

- **Ambient Atmospheric Engine**: Change weather presets on the fly—choose from Clear, Overcast, Rainy (with dynamic screen raindrops), or Foggy.
- **Customization Garage**: Swap between 4 vehicle models (muscle, JDM, vintage roadster, electric hypercar), adjust paint colors, and turn on colorful underglow neons.
- **Vibe Radio**: Built-in procedural sound synthesis engine and Web Audio stations featuring Synthwave, Lofi, Zen Ambient, and Classical tracks.
- **Auto-Pilot Mode**: Sit back, relax, and let the cruise control guide the car along scenic roads while you enjoy the vibe.
