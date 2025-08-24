#!/usr/bin/env node
require('dotenv').config();

const DatabaseService = require('../services/databaseService');
const SpotifyService = require('../services/spotifyService');
const DiscordService = require('../services/discordService');
const ScheduledReleaseService = require('../services/scheduledReleaseService');

async function testDailyCheck() {
    console.log('🧪 Testing daily release check functionality...');
    
    const databaseService = new DatabaseService();
    const spotifyService = new SpotifyService();
    const discordService = new DiscordService(databaseService, spotifyService);
    const scheduledReleaseService = new ScheduledReleaseService(databaseService, spotifyService, discordService);
    
    try {
        // Initialize services
        await databaseService.connect();
        await spotifyService.authenticate();
        
        console.log('✅ Services initialized');
        
        // Trigger manual daily check
        await scheduledReleaseService.triggerManualCheck();
        
        console.log('✅ Daily check test completed');
        
    } catch (error) {
        console.error('❌ Error in daily check test:', error.message);
        process.exit(1);
    } finally {
        await databaseService.disconnect();
        process.exit(0);
    }
}

testDailyCheck();