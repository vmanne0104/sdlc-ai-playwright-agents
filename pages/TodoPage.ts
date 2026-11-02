import { Page, expect } from '@playwright/test';

/** Example Page Object. Agents create one per page/feature in /pages. Locators must be verified via Playwright MCP. */
export class TodoPage {
  constructor(private readonly page: Page) {}

  input = () => this.page.getByPlaceholder('What needs to be done?');
  items = () => this.page.getByTestId('todo-item');
  count = () => this.page.getByTestId('todo-count');

  async goto() { await this.page.goto('/'); }

  async add(text: string) {
    await this.input().fill(text);
    await this.input().press('Enter');
  }
  async complete(text: string) {
    await this.items().filter({ hasText: text }).getByRole('checkbox', { name: 'Toggle Todo' }).check();
  }
  async remove(text: string) {
    const item = this.items().filter({ hasText: text });
    await item.hover();
    await item.getByRole('button', { name: 'Delete' }).click();
  }
  async expectCount(n: number) { await expect(this.items()).toHaveCount(n); }
}
