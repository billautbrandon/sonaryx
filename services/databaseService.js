const { PrismaClient } = require('../generated/prisma');

class DatabaseService {
    constructor() {
        this.prisma = new PrismaClient();
    }

    async connect() {
        try {
            await this.prisma.$connect();
            console.log('✅ Database connected successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to database:', error.message);
            return false;
        }
    }

    async disconnect() {
        await this.prisma.$disconnect();
    }

    // Artist subscription management
    async subscribeToArtist(artistId, artistName, tags = null) {
        try {
            const artist = await this.prisma.artist.upsert({
                where: { id: artistId },
                update: { 
                    name: artistName,
                    tags: tags || undefined // Only update tags if provided
                },
                create: {
                    id: artistId,
                    name: artistName,
                    tags: tags
                }
            });
            
            const tagsStr = tags ? ` with tags: ${tags}` : '';
            console.log(`✅ Subscribed to artist: ${artistName} (${artistId})${tagsStr}`);
            return artist;
        } catch (error) {
            console.error('❌ Error subscribing to artist:', error.message);
            throw error;
        }
    }

    async unsubscribeFromArtist(artistId) {
        try {
            const artist = await this.prisma.artist.findUnique({
                where: { id: artistId }
            });

            if (!artist) {
                return null;
            }

            await this.prisma.artist.delete({
                where: { id: artistId }
            });

            console.log(`✅ Unsubscribed from artist: ${artist.name} (${artistId})`);
            return artist;
        } catch (error) {
            console.error('❌ Error unsubscribing from artist:', error.message);
            throw error;
        }
    }

    async getSubscribedArtists() {
        try {
            const artists = await this.prisma.artist.findMany({
                orderBy: { createdAt: 'desc' }
            });
            return artists;
        } catch (error) {
            console.error('❌ Error fetching subscribed artists:', error.message);
            throw error;
        }
    }

    async updateArtistLastRelease(artistId, releaseId) {
        try {
            await this.prisma.artist.update({
                where: { id: artistId },
                data: { lastReleaseId: releaseId }
            });
        } catch (error) {
            console.error('❌ Error updating artist last release:', error.message);
            throw error;
        }
    }

    async isArtistSubscribed(artistId) {
        try {
            const artist = await this.prisma.artist.findUnique({
                where: { id: artistId }
            });
            return !!artist;
        } catch (error) {
            console.error('❌ Error checking artist subscription:', error.message);
            return false;
        }
    }

    // Daily release management
    async storeDailyReleases(date, releases) {
        try {
            // First, delete existing releases for this date to replace them
            await this.prisma.dailyRelease.deleteMany({
                where: { date }
            });

            // Store new releases for this date
            if (releases && releases.length > 0) {
                await this.prisma.dailyRelease.createMany({
                    data: releases.map(release => ({
                        date,
                        spotifyLink: release.spotifyLink,
                        artistName: release.artistName,
                        releaseName: release.releaseName,
                        releaseId: release.releaseId,
                        releaseType: release.releaseType,
                        releaseDate: release.releaseDate
                    }))
                });
                console.log(`✅ Stored ${releases.length} releases for date ${date}`);
            } else {
                console.log(`✅ Cleared releases for date ${date} (no new releases)`);
            }
        } catch (error) {
            console.error('❌ Error storing daily releases:', error.message);
            throw error;
        }
    }

    async getDailyReleases(date) {
        try {
            const releases = await this.prisma.dailyRelease.findMany({
                where: { date },
                orderBy: { createdAt: 'asc' }
            });
            return releases;
        } catch (error) {
            console.error('❌ Error fetching daily releases:', error.message);
            throw error;
        }
    }

    async getStoredReleaseIds(date) {
        try {
            const releases = await this.prisma.dailyRelease.findMany({
                where: { date },
                select: { releaseId: true }
            });
            return releases.map(r => r.releaseId);
        } catch (error) {
            console.error('❌ Error fetching stored release IDs:', error.message);
            throw error;
        }
    }

    // Tag management
    async updateArtistTags(artistId, tags) {
        try {
            const artist = await this.prisma.artist.update({
                where: { id: artistId },
                data: { tags: tags }
            });
            console.log(`✅ Updated tags for ${artist.name}: ${tags || '(no tags)'}`);
            return artist;
        } catch (error) {
            console.error('❌ Error updating artist tags:', error.message);
            throw error;
        }
    }

    async getArtistsByTag(tag) {
        try {
            const artists = await this.prisma.artist.findMany({
                where: {
                    tags: {
                        contains: tag
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return artists;
        } catch (error) {
            console.error('❌ Error fetching artists by tag:', error.message);
            throw error;
        }
    }

    async getAllTags() {
        try {
            const artists = await this.prisma.artist.findMany({
                select: { tags: true },
                where: {
                    tags: {
                        not: null
                    }
                }
            });
            
            const tagSet = new Set();
            artists.forEach(artist => {
                if (artist.tags) {
                    artist.tags.split(',').forEach(tag => {
                        tagSet.add(tag.trim().toLowerCase());
                    });
                }
            });
            
            return Array.from(tagSet).sort();
        } catch (error) {
            console.error('❌ Error fetching all tags:', error.message);
            throw error;
        }
    }
}

module.exports = DatabaseService;