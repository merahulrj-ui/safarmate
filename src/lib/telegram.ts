const TELEGRAM_BOT_TOKEN = '8997420839:AAFklr2Jez9jkzAUbV64Iq0N9DaaCEx426Y';
const TELEGRAM_CHAT_ID = '6981816676';

/**
 * Sends a Markdown formatted message to the Telegram bot
 * @param text The HTML formatted text to send
 */
export const sendTelegramNotification = async (text: string) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      console.log('Telegram API Error:', await response.text());
    }
  } catch (error) {
    console.log('Telegram notification failed', error);
  }
};
