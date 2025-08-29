#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const DatabaseService = require('../services/databaseService');

class ArtistDumper {
    constructor() {
        this.databaseService = new DatabaseService();
    }

    async initialize() {
        console.log('🔧 Initializing database connection...');
        
        const databaseReady = await this.databaseService.connect();
        if (!databaseReady) {
            throw new Error('Failed to connect to database');
        }

        console.log('✅ Database connected successfully');
    }

    async dumpArtists(outputPath = null) {
        try {
            console.log('🔍 Fetching subscribed artists...');
            
            const artists = await this.databaseService.getSubscribedArtists();
            
            if (artists.length === 0) {
                console.log('📭 No artists found in subscription list');
                return;
            }

            console.log(`📊 Found ${artists.length} subscribed artists`);

            // Create dump data with timestamp and artist information
            const dumpData = {
                timestamp: new Date().toISOString(),
                createdBy: 'sonaryx-artist-dumper',
                version: '1.0.0',
                totalArtists: artists.length,
                artists: artists.map(artist => ({
                    id: artist.id,
                    name: artist.name,
                    tags: artist.tags || null,
                    lastReleaseId: artist.lastReleaseId || null,
                    subscriptionDate: artist.createdAt
                }))
            };

            // Determine output path
            const defaultPath = path.join(process.cwd(), 'backups', `artists_dump_${new Date().toISOString().split('T')[0]}.json`);
            const finalPath = outputPath || defaultPath;

            // Ensure backup directory exists
            const backupDir = path.dirname(finalPath);
            await fs.mkdir(backupDir, { recursive: true });

            // Write dump file
            await fs.writeFile(finalPath, JSON.stringify(dumpData, null, 2));

            console.log(`✅ Artist dump created successfully!`);
            console.log(`📄 File: ${finalPath}`);
            console.log(`📈 Total artists: ${artists.length}`);
            
            // Show summary of artists
            console.log('\n📋 Artist Summary:');
            artists.forEach((artist, index) => {
                const tagsDisplay = artist.tags ? ` [${artist.tags}]` : '';
                console.log(`   ${(index + 1).toString().padStart(3, ' ')}. ${artist.name}${tagsDisplay}`);
            });

        } catch (error) {
            console.error('❌ Error creating artist dump:', error.message);
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
    const dumper = new ArtistDumper();
    
    try {
        await dumper.initialize();
        
        // Get output path from command line arguments
        const outputPath = process.argv[2];
        
        await dumper.dumpArtists(outputPath);
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        await dumper.cleanup();
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