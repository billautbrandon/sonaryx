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
                )
                .addStringOption(option =>
                    option.setName('tags')
                        .setDescription('Tags for organization (e.g., "kpop,popular,rock")')
                        .setRequired(false)
                ),
            
            new SlashCommandBuilder()
                .setName('subscribe-id')
                .setDescription('Subscribe to an artist using their Spotify ID')
                .addStringOption(option =>
                    option.setName('artist_id')
                        .setDescription('The Spotify ID of the artist (e.g., 28ot3wh4oNmoFOdVajibBl)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('tags')
                        .setDescription('Tags for organization (e.g., "kpop,popular,rock")')
                        .setRequired(false)
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
                .addStringOption(option =>
                    option.setName('tag')
                        .setDescription('Filter by tag (leave empty to see all)')
                        .setRequired(false)
                ),

            new SlashCommandBuilder()
                .setName('tag')
                .setDescription('Add or update tags for an artist')
                .addStringOption(option =>
                    option.setName('artist_id')
                        .setDescription('The Spotify ID of the artist')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('tags')
                        .setDescription('Tags to set (e.g., "kpop,popular,rock")')
                        .setRequired(true)
                ),

            new SlashCommandBuilder()
                .setName('untag')
                .setDescription('Remove tags from an artist')
                .addStringOption(option =>
                    option.setName('artist_id')
                        .setDescription('The Spotify ID of the artist')
                        .setRequired(true)
                )
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
                case 'tag':
                    await this.handleTagCommand(interaction);
                    break;
                case 'untag':
                    await this.handleUntagCommand(interaction);
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
        const tags = interaction.options.getString('tags');
        
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

            // Subscribe to the artist with tags
            await this.databaseService.subscribeToArtist(artist.id, artist.name, tags);
            console.log(`✅ Subscribed to: ${artist.name}`);
            
            const tagsDisplay = tags ? `\nTags: ${tags}` : '';
            await interaction.editReply(
                `Subscribed to ${artist.name}\n` +
                `\n` +
                `ID: \`${artist.id}\`\n` +
                `Followers: ${artist.followers?.total?.toLocaleString() || 'Unknown'}${tagsDisplay}\n` +
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
        const tags = interaction.options.getString('tags');
        
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

            // Subscribe to the artist with tags
            await this.databaseService.subscribeToArtist(artist.id, artist.name, tags);
            console.log(`✅ Subscribed to: ${artist.name} via ID`);
            
            const tagsDisplay = tags ? `\nTags: ${tags}` : '';
            await interaction.editReply(
                `Subscribed to ${artist.name}\n` +
                `\n` +
                `ID: \`${artist.id}\`\n` +
                `Followers: ${artist.followers?.total?.toLocaleString() || 'Unknown'}${tagsDisplay}\n` +
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
            const filterTag = interaction.options.getString('tag');
            
            let artists;
            if (filterTag) {
                artists = await this.databaseService.getArtistsByTag(filterTag);
                console.log(`✅ Found ${artists.length} artists with tag "${filterTag}"`);
            } else {
                artists = await this.databaseService.getSubscribedArtists();
                console.log(`✅ Found ${artists.length} subscribed artists`);
            }
            
            if (artists.length === 0) {
                const message = filterTag 
                    ? `No artists found with tag "${filterTag}".\n\nUse \`/list\` to see all artists or use \`/tag\` to add tags to artists.`
                    : 'No artists subscribed yet.\n\nUse `/subscribe [artist_name]` to add artists.';
                await interaction.editReply(message);
                return;
            }

            // Group artists by tags
            const artistsByTag = new Map();
            const untaggedArtists = [];

            artists.forEach(artist => {
                if (!artist.tags || artist.tags.trim() === '') {
                    untaggedArtists.push(artist);
                } else {
                    const tags = artist.tags.split(',').map(tag => tag.trim().toLowerCase());
                    tags.forEach(tag => {
                        if (!artistsByTag.has(tag)) {
                            artistsByTag.set(tag, []);
                        }
                        artistsByTag.get(tag).push(artist);
                    });
                }
            });

            // Build organized list
            let output = [];
            const title = filterTag 
                ? `Artists with tag "${filterTag}" (${artists.length})`
                : `Subscribed Artists (${artists.length})`;
            
            output.push(`**${title}**\n`);

            if (filterTag) {
                // If filtering by tag, show simple list
                const artistList = artists.map((artist, index) => {
                    const tagsDisplay = artist.tags ? ` • ${artist.tags}` : '';
                    return `${index + 1}. **${artist.name}** (\`${artist.id}\`)${tagsDisplay}`;
                }).join('\n');
                output.push(artistList);
            } else {
                // Show organized by tags
                const sortedTags = Array.from(artistsByTag.keys()).sort();
                
                for (const tag of sortedTags) {
                    const tagArtists = artistsByTag.get(tag);
                    output.push(`**${tag.toUpperCase()}**`);
                    tagArtists.forEach((artist, index) => {
                        output.push(`${index + 1}. **${artist.name}** (\`${artist.id}\`)`);
                    });
                    output.push(''); // Empty line between tags
                }

                if (untaggedArtists.length > 0) {
                    output.push('**UNTAGGED**');
                    untaggedArtists.forEach((artist, index) => {
                        output.push(`${index + 1}. **${artist.name}** (\`${artist.id}\`)`);
                    });
                }
            }

            output.push(`\nUse \`/unsubscribe [artist_id]\` to remove an artist.`);
            output.push(`Use \`/tag [artist_id] [tags]\` to add tags.`);
            output.push(`Use \`/list [tag]\` to filter by tag.`);

            await interaction.editReply(output.join('\n'));
        } catch (error) {
            console.error('❌ Error in list command:', error);
            await interaction.editReply(`❌ Error fetching subscriptions: ${error.message}`);
        }
    }

    async handleTagCommand(interaction) {
        const artistId = interaction.options.getString('artist_id');
        const tags = interaction.options.getString('tags');
        
        try {
            // Check if artist exists in our database
            const isSubscribed = await this.databaseService.isArtistSubscribed(artistId);
            if (!isSubscribed) {
                await interaction.editReply(`❌ Artist ID "${artistId}" is not subscribed.\n\nUse \`/list\` to see subscribed artists.`);
                return;
            }

            // Update tags
            const artist = await this.databaseService.updateArtistTags(artistId, tags);
            console.log(`✅ Updated tags for artist: ${artist.name}`);
            
            await interaction.editReply(
                `Updated tags for **${artist.name}**\n` +
                `\n` +
                `ID: \`${artistId}\`\n` +
                `Tags: ${tags}\n` +
                `\n` +
                `Use \`/list\` to see organized artists.`
            );
        } catch (error) {
            console.error('❌ Error in tag command:', error);
            await interaction.editReply(`❌ Error updating tags for artist: ${error.message}`);
        }
    }

    async handleUntagCommand(interaction) {
        const artistId = interaction.options.getString('artist_id');
        
        try {
            // Check if artist exists in our database
            const isSubscribed = await this.databaseService.isArtistSubscribed(artistId);
            if (!isSubscribed) {
                await interaction.editReply(`❌ Artist ID "${artistId}" is not subscribed.\n\nUse \`/list\` to see subscribed artists.`);
                return;
            }

            // Remove tags
            const artist = await this.databaseService.updateArtistTags(artistId, null);
            console.log(`✅ Removed tags for artist: ${artist.name}`);
            
            await interaction.editReply(
                `Removed all tags for **${artist.name}**\n` +
                `\n` +
                `ID: \`${artistId}\`\n` +
                `\n` +
                `Use \`/tag [artist_id] [tags]\` to add new tags.`
            );
        } catch (error) {
            console.error('❌ Error in untag command:', error);
            await interaction.editReply(`❌ Error removing tags for artist: ${error.message}`);
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