# 🪐 Real-Time Hand Gestures Particle System

![Particle System Demo](https://img.shields.io/badge/Demo-Live-cyan?style=for-the-badge&logo=google-chrome)
![Three.js](https://img.shields.io/badge/Three.js-Black?style=for-the-badge&logo=three.js&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-blue?style=for-the-badge)

A mesmerizing, interactive particle system controlled by real-time hand gestures. Built with **Three.js** for 3D rendering and **MediaPipe** for hand tracking.

## 🌟 Features

*   **Real-time Hand Tracking**: Detects hands and fingers instantly.
*   **Interactive Particles**: 8000+ particles react to your movements.
*   **Gesture Control**: Use specific hand shapes to trigger effects.
*   **Cosmic Visuals**: Beautiful glowing trails, explosions, and text formation.

---

## 🎮 Gesture Guide

| Gesture | Action | Effect |
| :--- | :--- | :--- |
| 🖐️🖐️ **Both Open** | **Gather** | Charge up energy by pulling particles in |
| ✊✊ **Fists Close** | **Explode** | Trigger a massive particle explosion |
| 💥 **4 Fingers** | **Explode** | Single-hand outward blast |
| 🤟 **3 Fingers** | **Text** | Form custom text with particles |
| ✌️ **2 Fingers** | **Wave** | Create gentle sine waves |
| ✊ **Fist** | **Repel** | Push particles away |
| 🖐️ **Open Hand** | **Attract** | Pull particles towards your hand |

---

## 🛠️ System Architecture

```mermaid
graph TD
    A[Webcam Input] -->|Video Stream| B(MediaPipe Hands)
    B -->|"Landmarks (x,y,z)"| C{Gesture Detection}
    C -->|Fist| D[Repel Force]
    C -->|Open| E[Attract Force]
    C -->|3 Fingers| G[Text Formation]
    
    subgraph Particle Engine
    D --> H[Update Velocity]
    E --> H
    G --> H
    H --> I[Update Position]
    I --> J[Three.js Renderer]
    end
    
    J -->|Canvas| K[User Screen]
```

---

## 🔄 Interaction Workflow

```mermaid
sequenceDiagram
    participant User
    participant Webcam
    participant Logic as Game Logic
    participant Particles

    User->>Webcam: Shows Gesture (e.g., 3 Fingers)
    Webcam->>Logic: Sends Hand Landmarks
    Logic->>Logic: Detect Gesture: 3 FINGERS
    Logic->>Particles: Update Mode to 'TEXT'
    Logic->>Particles: Calculate Target Positions
    Particles->>Particles: Lerp to Targets
    Particles->>User: Render Text Shape
```

---

## 📊 State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Repel: Fist
    Idle --> Attract: Open Hand
    Idle --> Wave: 2 Fingers
    Idle --> Text: 3 Fingers
    
    state DualHand {
        [*] --> Ready
        Ready --> Charging: Both Open
        Charging --> Explosion: Fists Close
        Explosion --> Ready: Reset
    }
```

---

## 🚀 Getting Started

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Ahmad-Abudllah-Ahmad/real-time-hand-gestures-.git
    ```

2.  **Open `index.html`**
    Simply open the file in your browser, or run a local server:
    ```bash
    python3 -m http.server 8888
    ```

3.  **Allow Camera Access**
    The app needs webcam access to track your hands.

---

## 🎨 Technologies Used

*   **Three.js**: High-performance 3D graphics.
*   **MediaPipe**: Machine learning for hand tracking.
*   **HTML5/CSS3**: Modern UI with glassmorphism effects.
*   **JavaScript (ES6+)**: Core logic and animation loop.

---

<div align="center">
    <p>Made with ❤️ by Ahmad Abdullah</p>
</div>
