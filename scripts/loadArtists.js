#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const DatabaseService = require('../services/databaseService');
const SpotifyService = require('../services/spotifyService');

class ArtistLoader {
    constructor() {
        this.databaseService = new DatabaseService();
        this.spotifyService = new SpotifyService();
    }

    async initialize() {
        console.log('🔧 Initializing services...');
        
        const databaseReady = await this.databaseService.connect();
        if (!databaseReady) {
            throw new Error('Failed to connect to database');
        }

        const spotifyReady = await this.spotifyService.authenticate();
        if (!spotifyReady) {
            throw new Error('Failed to authenticate with Spotify');
        }

        console.log('✅ Services initialized successfully');
    }

    async loadArtists(inputPath, options = {}) {
        const { validateArtists = true, skipExisting = true, dryRun = false } = options;
        
        try {
            console.log(`🔍 Loading artist dump from: ${inputPath}`);
            
            // Read and parse dump file
            const dumpContent = await fs.readFile(inputPath, 'utf8');
            const dumpData = JSON.parse(dumpContent);

            // Validate dump format
            if (!dumpData.artists || !Array.isArray(dumpData.artists)) {
                throw new Error('Invalid dump file format: missing or invalid artists array');
            }

            console.log(`📄 Dump file info:`);
            console.log(`   📅 Created: ${dumpData.timestamp || 'Unknown'}`);
            console.log(`   🏷️  Version: ${dumpData.version || 'Unknown'}`);
            console.log(`   📊 Artists: ${dumpData.totalArtists || dumpData.artists.length}`);

            if (dryRun) {
                console.log('\n🧪 DRY RUN MODE - No changes will be made to the database');
            }

            // Get currently subscribed artists if skipExisting is enabled
            let existingArtistIds = [];
            if (skipExisting && !dryRun) {
                const existingArtists = await this.databaseService.getSubscribedArtists();
                existingArtistIds = existingArtists.map(artist => artist.id);
                console.log(`📦 Found ${existingArtistIds.length} existing subscriptions`);
            }

            let successCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            console.log(`\n🔄 Processing ${dumpData.artists.length} artists...`);
            
            for (let i = 0; i < dumpData.artists.length; i++) {
                const artistData = dumpData.artists[i];
                const progress = `[${(i + 1).toString().padStart(3, ' ')}/${dumpData.artists.length}]`;
                
                try {
                    console.log(`${progress} Processing: ${artistData.name}`);

                    // Skip if artist already exists
                    if (skipExisting && existingArtistIds.includes(artistData.id)) {
                        console.log(`${progress}   ⏭️  Skipping (already subscribed)`);
                        skippedCount++;
                        continue;
                    }

                    // Validate artist exists on Spotify if validation is enabled
                    if (validateArtists) {
                        const spotifyArtist = await this.spotifyService.getArtistById(artistData.id);
                        if (!spotifyArtist) {
                            console.log(`${progress}   ⚠️  Warning: Artist not found on Spotify, adding anyway`);
                        } else if (spotifyArtist.name !== artistData.name) {
                            console.log(`${progress}   ℹ️  Name updated: "${artistData.name}" → "${spotifyArtist.name}"`);
                            artistData.name = spotifyArtist.name; // Use current Spotify name
                        }
                    }

                    // Subscribe to artist (unless dry run)
                    if (!dryRun) {
                        await this.databaseService.subscribeToArtist(
                            artistData.id,
                            artistData.name,
                            artistData.tags
                        );
                    }

                    console.log(`${progress}   ✅ ${dryRun ? 'Would subscribe' : 'Subscribed'}: ${artistData.name}`);
                    successCount++;

                    // Small delay to avoid hitting Spotify API limits
                    if (validateArtists && i < dumpData.artists.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                } catch (error) {
                    console.log(`${progress}   ❌ Error processing ${artistData.name}: ${error.message}`);
                    errorCount++;
                    continue;
                }
            }

            // Summary
            console.log(`\n📊 Load Summary:`);
            console.log(`   ✅ ${dryRun ? 'Would be added' : 'Successfully added'}: ${successCount}`);
            console.log(`   ⏭️  Skipped (existing): ${skippedCount}`);
            console.log(`   ❌ Errors: ${errorCount}`);
            console.log(`   📈 Total processed: ${dumpData.artists.length}`);

            if (dryRun) {
                console.log(`\n💡 Run without --dry-run to apply changes`);
            } else {
                console.log(`\n✅ Artist load completed!`);
            }

        } catch (error) {
            console.error('❌ Error loading artist dump:', error.message);
            throw error;
        }
    }

    async cleanup() {
        await this.databaseService.disconnect();
        console.log('🧹 Database connection closed');
    }
}

// Main execution
async function main() {
    const loader = new ArtistLoader();
    
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        let inputPath = args.find(arg => !arg.startsWith('--'));
        const options = {
            validateArtists: !args.includes('--no-validate'),
            skipExisting: !args.includes('--overwrite'),
            dryRun: args.includes('--dry-run')
        };

        if (!inputPath) {
            // Look for the most recent dump file in backups directory
            const backupsDir = path.join(process.cwd(), 'backups');
            try {
                const files = await fs.readdir(backupsDir);
                const dumpFiles = files
                    .filter(file => file.startsWith('artists_dump_') && file.endsWith('.json'))
                    .sort()
                    .reverse();
                    
                if (dumpFiles.length > 0) {
                    inputPath = path.join(backupsDir, dumpFiles[0]);
                    console.log(`📄 No input file specified, using most recent dump: ${dumpFiles[0]}`);
                } else {
                    throw new Error('No dump files found');
                }
            } catch (error) {
                console.error('❌ No input file specified and no backup files found.');
                console.error('Usage: node loadArtists.js [path/to/dump.json] [--dry-run] [--no-validate] [--overwrite]');
                process.exit(1);
            }
        }

        await loader.initialize();
        await loader.loadArtists(inputPath, options);
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        await loader.cleanup();
    }
}

// Handle interruption gracefully
process.on('SIGINT', async () => {
    console.log('\n🛑 Interrupted by user');
    process.exit(0);
});

// Run the script
if (require.main === module) {
    main();
}