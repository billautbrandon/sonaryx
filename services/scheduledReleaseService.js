const cron = require('node-cron');

class ScheduledReleaseService {
    constructor(databaseService, spotifyService, discordService) {
        this.databaseService = databaseService;
        this.spotifyService = spotifyService;
        this.discordService = discordService;
        this.cronJob = null;
        this.isRunning = false;
    }

    start() {
        const schedule = process.env.CRON_SCHEDULE || '0 9 * * *';
        const timezone = process.env.CRON_TZ || 'UTC';

        if (!cron.validate(schedule)) {
            console.error(`❌ Invalid CRON_SCHEDULE "${schedule}". Scheduler not started.`);
            return;
        }

        console.log(
            `✅ Scheduling daily checker: CRON="${schedule}" TZ="${timezone}" (now=${new Date().toISOString()})`
        );

        this.cronJob = cron.schedule(
            schedule,
            async () => {
                if (this.isRunning) {
                    console.warn('⏳ Skipping run: previous job still running.');
                    return;
                }
                this.isRunning = true;
                const startedAt = new Date().toISOString();
                console.log(`⏰ Cron fired at ${startedAt} (CRON="${schedule}" TZ="${timezone}")`);
                try {
                    await this.performDailyReleaseCheck();
                } catch (error) {
                    console.error('❌ Cron execution error:', error?.message || error);
                } finally {
                    this.isRunning = false;
                    console.log(`✅ Cron job finished at ${new Date().toISOString()}`);
                }
            },
            {
                scheduled: true,
                timezone
            }
        );

        if (process.env.RUN_ON_START === 'true') {
            setTimeout(async () => {
                console.log('🚀 RUN_ON_START=true → triggering an immediate daily check...');
                try {
                    await this.performDailyReleaseCheck();
                } catch (error) {
                    console.error('❌ Immediate run failed:', error?.message || error);
                }
            }, 5000);
        }
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
            const tz = process.env.CRON_TZ || 'UTC';
            const windowDays = Math.max(parseInt(process.env.RELEASE_WINDOW_DAYS || '0', 10) || 0, 0);
            const todayYMD = this.getTodayYMD(tz);
            const cutoffYMD = this.getCutoffYMD(todayYMD, windowDays, tz);
            console.log(`🕒 Date window: cutoff=${cutoffYMD} (windowDays=${windowDays}, tz=${tz})`);
            const artists = await this.databaseService.getSubscribedArtists();

            if (artists.length === 0) {
                console.log('📭 No artists subscribed for daily check');
                return;
            }

            console.log(`🔍 Checking ${artists.length} subscribed artists for releases on/after ${cutoffYMD}...`);

            const todayReleases = [];
            for (const artist of artists) {
                const releaseInfo = await this.checkArtistForTodayReleases(artist, cutoffYMD);
                if (releaseInfo) {
                    todayReleases.push(releaseInfo);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            await this.sendDailyReport(todayReleases, artists.length);
            console.log(`✅ Daily release check completed. Found ${todayReleases.length} releases from today.`);
        } catch (error) {
            console.error('❌ Error in daily release check:', error.message);
            await this.discordService.sendMessage(`❌ Daily release check failed: ${error.message}`);
        }
    }

    async checkArtistForTodayReleases(artist, cutoffYMD) {
        try {
            console.log(`🔍 Checking ${artist.name}...`);
            
            const latestRelease = await this.spotifyService.getArtistLatestRelease(artist.name);
            
            if (!latestRelease) {
                console.log(`   ❌ No releases found for ${artist.name}`);
                return null;
            }

            const releaseDate = latestRelease.release_date;
            
            // Convert release date to comparable format and check if it's on/after cutoff
            const isOnOrAfterCutoff = this.isReleaseDateTodayOrNewer(releaseDate, cutoffYMD);
            
            if (isOnOrAfterCutoff) {
                console.log(`   🆕 Release passes cutoff (${cutoffYMD}): ${latestRelease.name} by ${artist.name} (${releaseDate})`);
                
                // Update the database with the new release
                await this.databaseService.updateArtistLastRelease(artist.id, latestRelease.id);
                
                // Return only the Spotify link for concise messaging
                return {
                    artist: artist.name,
                    release: latestRelease,
                    link: latestRelease.external_urls.spotify
                };
            } else {
                console.log(`   ℹ️ No releases on/after ${cutoffYMD} for ${artist.name} (latest: ${releaseDate})`);
                return null;
            }
            
        } catch (error) {
            console.log(`   ❌ Error checking ${artist.name}: ${error.message}`);
            return null;
        }
    }

    getTodayYMD(timezone) {
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = fmt.formatToParts(new Date());
        const y = parts.find(p => p.type === 'year').value;
        const m = parts.find(p => p.type === 'month').value;
        const d = parts.find(p => p.type === 'day').value;
        return `${y}-${m}-${d}`; // YYYY-MM-DD
    }

    getCutoffYMD(todayYMD, windowDays, timezone) {
        if (windowDays === 0) return todayYMD;
        const [y, m, d] = todayYMD.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() - windowDays);
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = fmt.formatToParts(dt);
        const yy = parts.find(p => p.type === 'year').value;
        const mm = parts.find(p => p.type === 'month').value;
        const dd = parts.find(p => p.type === 'day').value;
        return `${yy}-${mm}-${dd}`;
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

        // Single-message output using requested template
        if (todayReleases.length > 0) {
            const links = todayReleases.map(r => r.link).filter(Boolean);
            const interestedMembers = (process.env.INTERESTED_MEMBERS || '').trim();
            const interestedMemberIdsRaw = (process.env.INTERESTED_MEMBER_IDS || '').trim();
            const interestedIds = interestedMemberIdsRaw
                ? interestedMemberIdsRaw
                    .split(/[ ,\n\t]+/)
                    .map(t => t && t.replace(/[^0-9]/g, ''))
                    .filter(t => t && t.length >= 5)
                : [];
            const mentionText = interestedIds.length > 0
                ? interestedIds.map(id => `<@${id}>`).join(' ')
                : interestedMembers;

            const header = `:calendar: Daily Release Report — **${currentDate}**`;
            const metaLines = [
                `> New releases today:   **${todayReleases.length}**`,
                mentionText ? `> Interested members: ${mentionText}` : null
            ].filter(Boolean);

            const body = links.map(l => `* ${l}`).join('\n');

            const combined = [header, '', ...metaLines, '', body].join('\n');

            await this.discordService.sendMessage(combined, {
                allowedMentions: interestedIds.length > 0 ? { users: interestedIds } : undefined
            });
        } else {
            // Minimal single message on no releases
            const msg = `Release check completed.\n\nNo new releases found for any subscribed artists.`;
            await this.discordService.sendMessage(msg);
            console.log(`📭 No releases from today - sent no-release notification to Discord`);
        }
    }

    // Method to manually trigger the daily check (for testing)
    async triggerManualCheck() {
        console.log('🔄 Manual daily release check triggered');
        await this.performDailyReleaseCheck();
    }
}

module.exports = ScheduledReleaseService;