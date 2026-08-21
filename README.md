# 🎲 Game-Log Pro (v2.0.0)

**Game-Log Pro** is a modern, responsive, and fully-featured board game tracker built for board game enthusiasts to easily log their sessions, track their collection, and view advanced competitive statistics.

## ✨ Features

- **🌍 Full Internationalization (i18n)**: Fully translated in both English and German, with seamless language switching.
- **👥 Multi-User & Group Support**: Form groups with your friends, invite them via codes, and track games together.
- **🤝 Guests & Teams**: Add temporary guest players to your sessions or group players into teams for games like Codenames or Team-Alias.
- **📊 Advanced Dashboard & Charts**: Keep track of the "Ewiges Duell" (Eternal Duel) between players with a dynamic, interactive Chart.js line graph! Earn virtual achievements and streaks based on your play history.
- **📸 Photo of the Day**: A randomly selected photo from past sessions greets you every day on the dashboard.
- **🔍 Advanced BGG Integration**: Search the BoardGameGeek API and import cover images, player count, playing time, and complexity weight directly to your collection. Automatically prioritizes base games with publication years.
- **📚 Smart Collection Management**: Organize your games with custom categories. Filter your collection by name.
- **⏱️ Smart Session Tracker**: Minimize the tracker to the edge of the screen while using other app features. Supports round-by-round scoring. Includes a **Pause feature** for rules explanations or breaks!
- **📝 Detailed Session Logging**: Record scores, winners, play times, add personal notes, and even upload a photo for every session.
- **🔗 Share Sessions**: Generate a beautiful image summary of your game session and share it directly to social media or messenger apps!
- **📱 Mobile-Optimized (PWA)**: Designed primarily for mobile usage with touch-friendly UI, glassmorphism design, a neon-dark aesthetic, and a fully interactive onboarding tour.

## 🛠️ Technology Stack

- **Backend**: Python, FastAPI, SQLite
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (Custom Glassmorphism Design), Bootstrap 5
- **Deployment**: Docker, Docker Compose

## 🚀 Getting Started

The easiest way to run Game-Log Pro is via Docker.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- **BoardGameGeek API Token** (Optional): If BGG requires an API token for requests, you can obtain one by registering your application on the [BGG Applications page](https://boardgamegeek.com/applications) and setting `BGG_TOKEN` in your `.env`.

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/adrianmaslo/boardgame-app.git
   cd boardgame-app
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the `backend` directory (if it doesn't exist) and add a secure secret for JWT tokens:
   ```env
   JWT_SECRET=your_super_secret_string
   JWT_EXPIRE_DAYS=30
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

3. **Google OAuth Setup (Optional):**
   To enable "Sign in with Google":
   - Create an OAuth 2.0 Client ID in the [Google Cloud Console](https://console.cloud.google.com/).
   - Set Authorized JavaScript Origins:
     - `http://localhost:8000`
     - `https://gamelog.maslowski-server.de`
   - Set `GOOGLE_CLIENT_ID` in `backend/.env`.

4. **Start the application:**
   ```bash
   docker compose up -d
   ```

5. **Access the App:**
   Open your browser and navigate to `http://localhost:8000` or `https://gamelog.maslowski-server.de`.

## 📂 Project Structure

- `/backend`: Contains the FastAPI application, database logic, and API routes (`/routes`).
  - `database.py`: SQLite schema and connection handling.
  - `main.py`: Application entry point.
- `/frontend`: Contains all static files (HTML, CSS), the modular JavaScript files (`/js`), and PWA configurations (`manifest.json`, `sw.js`).
- `/uploads`: Root directory where all user-uploaded session photos are securely stored and mounted into the container.
- `docker-compose.yml`: Configuration for running the app inside a container.

## 📝 License

This project is created for personal use.

---
*Built with ❤️ for epic board game nights.*
