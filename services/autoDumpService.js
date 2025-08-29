const fs = require('fs').promises;
const path = require('path');

class AutoDumpService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.isCreatingDump = false;
    }

    async createAutoDump() {
        // Prevent concurrent dump creation
        if (this.isCreatingDump) {
            console.log('⏭️ Auto-dump already in progress, skipping');
            return false;
        }

        try {
            this.isCreatingDump = true;
            console.log('📦 Creating automatic artist dump...');
            
            const artists = await this.databaseService.getSubscribedArtists();
            
            if (artists.length === 0) {
                console.log('📭 No artists to dump');
                return false;
            }

            // Create dump data
            const dumpData = {
                timestamp: new Date().toISOString(),
                createdBy: 'sonaryx-auto-dumper',
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
            const backupsDir = path.join(process.cwd(), 'backups');
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const filename = `artists_dump_${timestamp}.json`;
            const filePath = path.join(backupsDir, filename);

            // Ensure backup directory exists
            await fs.mkdir(backupsDir, { recursive: true });

            // Write dump file
            await fs.writeFile(filePath, JSON.stringify(dumpData, null, 2));

            console.log(`✅ Auto-dump created: ${filename} (${artists.length} artists)`);
            return true;

        } catch (error) {
            console.error('❌ Error creating auto-dump:', error.message);
            return false;
        } finally {
            this.isCreatingDump = false;
        }
    }

    async loadLatestDump() {
        try {
            console.log('📥 Auto-loading latest artist dump...');
            
            const backupsDir = path.join(process.cwd(), 'backups');
            
            // Check if backups directory exists
            try {
                await fs.access(backupsDir);
            } catch (error) {
                console.log('📁 No backups directory found, skipping auto-load');
                return false;
            }

            // Find the most recent dump file
            const files = await fs.readdir(backupsDir);
            const dumpFiles = files
                .filter(file => file.startsWith('artists_dump_') && file.endsWith('.json'))
                .sort()
                .reverse(); // Most recent first

            if (dumpFiles.length === 0) {
                console.log('📭 No dump files found, skipping auto-load');
                return false;
            }

            const latestDump = dumpFiles[0];
            const dumpPath = path.join(backupsDir, latestDump);

            // Read and parse dump file
            const dumpContent = await fs.readFile(dumpPath, 'utf8');
            const dumpData = JSON.parse(dumpContent);

            if (!dumpData.artists || !Array.isArray(dumpData.artists)) {
                console.error('❌ Invalid dump file format');
                return false;
            }

            console.log(`📄 Found latest dump: ${latestDump} (${dumpData.totalArtists || dumpData.artists.length} artists)`);

            // Get currently subscribed artists to avoid duplicates
            const existingArtists = await this.databaseService.getSubscribedArtists();
            const existingArtistIds = existingArtists.map(artist => artist.id);

            let loadedCount = 0;
            let skippedCount = 0;

            for (const artistData of dumpData.artists) {
                try {
                    // Skip if artist already exists
                    if (existingArtistIds.includes(artistData.id)) {
                        skippedCount++;
                        continue;
                    }

                    // Subscribe to artist
                    await this.databaseService.subscribeToArtist(
                        artistData.id,
                        artistData.name,
                        artistData.tags
                    );
                    
                    loadedCount++;
                } catch (error) {
                    console.error(`❌ Error loading artist ${artistData.name}:`, error.message);
                    continue;
                }
            }

            console.log(`✅ Auto-load completed: ${loadedCount} new, ${skippedCount} existing, ${loadedCount + skippedCount} total`);
            return loadedCount > 0;

        } catch (error) {
            console.error('❌ Error during auto-load:', error.message);
            return false;
        }
    }
}

module.exports = AutoDumpService;