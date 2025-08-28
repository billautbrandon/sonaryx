require('dotenv').config();

const DatabaseService = require('../services/databaseService');
const SpotifyService = require('../services/spotifyService');
const DiscordService = require('../services/discordService');
const ScheduledReleaseService = require('../services/scheduledReleaseService');

class FallbackCheckTester {
    constructor() {
        this.databaseService = new DatabaseService();
        this.spotifyService = new SpotifyService();
        this.discordService = new DiscordService(this.databaseService, this.spotifyService);
        this.scheduledReleaseService = new ScheduledReleaseService(
            this.databaseService,
            this.spotifyService,
            this.discordService
        );
    }

    async initialize() {
        console.log('🔧 Initializing services...');
        
        const databaseReady = await this.databaseService.connect();
        if (!databaseReady) {
            throw new Error('Failed to initialize database');
        }

        const spotifyReady = await this.spotifyService.authenticate();
        if (!spotifyReady) {
            throw new Error('Failed to initialize Spotify service');
        }

        console.log('✅ Services initialized');
    }

    async testFallbackCheck() {
        console.log('\n🔄 Testing fallback release check...');
        await this.scheduledReleaseService.performFallbackReleaseCheck();
        console.log('✅ Fallback check completed');
    }

    async testDailyReleaseStorage() {
        console.log('\n📦 Testing daily release storage...');
        const today = new Date().toISOString().split('T')[0];
        
        // Test storing some sample release data
        const sampleReleases = [
            {
                spotifyLink: 'https://open.spotify.com/album/test1',
                artistName: 'Test Artist 1',
                releaseName: 'Test Album 1',
                releaseId: 'test_release_id_1',
                releaseType: 'album',
                releaseDate: today
            },
            {
                spotifyLink: 'https://open.spotify.com/album/test2',
                artistName: 'Test Artist 2',
                releaseName: 'Test Single 2',
                releaseId: 'test_release_id_2',
                releaseType: 'single',
                releaseDate: today
            }
        ];

        await this.databaseService.storeDailyReleases(today, sampleReleases);
        
        // Retrieve and display stored releases
        const storedReleases = await this.databaseService.getDailyReleases(today);
        console.log(`📊 Stored releases for ${today}:`, storedReleases.length);
        
        storedReleases.forEach((release, index) => {
            console.log(`   ${index + 1}. ${release.releaseName} by ${release.artistName}`);
            console.log(`      🔗 ${release.spotifyLink}`);
        });

        // Test getting release IDs
        const releaseIds = await this.databaseService.getStoredReleaseIds(today);
        console.log(`🆔 Release IDs: [${releaseIds.join(', ')}]`);
        
        console.log('✅ Daily release storage test completed');
    }

    async cleanup() {
        await this.databaseService.disconnect();
        console.log('🧹 Cleanup completed');
    }
}

// Main execution
async function main() {
    const tester = new FallbackCheckTester();
    
    try {
        await tester.initialize();
        await tester.testDailyReleaseStorage();
        await tester.testFallbackCheck();
    } catch (error) {
        console.error('❌ Test error:', error.message);
        process.exit(1);
    } finally {
        await tester.cleanup();
    }
}

// Handle interruption gracefully
process.on('SIGINT', async () => {
    console.log('\n🛑 Interrupted by user');
    process.exit(0);
});

// Start the test
main().catch(error => {
    console.error('❌ Fatal test error:', error.message);
    process.exit(1);
});