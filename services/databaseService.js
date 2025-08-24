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
    async subscribeToArtist(artistId, artistName) {
        try {
            const artist = await this.prisma.artist.upsert({
                where: { id: artistId },
                update: { name: artistName },
                create: {
                    id: artistId,
                    name: artistName
                }
            });
            
            console.log(`✅ Subscribed to artist: ${artistName} (${artistId})`);
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
}

module.exports = DatabaseService;