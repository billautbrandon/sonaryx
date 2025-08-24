const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

// Create a new Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// When the client is ready, run this code
client.once('clientReady', () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`🎯 Target channel ID: ${process.env.DISCORD_CHANNEL_ID}`);
    
    // Start the cron job to send "Hello" every second
    startHelloCron();
});

function startHelloCron() {
    // Schedule a task to run every second
    cron.schedule('* * * * * *', async () => {
        try {
            const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
            
            if (!channel) {
                console.error('❌ Channel not found! Please check your DISCORD_CHANNEL_ID');
                return;
            }
            
            await channel.send('Hello');
            console.log(`📨 Message sent to #${channel.name} at ${new Date().toISOString()}`);
            
        } catch (error) {
            console.error('❌ Error sending message:', error.message);
        }
    });
    
    console.log('⏰ Cron job started - sending "Hello" every second');
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down bot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down bot...');
    client.destroy();
    process.exit(0);
});

// Login to Discord with your bot token
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Failed to login to Discord:', error.message);
    process.exit(1);
});