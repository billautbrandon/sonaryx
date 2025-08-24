const cron = require('node-cron');
require('dotenv').config();

const DiscordService = require('./services/discordService');
const SpotifyService = require('./services/spotifyService');

// Initialize services
const discordService = new DiscordService();
const spotifyService = new SpotifyService();

// Configuration
const ARTIST_NAME = 'NMIXX';
const CRON_SCHEDULE = '*/10 * * * * *'; // Every 10 seconds

async function initializeBot() {
    console.log('🚀 Starting Sonaryx Bot...');
    
    // Initialize Discord
    const discordReady = await discordService.login();
    if (!discordReady) {
        console.error('❌ Failed to initialize Discord service');
        process.exit(1);
    }

    // Initialize Spotify
    const spotifyReady = await spotifyService.authenticate();
    if (!spotifyReady) {
        console.error('❌ Failed to initialize Spotify service');
        process.exit(1);
    }

    // Wait a moment for Discord client to be fully ready
    setTimeout(() => {
        startReleaseMonitoring();
    }, 2000);
}

function startReleaseMonitoring() {
    console.log(`🎵 Starting release monitoring for artist: ${ARTIST_NAME}`);
    console.log(`⏰ Checking every 10 seconds...`);

    // Schedule the release check
    cron.schedule(CRON_SCHEDULE, async () => {
        await checkAndSendLatestRelease();
    });

    // Send initial release immediately
    setTimeout(async () => {
        await sendCurrentLatestRelease();
    }, 1000);
}

async function checkAndSendLatestRelease() {
    try {
        console.log(`🔍 Checking for new releases from ${ARTIST_NAME}...`);
        
        const newRelease = await spotifyService.checkForNewRelease(ARTIST_NAME);
        
        if (newRelease) {
            console.log(`🆕 New release found: ${newRelease.name}`);
            const success = await discordService.sendSpotifyRelease(newRelease);
            
            if (success) {
                console.log('✅ Successfully sent new release notification');
            }
        } else {
            console.log(`ℹ️  No new releases found for ${ARTIST_NAME}`);
        }
    } catch (error) {
        console.error('❌ Error in release monitoring:', error.message);
    }
}

async function sendCurrentLatestRelease() {
    try {
        console.log(`🎵 Fetching current latest release for ${ARTIST_NAME}...`);
        
        const latestRelease = await spotifyService.getArtistLatestRelease(ARTIST_NAME);
        
        if (latestRelease) {
            const success = await discordService.sendSpotifyRelease(latestRelease);
            
            if (success) {
                console.log('✅ Successfully sent current latest release');
            }
        } else {
            await discordService.sendMessage(`❌ Could not fetch latest release for ${ARTIST_NAME}`);
        }
    } catch (error) {
        console.error('❌ Error sending current latest release:', error.message);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Sonaryx Bot...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Sonaryx Bot...');
    process.exit(0);
});

// Start the bot
initializeBot().catch(error => {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
});