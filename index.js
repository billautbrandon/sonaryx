require('dotenv').config();

const DiscordService = require('./services/discordService');
const SpotifyService = require('./services/spotifyService');
const DatabaseService = require('./services/databaseService');
const MessageQueueService = require('./services/messageQueueService');
const ScheduledReleaseService = require('./services/scheduledReleaseService');

// Initialize services
const databaseService = new DatabaseService();
const spotifyService = new SpotifyService();
const discordService = new DiscordService(databaseService, spotifyService);
const messageQueueService = new MessageQueueService(discordService);
const scheduledReleaseService = new ScheduledReleaseService(databaseService, spotifyService, discordService);

async function initializeBot() {
    console.log('🚀 Starting Sonaryx Bot...');
    
    // Initialize Database
    const databaseReady = await databaseService.connect();
    if (!databaseReady) {
        console.error('❌ Failed to initialize database');
        process.exit(1);
    }

    // Initialize Spotify
    const spotifyReady = await spotifyService.authenticate();
    if (!spotifyReady) {
        console.error('❌ Failed to initialize Spotify service');
        process.exit(1);
    }

    // Initialize Discord
    const discordReady = await discordService.login();
    if (!discordReady) {
        console.error('❌ Failed to initialize Discord service');
        process.exit(1);
    }

    // Start message queue processor
    await messageQueueService.start();
    
    // Start daily release scheduler
    scheduledReleaseService.start();
    
    console.log('✅ All services initialized successfully!');
    console.log('🎵 Bot is ready to accept commands!');
    console.log('📅 Daily release checks scheduled for 09:00 UTC');
    console.log('🔄 Fallback release checks scheduled for 20:00 UTC (configurable)');
    console.log('🎯 Only shows releases from TODAY!');
    console.log('📝 Available commands:');
    console.log('   /subscribe [artist_name] - Subscribe to an artist by name');
    console.log('   /subscribe-id [artist_id] - Subscribe to an artist by Spotify ID');
    console.log('   /unsubscribe [artist_id] - Unsubscribe from an artist');
    console.log('   /list - List all subscribed artists');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Sonaryx Bot...');
    scheduledReleaseService.stop();
    await messageQueueService.stop();
    await databaseService.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down Sonaryx Bot...');
    scheduledReleaseService.stop();
    await messageQueueService.stop();
    await databaseService.disconnect();
    process.exit(0);
});

// Start the bot
initializeBot().catch(error => {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
});