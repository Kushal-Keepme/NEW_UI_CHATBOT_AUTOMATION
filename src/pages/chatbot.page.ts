import { Page, Locator, expect, FrameLocator } from '@playwright/test';
import { BasePage } from './base.page';
import { chatbotLocators } from '../locators/chatbot.locators';
import { resolveLocator } from '../utils/locator.resolver';

export class ChatbotPage extends BasePage {
    private readonly frame: FrameLocator;

    private readonly messageInput: Locator;
    private readonly sendButton: Locator;
    private readonly latestBotMessage: Locator;
    private readonly botMessages: Locator;
    private latestSeenBotText = '';

    constructor(page: Page) {
        super(page);

        // Scope everything to iframe
        this.frame = this.page.frameLocator(chatbotLocators.chatbotIframe.value);

        // Resolve locators INSIDE iframe
        this.messageInput = resolveLocator(this.frame, chatbotLocators.messageInputField);
        this.sendButton = resolveLocator(this.frame, chatbotLocators.sendButton);
        this.latestBotMessage = resolveLocator(this.frame, chatbotLocators.botMessageText);
        this.botMessages = resolveLocator(this.frame, chatbotLocators.botMessages);
    }

    async openChatbot(): Promise<void> {
        const icon = resolveLocator(this.page, chatbotLocators.chatbotIcon);
        await icon.waitFor({ state: 'visible' });
        await icon.click();
        await this.acceptGdprConsentIfShown();
    }

    // Some bots open with a "GDPR & Marketing Permissions" prompt that must be
    // accepted before chatting; others don't show it at all, so it's optional.
    async acceptGdprConsentIfShown(timeout = 8000): Promise<void> {
        // The prompt may render inside the chat iframe or on the host page
        const candidates = [
            resolveLocator(this.frame, chatbotLocators.gdprAcceptButton).first(),
            resolveLocator(this.page, chatbotLocators.gdprAcceptButton).first(),
        ];

        const start = Date.now();
        while (Date.now() - start < timeout) {
            for (const accept of candidates) {
                if (await accept.isVisible().catch(() => false)) {
                    console.log('[GDPR] Consent prompt shown — clicking "Yes, I accept"');
                    await accept.click();
                    return;
                }
            }
            await this.page.waitForTimeout(250);
        }
        console.log('[GDPR] No consent prompt shown — continuing');
    }

    async validateGreetingContains(expectedText: string, timeout = 10000): Promise<void> {
        await expect(this.latestBotMessage).toBeVisible({ timeout });

        const actual = (await this.latestBotMessage.innerText({ timeout })).trim();

        if (!actual.toLowerCase().includes(expectedText.toLowerCase())) {
            throw new Error(`Expected greeting to contain "${expectedText}" (case-insensitive). Received: "${actual}"`);
        }
    }

    async sendMessage(message: string): Promise<void> {
        const input = resolveLocator(this.frame, chatbotLocators.messageInputField);

        try {
            // Ensure input is visible and clear any existing content
            await input.waitFor({ state: 'visible', timeout: 30000 });
            // The input is disabled while the bot is still replying — wait for it
            await input.click({ timeout: 30000 });
            await input.fill('');

            // Type the message with controlled delay
            await input.type(message, { delay: 40 });

            // Verify message was entered correctly
            let enteredValue = await input.inputValue();
            if (enteredValue !== message) {
                console.log(`[DEBUG] Input mismatch. Expected: "${message}", Got: "${enteredValue}". Re-entering...`);
                await input.fill('');
                await this.page.waitForTimeout(100);
                await input.type(message, { delay: 40 });
                enteredValue = await input.inputValue();
            }

            // Add small delay to let the input register with the form
            await this.page.waitForTimeout(500);

            // Submit with Enter rather than clicking the send button - a
            // loosely-scoped button selector can match a different widget's
            // button when more than one chat is present on the page.
            await input.press('Enter');

            // Verify input was cleared (indicates successful submission)
            await this.page.waitForTimeout(400);
            const finalValue = await input.inputValue().catch(() => '?');
            if (finalValue.trim() !== '') {
                console.log(`[WARNING] Input not cleared after send. Contains: "${finalValue}"`);
            }

            console.log(`[SEND] "${message}" submitted successfully`);

        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.log(`[SEND ERROR] Failed to send "${message}": ${errorMsg}`);
            throw e;
        }
    }


