const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');

class DiscordService {
    constructor(databaseService, spotifyService) {
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds]
        });
        
        this.databaseService = databaseService;
        this.spotifyService = spotifyService;
        
        this.setupEventListeners();
        this.setupSlashCommands();
    }

    setupEventListeners() {
        this.client.once('clientReady', async () => {
            console.log(`✅ Discord Bot is ready! Logged in as ${this.client.user.tag}`);
            console.log(`🎯 Target channel ID: ${process.env.DISCORD_CHANNEL_ID}`);
            await this.registerSlashCommands();
        });

        // Handle slash command interactions
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            await this.handleSlashCommand(interaction);
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

    setupSlashCommands() {
        this.commands = [
            new SlashCommandBuilder()
                .setName('subscribe')
                .setDescription('Subscribe to an artist for release notifications')
                .addStringOption(option =>
                    option.setName('artist_name')
                        .setDescription('The name of the artist to subscribe to')
                        .setRequired(true)
                ),
            
            new SlashCommandBuilder()
                .setName('subscribe-id')
                .setDescription('Subscribe to an artist using their Spotify ID')
                .addStringOption(option =>
                    option.setName('artist_id')
                        .setDescription('The Spotify ID of the artist (e.g., 28ot3wh4oNmoFOdVajibBl)')
                        .setRequired(true)
                ),
            
            new SlashCommandBuilder()
                .setName('unsubscribe')
                .setDescription('Unsubscribe from an artist')
                .addStringOption(option =>
                    option.setName('artist_id')
                        .setDescription('The Spotify ID of the artist to unsubscribe from')
                        .setRequired(true)
                ),
            
            new SlashCommandBuilder()
                .setName('list')
                .setDescription('List all subscribed artists')
        ];
    }

    async registerSlashCommands() {
        try {
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
            
            console.log('🔄 Started refreshing application (/) commands...');
            
            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: this.commands.map(command => command.toJSON()) }
            );
            
            console.log('✅ Successfully reloaded application (/) commands');
        } catch (error) {
            console.error('❌ Error registering slash commands:', error);
        }
    }

    async handleSlashCommand(interaction) {
        const { commandName } = interaction;

        // Immediately acknowledge the interaction to prevent timeout
        try {
            await interaction.deferReply();
        } catch (error) {
            console.error('❌ Failed to defer reply:', error);
            return;
        }

        try {
            switch (commandName) {
                case 'subscribe':
                    await this.handleSubscribeCommand(interaction);
                    break;
                case 'subscribe-id':
                    await this.handleSubscribeByIdCommand(interaction);
                    break;
                case 'unsubscribe':
                    await this.handleUnsubscribeCommand(interaction);
                    break;
                case 'list':
                    await this.handleListCommand(interaction);
                    break;
                default:
                    await interaction.editReply('❌ Unknown command');
            }
        } catch (error) {
            console.error('❌ Error handling slash command:', error);
            const errorMessage = '❌ An error occurred while processing your command: ' + error.message;
            
            try {
                await interaction.editReply({ content: errorMessage });
            } catch (editError) {
                console.error('❌ Failed to edit reply:', editError);
            }
        }
    }

    async handleSubscribeCommand(interaction) {
        const artistName = interaction.options.getString('artist_name');
        
        try {
            // Search for the artist on Spotify
            console.log(`🔍 Searching for artist: ${artistName}`);
            const artist = await this.spotifyService.searchArtist(artistName);
            
            if (!artist) {
                await interaction.editReply(`❌ Artist "${artistName}" not found on Spotify.`);
                return;
            }

            console.log(`✅ Found artist: ${artist.name} (${artist.id})`);

            // Check if already subscribed
            const isSubscribed = await this.databaseService.isArtistSubscribed(artist.id);
            if (isSubscribed) {
                await interaction.editReply(`⚠️ Already subscribed to **${artist.name}** (\`${artist.id}\`)`);
                return;
            }

            // Subscribe to the artist
            await this.databaseService.subscribeToArtist(artist.id, artist.name);
            console.log(`✅ Subscribed to: ${artist.name}`);
            
            await interaction.editReply(
                `Subscribed to ${artist.name}\n` +
                `\n` +
                `ID: \`${artist.id}\`\n` +
                `Followers: ${artist.followers?.total?.toLocaleString() || 'Unknown'}\n` +
                `\n` +
                `Use /list to see all subscriptions.`
            );
        } catch (error) {
            console.error('❌ Error in subscribe command:', error);
            await interaction.editReply(`❌ Error subscribing to "${artistName}": ${error.message}`);
        }
    }

    async handleSubscribeByIdCommand(interaction) {
        const artistId = interaction.options.getString('artist_id');
        
        try {
            // Get artist by Spotify ID
            console.log(`🔍 Getting artist by ID: ${artistId}`);
            const artist = await this.spotifyService.getArtistById(artistId);
            
            if (!artist) {
                await interaction.editReply(`❌ Artist with ID "${artistId}" not found on Spotify.\n💡 Make sure you're using a valid Spotify artist ID.`);
                return;
            }

            console.log(`✅ Found artist by ID: ${artist.name} (${artist.id})`);

            // Check if already subscribed
            const isSubscribed = await this.databaseService.isArtistSubscribed(artist.id);
            if (isSubscribed) {
                await interaction.editReply(`⚠️ Already subscribed to **${artist.name}** (\`${artist.id}\`)`);
                return;
            }

            // Subscribe to the artist
            await this.databaseService.subscribeToArtist(artist.id, artist.name);
            console.log(`✅ Subscribed to: ${artist.name} via ID`);
            
            await interaction.editReply(
                `Subscribed to ${artist.name}\n` +
                `\n` +
                `ID: \`${artist.id}\`\n` +
                `Followers: ${artist.followers?.total?.toLocaleString() || 'Unknown'}\n` +
                `\n` +
                `Use /list to see all subscriptions.`
            );
        } catch (error) {
            console.error('❌ Error in subscribe-id command:', error);
            await interaction.editReply(`❌ Error subscribing to artist ID "${artistId}": ${error.message}`);
        }
    }

    async handleUnsubscribeCommand(interaction) {
        const artistId = interaction.options.getString('artist_id');
        
        try {
            console.log(`🗑️ Unsubscribing from artist: ${artistId}`);
            const artist = await this.databaseService.unsubscribeFromArtist(artistId);
            
            if (!artist) {
                await interaction.editReply(`❌ Artist with ID \`${artistId}\` not found in subscriptions.\n💡 Use \`/list\` to see your subscriptions.`);
                return;
            }

            console.log(`✅ Unsubscribed from: ${artist.name}`);
            await interaction.editReply(`Unsubscribed from ${artist.name} (\`${artistId}\`)`);
        } catch (error) {
            console.error('❌ Error in unsubscribe command:', error);
            await interaction.editReply(`❌ Error unsubscribing from artist: ${error.message}`);
        }
    }

    async handleListCommand(interaction) {
        try {
            console.log('📋 Fetching subscribed artists...');
            const artists = await this.databaseService.getSubscribedArtists();
            
            if (artists.length === 0) {
                await interaction.editReply('No artists subscribed yet.\n\nUse `/subscribe [artist_name]` to add artists.');
                return;
            }

            const artistList = artists.map((artist, index) => 
                `${index + 1}. **${artist.name}** (\`${artist.id}\`)`
            ).join('\n');

            console.log(`✅ Found ${artists.length} subscribed artists`);
            await interaction.editReply(
                `Subscribed Artists (${artists.length})\n\n${artistList}\n\n` +
                `Use /unsubscribe [artist_id] to remove an artist.\n` +
                `Use \`make check-releases\` in terminal to check for new releases.`
            );
        } catch (error) {
            console.error('❌ Error in list command:', error);
            await interaction.editReply(`❌ Error fetching subscriptions: ${error.message}`);
        }
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

    async sendMessage(message, options = {}) {
        try {
            const channel = this.client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
            
            if (!channel) {
                throw new Error('Channel not found! Please check your DISCORD_CHANNEL_ID');
            }

            // Support allowedMentions for explicit user pings
            const { allowedMentions } = options;
            if (allowedMentions) {
                await channel.send({ content: message, allowedMentions: { parse: [], ...allowedMentions } });
            } else {
                await channel.send(message);
            }
            console.log(`📨 Message sent to #${channel.name} at ${new Date().toISOString()}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending Discord message:', error.message);
            return false;
        }
    }

    async sendSpotifyRelease(releaseData) {
        try {
            const embed = this.buildReleaseEmbed(releaseData);
            const channel = this.client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
            if (!channel) {
                throw new Error('Channel not found! Please check your DISCORD_CHANNEL_ID');
            }
            await channel.send({ embeds: [embed] });
            return true;
        } catch (error) {
            console.error('❌ Error sending release embed:', error.message);
            return false;
        }
    }

    buildReleaseEmbed(releaseData) {
        const { name, artists, external_urls, release_date, album_type, total_tracks, images } = releaseData;
        const artistNames = (artists || []).map(a => a.name).join(', ');
        const cover = Array.isArray(images) && images.length > 0 ? images[0].url : null;
        const typeLabel = (album_type || '').charAt(0).toUpperCase() + (album_type || '').slice(1);

        const embed = new EmbedBuilder()
            .setTitle(name)
            .setURL(external_urls?.spotify || null)
            .setDescription(`${typeLabel}${typeLabel ? ' • ' : ''}${artistNames}`)
            .addFields(
                { name: 'Release date', value: release_date || 'Unknown', inline: true },
                { name: 'Tracks', value: String(total_tracks || 'Unknown'), inline: true }
            );

        if (cover) embed.setThumbnail(cover);
        return embed;
    }

    getClient() {
        return this.client;
    }
}

module.exports = DiscordService;