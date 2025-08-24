# 🎶 Sonaryx

**Sonaryx** is a Discord bot that acts like a music sonar: it detects new releases from Spotify artists (singles, EPs, albums) and shares them automatically in a dedicated Discord channel.

---

## ✨ Features

- 🎵 **Artist Subscriptions**: Subscribe to any Spotify artist via Discord commands
- 🤖 **Discord Slash Commands**: Easy-to-use `/subscribe`, `/unsubscribe`, and `/list` commands  
- 📅 **Daily Automatic Checks**: Automatically checks for new releases every day at 00:00 UTC
- 🔍 **Manual Release Checking**: Check all subscribed artists' latest releases on demand
- 📊 **SQLite Database**: Persistent artist subscriptions with Prisma ORM
- 🐳 **Docker Support**: Full containerized setup
- 🎯 **Smart Detection**: Only notifies about genuinely new releases

---

## 🛠️ Tech Stack
- [Node.js](https://nodejs.org/)
- [discord.js](https://discord.js.org/)  
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)  
- [Prisma](https://www.prisma.io/) + [SQLite](https://www.sqlite.org/)  

---

## 🚀 Getting Started

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd sonaryx
make setup  # Installs dependencies and sets up database
```

### 2. Environment Configuration
```bash
cp env.example .env
```

Edit `.env` with your credentials:
```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CHANNEL_ID=your_discord_channel_id_here

# Spotify API Configuration  
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
```

### 3. Get API Credentials

**Discord Bot:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → Bot
3. Copy the bot token
4. Invite bot to your server with appropriate permissions

**Spotify API:**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Copy Client ID and Client Secret

---

## 🎮 Usage

### Start the Bot
```bash
make start          # Start locally
# OR
make up            # Start with Docker
```

### Discord Commands

Once the bot is running, use these slash commands in Discord:

- `/subscribe NMIXX` - Subscribe to NMIXX's releases
- `/subscribe "Taylor Swift"` - Subscribe to artists with spaces in name
- `/unsubscribe 28ot3wh4oNmoFOdVajibBl` - Unsubscribe using artist ID
- `/list` - Show all subscribed artists

### Manual Release Checking

Check all subscribed artists' latest releases:
```bash
make check-releases
```

Example output:
```
🔍 Checking NMIXX (28ot3wh4oNmoFOdVajibBl)...
   🎵 Latest Single: MEXE
   👨‍🎤 Artist(s): Pabllo Vittar, NMIXX
   📅 Released: 2025-08-21
   🎧 Tracks: 1
   🔗 Spotify: https://open.spotify.com/album/3pqOt29EZkGpqPHBfpPskX
   🆕 NEW RELEASE DETECTED!
```

---

## 📁 Project Structure

```
sonaryx/
├── index.js                    # Main bot entry point
├── services/
│   ├── discordService.js      # Discord bot & slash commands
│   ├── spotifyService.js      # Spotify API integration  
│   └── databaseService.js     # Database operations
├── scripts/
│   └── checkReleases.js       # Manual release checker
├── prisma/
│   └── schema.prisma          # Database schema
├── Makefile                   # Command shortcuts
└── docker-compose.yml         # Docker configuration
```

---

## 🔧 Available Commands

### Development
```bash
make help           # Show all available commands
make start          # Start bot locally
make check-releases # Check releases manually (sends to Discord)
make daily-check    # Trigger daily check manually (for testing)
make db-studio      # Open database browser
```

### Docker
```bash
make build          # Build Docker image
make up             # Start containers  
make down           # Stop containers
make logs           # View container logs
```

### Database
```bash
make db-setup       # Initialize database
make db-reset       # Reset database (⚠️ deletes all data)
```

---

## 🎯 Workflow

1. **Setup**: Install dependencies and configure environment
2. **Start Bot**: Run the Discord bot to accept commands
3. **Subscribe**: Use `/subscribe` to add artists you want to monitor
4. **Automatic Daily Checks**: Bot automatically checks for new releases every day at 00:00 UTC
5. **Manual Checks**: Run `make check-releases` to see latest releases immediately
6. **Manage**: Use `/list` and `/unsubscribe` to manage subscriptions

## 📅 Daily Schedule

- **Automatic Check**: Every day at **00:00 UTC**
- **What it does**: Checks all subscribed artists for new releases
- **Discord Output**: Sends daily report with any new releases found
- **No Spam**: Only sends message if there are new releases or daily summary

---

## 📝 Example Usage

```bash
# Initial setup
make setup

# Start the bot
make start

# In Discord:
# /subscribe NMIXX
# /subscribe "NewJeans"  
# /list

# Check releases manually
make check-releases
```

---

## 🐳 Docker

The bot runs perfectly in Docker with the `sonaryx-server` container:

```bash
make up && make logs  # Start and view logs
```