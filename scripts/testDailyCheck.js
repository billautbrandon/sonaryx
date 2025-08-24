#!/usr/bin/env node
require('dotenv').config();

const DatabaseService = require('../services/databaseService');
const SpotifyService = require('../services/spotifyService');
const fs = require('fs').promises;
const path = require('path');

class DailyCheckTester {
    constructor() {
        this.databaseService = new DatabaseService();
        this.spotifyService = new SpotifyService();
        this.messagesDir = '/app/data/messages';
    }

    async initialize() {
        await this.databaseService.connect();
        await this.spotifyService.authenticate();
        await fs.mkdir(this.messagesDir, { recursive: true });
        console.log('✅ Services initialized');
    }

    async sendDiscordMessage(message) {
        try {
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 15);
            const filename = `message_${timestamp}_${randomId}.json`;
            const filepath = path.join(this.messagesDir, filename);
            
            const messageData = {
                message: message,
                timestamp: new Date().toISOString(),
                processed: false
            };
            
            await fs.writeFile(filepath, JSON.stringify(messageData, null, 2));
            console.log(`📤 Message queued for Discord: ${filename}`);
        } catch (error) {
            console.error('❌ Error queuing Discord message:', error.message);
        }
    }

    async performDailyReleaseCheck() {
        try {
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
                await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay
            }
            await this.sendDailyReport(todayReleases, artists.length);
            console.log(`✅ Daily release check completed. Found ${todayReleases.length} releases from today.`);
        } catch (error) {
            console.error('❌ Error in daily release check:', error.message);
            await this.sendDiscordMessage(`❌ Daily release check failed: ${error.message}`);
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

            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const releaseDate = latestRelease.release_date;
            const isToday = this.isReleaseDateTodayOrNewer(releaseDate, today);
            
            if (isToday) {
                console.log(`   🆕 TODAY'S RELEASE: ${latestRelease.name} by ${artist.name} (${releaseDate})`);
                await this.databaseService.updateArtistLastRelease(artist.id, latestRelease.id);
                const artistNames = latestRelease.artists.map(a => a.name).join(', ');
                const releaseType = latestRelease.album_type.charAt(0).toUpperCase() + latestRelease.album_type.slice(1);
                return {
                    release: latestRelease,
                    artist: artist.name,
                    message: `🆕 **NEW RELEASE!**\n` +
                             `🎵 **${releaseType}**: ${latestRelease.name}\n` +
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
            let normalizedReleaseDate;
            
            if (releaseDate.length === 10) { // YYYY-MM-DD
                normalizedReleaseDate = releaseDate;
            } else if (releaseDate.length === 7) { // YYYY-MM
                normalizedReleaseDate = releaseDate + '-01';
            } else if (releaseDate.length === 4) { // YYYY
                normalizedReleaseDate = releaseDate + '-01-01';
            } else {
                console.log(`   ⚠️ Unknown date format: ${releaseDate}`);
                return false;
            }

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
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // Issue 3 fix: Only send messages if there are releases
        if (todayReleases.length > 0) {
            const headerMessage = `🌅 **Daily Release Report** - ${currentDate}\n\n` +
                                 `📊 Checked **${totalArtists}** artists\n` +
                                 `🆕 Found **${todayReleases.length}** release(s) from TODAY!\n`;
            await this.sendDiscordMessage(headerMessage);
            
            for (const release of todayReleases) {
                await this.sendDiscordMessage(release.message);
                console.log(`📤 Sent individual release: ${release.release.name} by ${release.artist}`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay
            }
            const footerMessage = `✅ Daily release check completed!`;
            await this.sendDiscordMessage(footerMessage);
        } else {
            console.log(`📭 No releases from today - not sending any Discord messages (avoiding spam)`);
        }
    }

    async cleanup() {
        await this.databaseService.disconnect();
    }
}

async function testDailyCheck() {
    console.log('🧪 Testing daily release check functionality...');
    
    const tester = new DailyCheckTester();
    
    try {
        await tester.initialize();
        await tester.performDailyReleaseCheck();
        console.log('✅ Daily check test completed');
    } catch (error) {
        console.error('❌ Error in daily check test:', error.message);
        process.exit(1);
    } finally {
        await tester.cleanup();
        process.exit(0);
    }
}

testDailyCheck();