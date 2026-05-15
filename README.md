# 🎲 Game-Log Pro

**Game-Log Pro** is a modern, responsive, and fully-featured board game tracker built for board game enthusiasts to easily log their sessions, track their collection, and view advanced competitive statistics.

## ✨ Features

- **📊 Advanced Dashboard & Charts**: Keep track of the "Ewiges Duell" (Eternal Duel) between players with a dynamic, interactive Chart.js line graph! Earn virtual achievements and streaks based on your play history.
- **📸 Photo of the Day**: A randomly selected photo from past sessions greets you every day on the dashboard.
- **🔍 Advanced BGG Integration**: Search the BoardGameGeek API and import cover images, player count, playing time, and complexity weight directly to your collection.
- **📚 Smart Collection Management**: Organize your games with custom categories. Filter your collection by name.
- **⏱️ Smart Session Tracker**: Minimize the tracker to the edge of the screen while using other app features. Supports round-by-round scoring. Includes a **Pause feature** for rules explanations or breaks!
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
- **BoardGameGeek API Token**: As of 2025, BGG requires an API token for requests. You can obtain one by registering your application on the [BGG Applications page](https://boardgamegeek.com/applications).

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/adrianmaslo/boardgame-app.git
   cd boardgame-app
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the `backend` directory (if it doesn't exist) and add your BoardGameGeek API token and player names:
   ```env
   BGG_TOKEN=your_token_here
   PLAYER_1_NAME=Adrian
   PLAYER_2_NAME=Lea
   ```

3. **Start the application:**
   ```bash
   docker-compose up -d
   ```

4. **Access the App:**
   Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## 📂 Project Structure

- `/backend`: Contains the FastAPI application, database logic, and API routes (`/routes`).
  - `database.py`: SQLite schema and connection handling.
  - `main.py`: Application entry point.
- `/frontend`: Contains all static files (HTML, CSS), the modular JavaScript files (`/js`), and PWA configurations (`manifest.json`, `sw.js`).
- `/uploads`: Root directory where all user-uploaded session photos are securely stored and mounted into the container.
- `docker-compose.yml`: Configuration for running the app inside a container.

## 🎨 Customization (Player Names)

The player names can be configured via environment variables in the `.env` file. By default, they are set to "Adrian" and "Lea".

To use different names:
1. Open the `backend/.env` file.
2. Add or update the following variables:
   ```env
   PLAYER_1_NAME=YourName
   PLAYER_2_NAME=PartnerName
   ```

> [!IMPORTANT]
> **Existing Database**: If you change the names in the `.env` file after the database has already been initialized, the existing players in the database will not be automatically renamed. You will need to either:
> 1. Manually update the `players` table in `backend/games.db`.
> 2. Delete the `backend/games.db` file to recreate it with the new names (Note: This will delete all your logged sessions!).

## 📝 License

This project is created for personal use.

---
*Built with ❤️ for epic board game nights.*
