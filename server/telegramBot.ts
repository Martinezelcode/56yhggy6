import fetch from 'node-fetch';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID;

interface ChallengeMessage {
  id: number;
  title: string;
  description?: string;
  amount: number;
  category: string;
  creator: {
    username: string;
    firstName?: string;
  };
  challengeType: 'open' | 'direct' | 'admin';
  status: string;
  expirationHours?: number;
  isAdminChallenge?: boolean;
}

class TelegramBot {
  private token: string;
  private channelId: string;
  private groupId: string;

  constructor() {
    this.token = TELEGRAM_BOT_TOKEN || '';
    this.channelId = TELEGRAM_CHANNEL_ID || '';
    this.groupId = TELEGRAM_GROUP_ID || '';
  }

  isConfigured(): boolean {
    return !!(this.token && (this.channelId || this.groupId));
  }

  /**
   * Format challenge message for Telegram
   * No tags for admin challenges, but tags for P2P challenges
   */
  private formatChallengeMessage(challenge: ChallengeMessage): string {
    const baseInfo = `
🎯 <b>New Challenge: ${challenge.title}</b>

💰 <b>Amount:</b> ${challenge.amount} USDC
🏷️ <b>Category:</b> ${challenge.category}
📝 <b>Type:</b> ${challenge.challengeType === 'admin' ? 'Betting Pool' : challenge.challengeType === 'direct' ? 'Direct Challenge' : 'Open Challenge'}
⏱️ <b>Expires in:</b> ${challenge.expirationHours || 24} hours
${challenge.description ? `\n📄 <b>Details:</b> ${challenge.description}` : ''}
`;

    // Only add tags for P2P challenges, NOT for admin challenges
    if (!challenge.isAdminChallenge && challenge.creator.username) {
      return `${baseInfo}\n👤 <b>Created by:</b> @${challenge.creator.username}`;
    }

    return baseInfo;
  }

  /**
   * Broadcast challenge to Telegram channel and group
   */
  async broadcastChallenge(challenge: ChallengeMessage): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Telegram bot not configured');
      return false;
    }

    try {
      const message = this.formatChallengeMessage(challenge);
      
      // Send to channel if configured
      if (this.channelId) {
        await this.sendMessage(this.channelId, message);
      }

      // Send to group if configured and not already sent to same ID
      if (this.groupId && this.groupId !== this.channelId) {
        await this.sendMessage(this.groupId, message);
      }

      console.log(`✅ Challenge broadcast to Telegram: ${challenge.title}`);
      return true;
    } catch (error) {
      console.error('Failed to broadcast challenge to Telegram:', error);
      return false;
    }
  }

  /**
   * Send a message to a Telegram chat
   */
  private async sendMessage(chatId: string, message: string): Promise<void> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
      }
    } catch (error) {
      console.error(`Error sending message to Telegram chat ${chatId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const telegramBot = new TelegramBot();

export default telegramBot;