    async getLatestResponse(timeout = 15000): Promise<string> {
        // Selector to find li.sent that comes after the last li.replies
        const responseLocator = this.frame.locator(`${chatbotLocators.botMessages.value}`).last();

        const start = Date.now();

        while (Date.now() - start < timeout) {
            try {
                await expect(responseLocator).toBeVisible({ timeout: 1000 });
                const text = (await responseLocator.innerText()).trim();
                if (text && text !== this.latestSeenBotText) {
                    this.latestSeenBotText = text;
                    return text;
                }
            } catch (e) {
                // ignore and retry until overall timeout
            }

            await this.page.waitForTimeout(200);
        }

        throw new Error(`Timed out waiting for new bot response (last seen: "${this.latestSeenBotText}")`);
    }

    async getCurrentLatestResponse(timeout = 10000): Promise<string> {
        const latest = this.botMessages.last();
        await expect(latest).toBeVisible({ timeout });

        const text = (await latest.innerText()).trim();

        if (!text) {
            throw new Error('Latest bot response is empty');
        }

        return text;
    }  

    async getAllResponses(): Promise<string[]> {
        const count = await this.botMessages.count();
        const responses: string[] = [];

        for (let i = 0; i < count; i++) {            
            responses.push(
                (await this.botMessages.nth(i).innerText()).trim()
            );
        }

        return responses;
    }

    async getAllLatestResponses(): Promise<string[]> {
        const count = await this.botMessages.count();
        const responses: string[] = [];

        for (let i = 1; i <= count; i++) {           
            responses.push(
                (await this.botMessages.nth(i).innerText()).trim()
            );
        }

        return responses;
    }

    // Waits until the bot has posted at least one bubble beyond `previousCount`,
    // then until it stops adding bubbles. waitForBotIdle() alone returns
    // immediately after sending, before the bot has started replying.
    async waitForNewBotReply(previousCount: number, stableMs = 2500, timeout = 90000): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (await this.botMessages.count() > previousCount) {
                await this.waitForBotIdle(stableMs, Math.max(timeout - (Date.now() - start), stableMs + 500));
                return;
            }
            await this.page.waitForTimeout(200);
        }
        console.log(`[DEBUG] No new bot reply within ${timeout}ms (count still ${previousCount})`);
    }

    async waitForBotIdle(stableMs = 500, timeout = 10000): Promise<void> {
        const start = Date.now();
        let lastCount = await this.botMessages.count();
        let stableSince = Date.now();

        while (Date.now() - start < timeout) {
            const current = await this.botMessages.count();
            if (current === lastCount) {
                if (Date.now() - stableSince >= stableMs) return;
            } else {
                lastCount = current;
                stableSince = Date.now();
            }
            await this.page.waitForTimeout(100);
        }

        // Don't throw - just return if timeout reached, bot may still be processing
        console.log(`[DEBUG] Bot idle timeout reached (${timeout}ms) at count ${lastCount}`);
    }

    async getAllUserMessages(): Promise<string[]> {
        try {
            // Count li.replies items - each represents one user message
            const count = await this.frame.locator('#message-module li.replies').count();
            const responses: string[] = [];
            const seenMessages = new Set<string>();

            for (let i = 0; i < count && i < 50; i++) {  // Limit to 50 max to prevent infinite loops
                try {
                    // Get text from the #repliesPara div specifically
                    const text = await this.frame.locator('#message-module li.replies').nth(i).locator('#repliesPara').first().innerText({ timeout: 2000 });
                    if (text && text.trim()) {
                        // Only add if not already seen (avoid duplicates)
                        if (!seenMessages.has(text.trim())) {
                            responses.push(text.trim());
                            seenMessages.add(text.trim());
                        }
                    }
                } catch (e) {
                    // Skip if timeout - element may not have text yet
                }
            }

            return responses;
        } catch (e) {
            console.log(`[DEBUG] Error in getAllUserMessages: ${e instanceof Error ? e.message : String(e)}`);
            return [];
        }
    }

    async getUserMessageCount(): Promise<number> {
        try {
            return await this.frame.locator('#message-module li.replies').count();
        } catch (e) {
            console.log(`[DEBUG] Error getting user message count: ${e instanceof Error ? e.message : String(e)}`);
            return 0;
        }
    }
}