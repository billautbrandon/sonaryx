const { Client, GatewayIntentBits } = require('discord.js');

class DiscordService {
    constructor() {
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds]
        });
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.once('clientReady', () => {
            console.log(`✅ Discord Bot is ready! Logged in as ${this.client.user.tag}`);
            console.log(`🎯 Target channel ID: ${process.env.DISCORD_CHANNEL_ID}`);
        });

        // Handle process termination gracefully
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down Discord bot...');
            this.client.destroy();
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down Discord bot...');
            this.client.destroy();
        });
    }

    async login() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
            return true;
        } catch (error) {
            console.error('❌ Failed to login to Discord:', error.message);
            return false;
        }
    }

    async sendMessage(message) {
        try {
            const channel = this.client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
            
            if (!channel) {
                throw new Error('Channel not found! Please check your DISCORD_CHANNEL_ID');
            }
            
            await channel.send(message);
            console.log(`📨 Message sent to #${channel.name} at ${new Date().toISOString()}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending Discord message:', error.message);
            return false;
        }
    }

    async sendSpotifyRelease(releaseData) {
        const { name, artists, external_urls, release_date, album_type, total_tracks } = releaseData;
        
        const artistNames = artists.map(artist => artist.name).join(', ');
        const message = `🎵 **Latest ${album_type}**: **${name}** by **${artistNames}**\n` +
                       `📅 Released: ${release_date}\n` +
                       `🎧 Tracks: ${total_tracks}\n` +
                       `🔗 Listen: ${external_urls.spotify}`;
        
        return await this.sendMessage(message);
    }

    getClient() {
        return this.client;
    }
}

module.exports = DiscordService;