// Mock Telegram sender for Ralph Loop
export async function sendTelegram(message: string) {
  console.log(`[TELEGRAM MOCK] Sending message: \n${message}`);
  return { success: true };
}
