import { Browser, BrowserContext, Page } from '@playwright/test';
import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';

// Extends Cucumber's World so hooks/steps get this.attach() (used to embed
// failure screenshots in the HTML report) and this.log().
export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(CustomWorld);
