import { LocatorDefinition } from '../types/locator.types';
import { ENV } from '../../configs/env/env.helper';

export type LocatorMap = Record<string, LocatorDefinition>;

export const loginLocators = {
    emailInput: {
        strategy: 'name',
        value: 'email',
    },

    passwordInput: {
        strategy: 'name',
        value: 'password',
    },

    // Some environments (e.g. the new dev UI) use a progressive login form:
    // the password field is hidden until "Continue" is clicked after the
    // email is entered.
    continueButton: {
        strategy: 'xpath',
        value: '//*[@id="root"]/div[1]/div/div/div/form/div[2]/button',
    },

    loginButton: {
        strategy: 'text',
        value: 'Sign In',
    },

    searchClientInput: {
        strategy: 'placeholder',
        value: 'Search clients...',
    },

    // Dev env only: the client search field lives inside the sidebar's
    // client-switcher dropdown, which is hidden until the collapsed sidebar
    // is expanded — expand it, then open the switcher, and the search input
    // renders.
    expandSidebarButton: {
        strategy: 'css',
        value: 'a[aria-label="Expand sidebar"]',
    },

    clientSwitcherButton: {
        strategy: 'css',
        value: 'button:visible:has(svg.lucide-chevron-down)',
    },

    selectClientFromTable: {
        strategy: 'htmlElement',
        value: `tr:has-text("${ENV.clientName}")`,
    },

    // Dev env only: the client switcher's search results render as buttons
    // in a dropdown list, not table rows. Match the name exactly so e.g.
    // "Test Demo Client" doesn't also match "Test Demo Client 2".
    selectClientFromDropdown: {
        strategy: 'css',
        value: `button:has(:text-is("${ENV.clientName}"))`,
    },

    // The agent training page renders two buttons sharing id="iframe-button"
    // ("Test Call" and "Test Agent"), so an id-based selector is ambiguous
    // under Playwright's strict mode. The dev UI additionally renders an
    // unrelated tabs-list button also named "Test Agent" (switches config
    // tabs, not the iframe trigger), so accessible role/name alone is
    // ambiguous there too — scope to #iframe-button specifically.
    testAgent: {
        strategy: 'css',
        value: 'button#iframe-button:has-text("Test Agent")',
    },

    locationbox: {
        strategy: 'xpath',
        value: '//div[@id="venue-bot-location-filter-ts-control"]',
    },
    
    locationInput: {
        strategy: 'xpath',
        value: '//input[@class="dropdown-input"]',
    },

    selectlocation: {
        strategy: 'xpath',
        value: '//div[@role="option"]',
    }

} as const satisfies LocatorMap;
