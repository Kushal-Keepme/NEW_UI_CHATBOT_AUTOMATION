import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import { loginLocators } from '../locators/dashboardLogin.locator';
import { resolveLocator } from '../utils/locator.resolver';
import { ENV } from '../../configs/env/env.helper';
import { logger } from '../utils/logger';

import { fixture } from '../utils/fixture.helper';

export class DashboardLoginPage extends BasePage {

    // Set during login(): true when the new sidebar client-switcher UI rendered
    private usesClientSwitcher = false;

    constructor(page: Page) {
        super(page);
    }

    async login(): Promise<void> {

        await resolveLocator(this.page, loginLocators.emailInput).fill(ENV.email);

        // The new dev UI's login form is progressive: entering the email
        // reveals a "Continue" button, and only after clicking it does the
        // password field render. Older environments show both fields at
        // once with no Continue step. Handle both without branching on
        // ENV, since the same page object is shared across environments.
        const continueButton = resolveLocator(this.page, loginLocators.continueButton);
        const continueVisible = await continueButton
            .waitFor({ state: 'visible', timeout: 3000 })
            .then(() => true)
            .catch(() => false);

        if (continueVisible) {
            logger.info('Continue button detected — clicking it to reveal the password field.');
            await continueButton.click();
        }

        const passwordInput = resolveLocator(this.page, loginLocators.passwordInput);
        await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
        await passwordInput.fill(ENV.password);
        await resolveLocator(this.page, loginLocators.loginButton).click();

        // In the new UI (dev, and now staging/prod) the client search field
        // lives inside the sidebar's client-switcher dropdown, which starts
        // collapsed — expand the sidebar, then open the switcher, before it
        // appears. The old UI shows the search field directly on the
        // dashboard. Detect which UI rendered instead of branching on ENV.
        const searchInput = resolveLocator(this.page, loginLocators.searchClientInput);
        const expandSidebarButton = resolveLocator(this.page, loginLocators.expandSidebarButton);
        try {
            await searchInput.or(expandSidebarButton).first().waitFor({ state: 'visible', timeout: 30000 });
        } catch (err) {
            // A rejected login just leaves the login form on screen with no
            // obvious error, so say so explicitly instead of a bare timeout.
            const stillOnLogin = await resolveLocator(this.page, loginLocators.passwordInput).isVisible().catch(() => false);
            if (stillOnLogin) {
                throw new Error(
                    `Login failed on ${ENV.env} (${ENV.baseUrl}) for ${ENV.email}: still on the login page 30s after Sign In. Check the credentials (CI: QA_EMAIL / QA_PASSWORD secrets on this GitHub Environment).`
                );
            }
            throw err;
        }

        this.usesClientSwitcher = !(await searchInput.isVisible());
        if (this.usesClientSwitcher) {
            logger.info('New UI detected — expanding sidebar and opening client switcher to reveal the search field.');
            await expandSidebarButton.click();
            await resolveLocator(this.page, loginLocators.clientSwitcherButton).first().click();
        }

        // Login can bounce through an intermediate /login redirect before the
        // dashboard settles, so wait for the dashboard itself to be ready
        // instead of racing straight into the client search.
        await resolveLocator(this.page, loginLocators.searchClientInput).waitFor({
            state: 'visible',
            timeout: 30000,
        });
    }

    async waitFor(seconds: number): Promise<void> {
        await this.page.waitForTimeout(seconds * 1000);
    }

    async searchClient(): Promise<void> {
        const clientName = ENV.clientName;
        logger.info(`Searching for client: ${clientName}`);
        await resolveLocator(this.page, loginLocators.searchClientInput).fill(clientName);
    }

    async selectClientFromTable(): Promise<void> {
        // The new UI's client switcher renders search results as dropdown
        // buttons rather than table rows.
        const locatorDef = this.usesClientSwitcher
            ? loginLocators.selectClientFromDropdown
            : loginLocators.selectClientFromTable;
        await resolveLocator(this.page, locatorDef).click();
    }

    async selectLocation(): Promise<void> {
        await this.selectLocationByName(ENV.crmConfig.location);
    }

    // Generalised version of selectLocation() that takes the venue name
    // directly instead of reading it from ENV.crmConfig.location, so a
    // single session can switch between several locations in turn (see
    // scripts/probe-horizon-locations.ts).
    async selectLocationByName(locationName: string): Promise<void> {
        logger.info(`Switching venue-bot location filter to: ${locationName}`);
        await resolveLocator(this.page, loginLocators.locationbox).click();
        await resolveLocator(this.page, loginLocators.locationInput).fill(locationName);
        await this.page.waitForTimeout(5000);

        const option = resolveLocator(this.page, loginLocators.selectlocation);
        try {
            await option.click({ timeout: 10000 });
        } catch (err) {
            // The dropdown doesn't re-render the currently-active location as a
            // visible, clickable list item — if that's why the click timed out,
            // there's nothing to select; just close the dropdown.
            const alreadySelected = await option.getAttribute('aria-selected').catch(() => null);
            if (alreadySelected !== 'true') throw err;
            logger.info(`${locationName} is already the active location — closing the dropdown instead of clicking.`);
            await this.page.keyboard.press('Escape');
        }
    }

    async selectAgentTranning(): Promise<void> {
        //await resolveLocator(this.page, loginLocators.selectAgentTranning).click();
        await resolveLocator(this.page, loginLocators.testAgent).click();
    }

    async navigateToAgentTraining(): Promise<void> {
        if (!ENV.agentTrainingUrl) {
            throw new Error('ENV.agentTrainingUrl is not defined');
        }
        logger.info(`Navigating to agent training page: ${ENV.agentTrainingUrl}`);
        await this.page.goto(ENV.agentTrainingUrl, {
            waitUntil: 'domcontentloaded'
        });
    }


}