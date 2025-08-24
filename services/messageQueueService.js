const fs = require('fs').promises;
const path = require('path');

class MessageQueueService {
    constructor(discordService) {
        this.discordService = discordService;
        this.messagesDir = '/app/data/messages';
        this.isProcessing = false;
        this.processingInterval = null;
    }

    async start() {
        // Ensure messages directory exists
        await fs.mkdir(this.messagesDir, { recursive: true });
        
        // Start processing messages every 5 seconds
        this.processingInterval = setInterval(() => {
            this.processMessages();
        }, 5000);
        
        console.log('✅ Message queue processor started');
    }

    async stop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        console.log('🛑 Message queue processor stopped');
    }

    async processMessages() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const files = await fs.readdir(this.messagesDir);
            const messageFiles = files.filter(file => file.endsWith('.json'));

            for (const file of messageFiles) {
                const filepath = path.join(this.messagesDir, file);
                
                try {
                    const content = await fs.readFile(filepath, 'utf8');
                    const messageData = JSON.parse(content);

                    if (!messageData.processed) {
                        // Send message via Discord
                        await this.discordService.sendMessage(messageData.message);
                        console.log(`📤 Sent queued message: ${file}`);
                        
                        // Mark as processed or delete the file
                        await fs.unlink(filepath);
                    }
                } catch (error) {
                    console.error(`❌ Error processing message file ${file}:`, error.message);
                    // Delete corrupted files
                    await fs.unlink(filepath).catch(() => {});
                }
            }
        } catch (error) {
            console.error('❌ Error processing message queue:', error.message);
        } finally {
            this.isProcessing = false;
        }
    }
}

module.exports = MessageQueueService;