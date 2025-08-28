require('dotenv').config();

const DatabaseService = require('../services/databaseService');
const SpotifyService = require('../services/spotifyService');

class TaggingTester {
    constructor() {
        this.databaseService = new DatabaseService();
        this.spotifyService = new SpotifyService();
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

    async testTagFunctionality() {
        console.log('\n🏷️ Testing tag functionality...');
        
        // Test adding artists with tags
        const testArtists = [
            { id: 'test_artist_1', name: 'Test Kpop Artist', tags: 'kpop,popular' },
            { id: 'test_artist_2', name: 'Test Metal Artist', tags: 'metal,rock' },
            { id: 'test_artist_3', name: 'Test Indie Artist', tags: 'indie,alternative' },
            { id: 'test_artist_4', name: 'Test Untagged Artist', tags: null }
        ];

        console.log('📝 Adding test artists...');
        for (const artist of testArtists) {
            await this.databaseService.subscribeToArtist(artist.id, artist.name, artist.tags);
        }

        // Test getting all artists
        console.log('\n📋 All subscribed artists:');
        const allArtists = await this.databaseService.getSubscribedArtists();
        allArtists.forEach(artist => {
            const tagsDisplay = artist.tags ? ` (tags: ${artist.tags})` : ' (no tags)';
            console.log(`  • ${artist.name}${tagsDisplay}`);
        });

        // Test filtering by tag
        console.log('\n🔍 Artists with "kpop" tag:');
        const kpopArtists = await this.databaseService.getArtistsByTag('kpop');
        kpopArtists.forEach(artist => {
            console.log(`  • ${artist.name} (tags: ${artist.tags || 'none'})`);
        });

        // Test getting all tags
        console.log('\n🏷️ All available tags:');
        const allTags = await this.databaseService.getAllTags();
        console.log(`  Tags: [${allTags.join(', ')}]`);

        // Test updating tags
        console.log('\n✏️ Updating tags for Test Untagged Artist...');
        await this.databaseService.updateArtistTags('test_artist_4', 'rap,popular');
        
        const updatedArtist = (await this.databaseService.getSubscribedArtists())
            .find(a => a.id === 'test_artist_4');
        console.log(`  Updated: ${updatedArtist.name} (tags: ${updatedArtist.tags})`);

        // Test removing tags
        console.log('\n🗑️ Removing tags from Test Metal Artist...');
        await this.databaseService.updateArtistTags('test_artist_2', null);
        
        const untaggedArtist = (await this.databaseService.getSubscribedArtists())
            .find(a => a.id === 'test_artist_2');
        console.log(`  Removed: ${untaggedArtist.name} (tags: ${untaggedArtist.tags || 'none'})`);

        console.log('\n✅ Tag functionality test completed');
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test data...');
        
        // Remove test artists
        const testIds = ['test_artist_1', 'test_artist_2', 'test_artist_3', 'test_artist_4'];
        for (const id of testIds) {
            try {
                await this.databaseService.unsubscribeFromArtist(id);
            } catch (error) {
                // Ignore errors if artist doesn't exist
            }
        }
        
        await this.databaseService.disconnect();
        console.log('🧹 Cleanup completed');
    }
}

// Main execution
async function main() {
    const tester = new TaggingTester();
    
    try {
        await tester.initialize();
        await tester.testTagFunctionality();
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