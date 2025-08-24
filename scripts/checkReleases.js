#!/usr/bin/env node
require('dotenv').config();

const SpotifyService = require('../services/spotifyService');
const DatabaseService = require('../services/databaseService');
const DiscordService = require('../services/discordService');

class ReleaseChecker {
    constructor() {
        this.spotifyService = new SpotifyService();
        this.databaseService = new DatabaseService();
        this.discordService = null; // Will be initialized if Discord sending is enabled
        this.sendToDiscord = process.argv.includes('--discord') || process.env.SEND_TO_DISCORD === 'true';
    }

    async initialize() {
        console.log('🚀 Initializing Release Checker...\n');
        
        const databaseReady = await this.databaseService.connect();
        if (!databaseReady) {
            throw new Error('Failed to connect to database');
        }

        const spotifyReady = await this.spotifyService.authenticate();
        if (!spotifyReady) {
            throw new Error('Failed to authenticate with Spotify');
        }

        // Note: Discord messaging will be handled by writing to a shared message queue
        // that the main bot can read and send
        if (this.sendToDiscord) {
            console.log('✅ Discord messaging enabled (will send via main bot)');
        }

        console.log('✅ All services initialized!\n');
    }

    async sendDiscordMessage(message) {
        if (!this.sendToDiscord) return;
        
        try {
            // Write message to a file that the main bot can read
            const fs = require('fs').promises;
            const path = require('path');
            
            const messageData = {
                timestamp: new Date().toISOString(),
                message: message,
                processed: false
            };
            
            const messagesDir = '/app/data/messages';
            await fs.mkdir(messagesDir, { recursive: true });
            
            const filename = `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`;
            const filepath = path.join(messagesDir, filename);
            
            await fs.writeFile(filepath, JSON.stringify(messageData, null, 2));
            console.log(`📤 Message queued for Discord: ${filename}`);
            
        } catch (error) {
            console.error('❌ Error queueing Discord message:', error.message);
        }
    }

    async checkAllReleases() {
        try {
            const artists = await this.databaseService.getSubscribedArtists();
            
            if (artists.length === 0) {
                const message = '📭 No artists subscribed yet.\n💡 Use Discord commands to subscribe to artists first!';
                console.log(message);
                if (this.sendToDiscord) {
                    await this.sendDiscordMessage(message);
                }
                return;
            }

            const headerMessage = `🎵 Checking releases for ${artists.length} subscribed artist(s)...`;
            console.log(headerMessage + '\n');
            
            if (this.sendToDiscord) {
                await this.sendDiscordMessage(headerMessage);
            }

            let hasNewReleases = false;
            const releaseMessages = [];

            for (const artist of artists) {
                const releaseInfo = await this.checkArtistReleases(artist);
                if (releaseInfo) {
                    hasNewReleases = true;
                    releaseMessages.push(releaseInfo);
                }
                console.log(''); // Empty line for readability
            }

            const completionMessage = '✅ Release check completed!';
            console.log(completionMessage);
            
            if (this.sendToDiscord) {
                // Send release messages to Discord
                for (const message of releaseMessages) {
                    await this.sendDiscordMessage(message);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between messages
                }
                
                // Send completion message
                await this.sendDiscordMessage(completionMessage);
                
                if (!hasNewReleases && artists.length > 0) {
                    await this.sendDiscordMessage('ℹ️ No new releases found for any subscribed artists.');
                }
            }
        } catch (error) {
            const errorMessage = `❌ Error checking releases: ${error.message}`;
            console.error(errorMessage);
            if (this.sendToDiscord) {
                await this.sendDiscordMessage(errorMessage);
            }
        }
    }

    async checkArtistReleases(artist) {
        try {
            console.log(`🔍 Checking ${artist.name} (${artist.id})...`);
            
            const latestRelease = await this.spotifyService.getArtistLatestRelease(artist.name);
            
            if (!latestRelease) {
                console.log(`   ❌ No releases found for ${artist.name}`);
                return null;
            }

            // Display release information
            const artistNames = latestRelease.artists.map(a => a.name).join(', ');
            const releaseType = latestRelease.album_type.charAt(0).toUpperCase() + latestRelease.album_type.slice(1);
            
            console.log(`   🎵 Latest ${releaseType}: ${latestRelease.name}`);
            console.log(`   👨‍🎤 Artist(s): ${artistNames}`);
            console.log(`   📅 Released: ${latestRelease.release_date}`);
            console.log(`   🎧 Tracks: ${latestRelease.total_tracks}`);
            console.log(`   🔗 Spotify: ${latestRelease.external_urls.spotify}`);
            
            // Check if this is a new release
            const isNewRelease = artist.lastReleaseId !== latestRelease.id;
            if (isNewRelease) {
                console.log(`   🆕 NEW RELEASE DETECTED!`);
                await this.databaseService.updateArtistLastRelease(artist.id, latestRelease.id);
                
                // Return formatted message for Discord
                return `🆕 **NEW RELEASE!**\n` +
                       `🎵 **${releaseType}**: ${latestRelease.name}\n` +
                       `👨‍🎤 **Artist(s)**: ${artistNames}\n` +
                       `📅 **Released**: ${latestRelease.release_date}\n` +
                       `🎧 **Tracks**: ${latestRelease.total_tracks}\n` +
                       `🔗 **Listen**: ${latestRelease.external_urls.spotify}`;
            } else {
                console.log(`   ℹ️  No new releases since last check`);
                return null;
            }
            
        } catch (error) {
            console.log(`   ❌ Error checking ${artist.name}: ${error.message}`);
            return null;
        }
    }

    async cleanup() {
        await this.databaseService.disconnect();
    }
}

// Main execution
async function main() {
    const checker = new ReleaseChecker();
    
    try {
        await checker.initialize();
        await checker.checkAllReleases();
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        await checker.cleanup();
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