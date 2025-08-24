const cron = require('node-cron');

class ScheduledReleaseService {
    constructor(databaseService, spotifyService, discordService) {
        this.databaseService = databaseService;
        this.spotifyService = spotifyService;
        this.discordService = discordService;
        this.cronJob = null;
    }

    start() {
        // Schedule daily check at 00:00 (midnight)
        this.cronJob = cron.schedule('0 0 * * *', async () => {
            console.log('🕛 Daily release check started at', new Date().toISOString());
            await this.performDailyReleaseCheck();
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        console.log('✅ Daily release checker scheduled for 00:00 UTC');
    }

    stop() {
        if (this.cronJob) {
            this.cronJob.destroy();
            this.cronJob = null;
        }
        console.log('🛑 Daily release checker stopped');
    }

    async performDailyReleaseCheck() {
        try {
            console.log('🎵 Performing daily release check...');
            
            const artists = await this.databaseService.getSubscribedArtists();
            
            if (artists.length === 0) {
                console.log('📭 No artists subscribed for daily check');
                return;
            }

            console.log(`🔍 Checking ${artists.length} subscribed artists for new releases...`);

            const newReleases = [];
            
            for (const artist of artists) {
                const releaseInfo = await this.checkArtistForNewReleases(artist);
                if (releaseInfo) {
                    newReleases.push(releaseInfo);
                }
                // Small delay between API calls
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Send results to Discord
            await this.sendDailyReport(newReleases, artists.length);
            
            console.log(`✅ Daily release check completed. Found ${newReleases.length} new releases.`);
            
        } catch (error) {
            console.error('❌ Error in daily release check:', error.message);
            await this.discordService.sendMessage(`❌ Daily release check failed: ${error.message}`);
        }
    }

    async checkArtistForNewReleases(artist) {
        try {
            console.log(`🔍 Checking ${artist.name}...`);
            
            const latestRelease = await this.spotifyService.getArtistLatestRelease(artist.name);
            
            if (!latestRelease) {
                console.log(`   ❌ No releases found for ${artist.name}`);
                return null;
            }

            // Check if this is a new release (different from last known)
            const isNewRelease = artist.lastReleaseId !== latestRelease.id;
            
            if (isNewRelease) {
                console.log(`   🆕 NEW RELEASE: ${latestRelease.name} by ${artist.name}`);
                
                // Update the database with the new release
                await this.databaseService.updateArtistLastRelease(artist.id, latestRelease.id);
                
                // Format release info for Discord
                const artistNames = latestRelease.artists.map(a => a.name).join(', ');
                const releaseType = latestRelease.album_type.charAt(0).toUpperCase() + latestRelease.album_type.slice(1);
                
                return {
                    artist: artist.name,
                    release: latestRelease,
                    message: `🆕 **${releaseType}**: **${latestRelease.name}**\n` +
                            `👨‍🎤 **Artist(s)**: ${artistNames}\n` +
                            `📅 **Released**: ${latestRelease.release_date}\n` +
                            `🎧 **Tracks**: ${latestRelease.total_tracks}\n` +
                            `🔗 **Listen**: ${latestRelease.external_urls.spotify}`
                };
            } else {
                console.log(`   ℹ️ No new releases for ${artist.name}`);
                return null;
            }
            
        } catch (error) {
            console.log(`   ❌ Error checking ${artist.name}: ${error.message}`);
            return null;
        }
    }

    async sendDailyReport(newReleases, totalArtists) {
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        if (newReleases.length === 0) {
            // Send "no new releases" message
            const message = `🌅 **Daily Release Report** - ${currentDate}\n\n` +
                          `📊 Checked **${totalArtists}** subscribed artists\n` +
                          `📭 No new releases today\n\n` +
                          `💡 Use \`/subscribe [artist]\` to add more artists!`;
            
            await this.discordService.sendMessage(message);
        } else {
            // Send header message
            const headerMessage = `🌅 **Daily Release Report** - ${currentDate}\n\n` +
                                 `📊 Checked **${totalArtists}** artists\n` +
                                 `🆕 Found **${newReleases.length}** new release(s)!\n`;
            
            await this.discordService.sendMessage(headerMessage);
            
            // Send each new release
            for (const release of newReleases) {
                await this.discordService.sendMessage(release.message);
                // Small delay between messages
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            // Send footer
            const footerMessage = `✅ Daily release check completed!`;
            await this.discordService.sendMessage(footerMessage);
        }
    }

    // Method to manually trigger the daily check (for testing)
    async triggerManualCheck() {
        console.log('🔄 Manual daily release check triggered');
        await this.performDailyReleaseCheck();
    }
}

module.exports = ScheduledReleaseService;