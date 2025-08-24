const cron = require('node-cron');

class ScheduledReleaseService {
    constructor(databaseService, spotifyService, discordService) {
        this.databaseService = databaseService;
        this.spotifyService = spotifyService;
        this.discordService = discordService;
        this.cronJob = null;
    }

    start() {
        // Schedule daily check at 09:00 (9 AM)
        this.cronJob = cron.schedule('0 9 * * *', async () => {
            console.log('🌅 Daily release check started at', new Date().toISOString());
            await this.performDailyReleaseCheck();
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        console.log('✅ Daily release checker scheduled for 09:00 UTC');
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

            console.log(`🔍 Checking ${artists.length} subscribed artists for TODAY's releases...`);

            const todayReleases = [];
            
            for (const artist of artists) {
                const releaseInfo = await this.checkArtistForTodayReleases(artist);
                if (releaseInfo) {
                    todayReleases.push(releaseInfo);
                }
                // Small delay between API calls
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Send results to Discord - send each release individually
            await this.sendDailyReport(todayReleases, artists.length);
            
            console.log(`✅ Daily release check completed. Found ${todayReleases.length} releases from today.`);
            
        } catch (error) {
            console.error('❌ Error in daily release check:', error.message);
            await this.discordService.sendMessage(`❌ Daily release check failed: ${error.message}`);
        }
    }

    async checkArtistForTodayReleases(artist) {
        try {
            console.log(`🔍 Checking ${artist.name}...`);
            
            const latestRelease = await this.spotifyService.getArtistLatestRelease(artist.name);
            
            if (!latestRelease) {
                console.log(`   ❌ No releases found for ${artist.name}`);
                return null;
            }

            // Check if the release is from TODAY (not before today)
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            const releaseDate = latestRelease.release_date;
            
            // Convert release date to comparable format and check if it's today or newer
            const isTodayOrNewer = this.isReleaseDateTodayOrNewer(releaseDate, today);
            
            if (isTodayOrNewer) {
                console.log(`   🆕 TODAY'S RELEASE: ${latestRelease.name} by ${artist.name} (${releaseDate})`);
                
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
                console.log(`   ℹ️ No releases today for ${artist.name} (latest: ${releaseDate})`);
                return null;
            }
            
        } catch (error) {
            console.log(`   ❌ Error checking ${artist.name}: ${error.message}`);
            return null;
        }
    }

    isReleaseDateTodayOrNewer(releaseDate, today) {
        try {
            // Handle different Spotify date formats
            let normalizedReleaseDate;
            
            if (releaseDate.length === 10) { // YYYY-MM-DD
                normalizedReleaseDate = releaseDate;
            } else if (releaseDate.length === 7) { // YYYY-MM
                // For month-only dates, assume it's the first day of the month
                normalizedReleaseDate = releaseDate + '-01';
            } else if (releaseDate.length === 4) { // YYYY
                // For year-only dates, assume it's January 1st
                normalizedReleaseDate = releaseDate + '-01-01';
            } else {
                console.log(`   ⚠️ Unknown date format: ${releaseDate}`);
                return false;
            }

            // Compare dates: only show if release date >= today
            const releaseDateObj = new Date(normalizedReleaseDate + 'T00:00:00.000Z');
            const todayObj = new Date(today + 'T00:00:00.000Z');
            
            const isToday = releaseDateObj.getTime() >= todayObj.getTime();
            
            console.log(`   📅 Date comparison: ${normalizedReleaseDate} >= ${today} = ${isToday}`);
            
            return isToday;
        } catch (error) {
            console.log(`   ❌ Error comparing dates: ${error.message}`);
            return false;
        }
    }

    async sendDailyReport(todayReleases, totalArtists) {
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        if (todayReleases.length === 0) {
            // Send "no new releases today" message
            const message = `🌅 **Daily Release Report** - ${currentDate}\n\n` +
                          `📊 Checked **${totalArtists}** subscribed artists\n` +
                          `📭 No new releases today\n\n` +
                          `💡 Use \`/subscribe [artist]\` to add more artists!`;
            
            await this.discordService.sendMessage(message);
        } else {
            // Send header message
            const headerMessage = `🌅 **Daily Release Report** - ${currentDate}\n\n` +
                                 `📊 Checked **${totalArtists}** artists\n` +
                                 `🆕 Found **${todayReleases.length}** release(s) from TODAY!\n`;
            
            await this.discordService.sendMessage(headerMessage);
            
            // Send EACH new release individually
            for (const release of todayReleases) {
                await this.discordService.sendMessage(release.message);
                console.log(`📤 Sent individual release: ${release.release.name} by ${release.artist}`);
                // Small delay between messages
                await new Promise(resolve => setTimeout(resolve, 2000));
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