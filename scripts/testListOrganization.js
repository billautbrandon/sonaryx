require('dotenv').config();

const DatabaseService = require('../services/databaseService');

// Mock the list command output format
function simulateListCommand(artists, filterTag = null) {
    if (artists.length === 0) {
        const message = filterTag 
            ? `No artists found with tag "${filterTag}".\n\nUse \`/list\` to see all artists or use \`/tag\` to add tags to artists.`
            : 'No artists subscribed yet.\n\nUse `/subscribe [artist_name]` to add artists.';
        return message;
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

    return output.join('\n');
}

async function demonstrateListOutput() {
    console.log('🎭 Demonstrating /list command output format...\n');
    
    // Sample artists with various tag combinations
    const sampleArtists = [
        { id: 'artist1', name: 'NewJeans', tags: 'kpop,popular' },
        { id: 'artist2', name: 'BLACKPINK', tags: 'kpop,popular' },
        { id: 'artist3', name: 'Metallica', tags: 'metal,rock' },
        { id: 'artist4', name: 'Arctic Monkeys', tags: 'rock,indie' },
        { id: 'artist5', name: 'Travis Scott', tags: 'rap,popular' },
        { id: 'artist6', name: 'Some Unknown Artist', tags: null },
        { id: 'artist7', name: 'Boy Pablo', tags: 'indie,alternative' }
    ];

    console.log('📋 Full /list output (organized by tags):');
    console.log('─'.repeat(60));
    console.log(simulateListCommand(sampleArtists));
    
    console.log('\n\n🔍 /list kpop output (filtered by tag):');
    console.log('─'.repeat(60));
    const kpopArtists = sampleArtists.filter(a => a.tags && a.tags.includes('kpop'));
    console.log(simulateListCommand(kpopArtists, 'kpop'));

    console.log('\n\n🔍 /list metal output (filtered by tag):');
    console.log('─'.repeat(60));
    const metalArtists = sampleArtists.filter(a => a.tags && a.tags.includes('metal'));
    console.log(simulateListCommand(metalArtists, 'metal'));

    console.log('\n\n✅ List organization demonstration completed!');
}

demonstrateListOutput().catch(console.error);