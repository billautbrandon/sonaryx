const SpotifyWebApi = require('spotify-web-api-node');

class SpotifyService {
    constructor() {
        this.spotifyApi = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET
        });
        
        this.isAuthenticated = false;
        this.lastReleaseId = null;
    }

    async authenticate() {
        try {
            const data = await this.spotifyApi.clientCredentialsGrant();
            this.spotifyApi.setAccessToken(data.body['access_token']);
            this.isAuthenticated = true;
            console.log('✅ Spotify API authenticated successfully');
            
            // Set up token refresh
            setTimeout(() => {
                this.authenticate();
            }, data.body['expires_in'] * 1000 - 60000); // Refresh 1 minute before expiry
            
            return true;
        } catch (error) {
            console.error('❌ Failed to authenticate with Spotify:', error.message);
            this.isAuthenticated = false;
            return false;
        }
    }

    async searchArtist(artistName) {
        if (!this.isAuthenticated) {
            const authenticated = await this.authenticate();
            if (!authenticated) return null;
        }

        try {
            const searchResult = await this.spotifyApi.searchArtists(artistName, { limit: 1 });
            
            if (searchResult.body.artists.items.length === 0) {
                console.error(`❌ Artist "${artistName}" not found`);
                return null;
            }

            return searchResult.body.artists.items[0];
        } catch (error) {
            console.error('❌ Error searching for artist:', error.message);
            return null;
        }
    }

    async getArtistById(artistId) {
        if (!this.isAuthenticated) {
            const authenticated = await this.authenticate();
            if (!authenticated) return null;
        }

        try {
            const artistResult = await this.spotifyApi.getArtist(artistId);
            console.log(`✅ Found artist by ID: ${artistResult.body.name} (${artistId})`);
            return artistResult.body;
        } catch (error) {
            console.error(`❌ Error getting artist by ID "${artistId}":`, error.message);
            return null;
        }
    }

    async getArtistLatestRelease(artistName) {
        try {
            const artist = await this.searchArtist(artistName);
            if (!artist) return null;

            console.log(`🔍 Found artist: ${artist.name} (ID: ${artist.id})`);

            // Get artist's albums, including singles and compilations
            const albumsResult = await this.spotifyApi.getArtistAlbums(artist.id, {
                include_groups: 'album,single,compilation',
                market: 'US',
                limit: 50
            });

            if (albumsResult.body.items.length === 0) {
                console.error(`❌ No releases found for artist "${artistName}"`);
                return null;
            }

            // Sort by release date (most recent first)
            const sortedReleases = albumsResult.body.items.sort((a, b) => {
                return new Date(b.release_date) - new Date(a.release_date);
            });

            const latestRelease = sortedReleases[0];
            
            // Get detailed album information
            const albumDetails = await this.spotifyApi.getAlbum(latestRelease.id);
            
            console.log(`🎵 Latest release: ${albumDetails.body.name} (${albumDetails.body.release_date})`);
            
            return albumDetails.body;
        } catch (error) {
            console.error('❌ Error getting artist latest release:', error.message);
            return null;
        }
    }

    async checkForNewRelease(artistName) {
        const latestRelease = await this.getArtistLatestRelease(artistName);
        
        if (!latestRelease) return null;

        // Check if this is a new release (different from last known)
        if (this.lastReleaseId && this.lastReleaseId === latestRelease.id) {
            console.log(`ℹ️  No new release found for ${artistName}`);
            return null;
        }

        // Update the last known release
        this.lastReleaseId = latestRelease.id;
        console.log(`🆕 New release detected: ${latestRelease.name}`);
        
        return latestRelease;
    }

    isReady() {
        return this.isAuthenticated;
    }
}

module.exports = SpotifyService;