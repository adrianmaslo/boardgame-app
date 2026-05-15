# 🎲 Game-Log Pro

**Game-Log Pro** is a modern, responsive, and fully-featured board game tracker built for board game enthusiasts to easily log their sessions, track their collection, and view advanced competitive statistics.

## ✨ Features

- **📊 Advanced Dashboard & Stats**: Keep track of the "Ewiges Duell" (Eternal Duel) between players. Earn virtual achievements and streaks based on your play history!
- **📸 Photo of the Day**: A randomly selected photo from past sessions greets you every day on the dashboard.
- **📚 Smart Collection Management**: Organize your games with custom categories.
- **🔍 BGG Integration**: Can't find a game locally? Search the BoardGameGeek API and add it directly to your collection or your wishlist with a single click.
- **📝 Detailed Session Logging**: Record scores, winners, play times, add personal notes, and even upload a photo for every session.
- **⏱️ Retroactive Editing**: Forgot to stop the timer? Easily edit the duration, scores, and dates of your past sessions.
- **📱 Mobile-Optimized (PWA)**: Designed primarily for mobile usage with touch-friendly UI, glassmorphism design, and a neon-dark aesthetic.

## 🛠️ Technology Stack

- **Backend**: Python, FastAPI, SQLite
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (Custom Glassmorphism Design), Bootstrap 5
- **Deployment**: Docker, Docker Compose

## 🚀 Getting Started

The easiest way to run Game-Log Pro is via Docker.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/adrianmaslo/boardgame-app.git
   cd boardgame-app
   ```

2. **Start the application:**
   ```bash
   docker-compose up -d
   ```

3. **Access the App:**
   Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## 📂 Project Structure

- `/backend`: Contains the FastAPI application, database logic, and API routes (`/routes`).
  - `database.py`: SQLite schema and connection handling.
  - `main.py`: Application entry point.
- `/frontend`: Contains all static files (HTML, CSS, JS) and PWA configurations (`manifest.json`, `sw.js`).
- `docker-compose.yml`: Configuration for running the app inside a container.

## 📝 License

This project is created for personal use.

---
*Built with ❤️ for epic board game nights.*
