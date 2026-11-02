import { test, expect } from '../../fixtures/ui';
import { TodoPage } from '../../pages/TodoPage';

// Traceability: every title starts with the user-story / AC id: "US-101 AC-1: ..."
test.describe('US-101 Manage todo items', () => {
  let todo: TodoPage;
  test.beforeEach(async ({ page }) => { todo = new TodoPage(page); await todo.goto(); });

  test('US-101 AC-1: user can add a todo item @smoke', async () => {
    await todo.add('Buy milk');
    await todo.expectCount(1);
    await expect(todo.items().first()).toContainText('Buy milk');
    await expect(todo.count()).toContainText('1');
  });

  test('US-101 AC-2: user can complete a todo item @regression', async () => {
    await todo.add('Write report');
    await todo.complete('Write report');
    await expect(todo.items().first()).toHaveClass(/completed/);
  });

  test('US-101 AC-3: user can delete a todo item @regression', async () => {
    await todo.add('Temp task');
    await todo.remove('Temp task');
    await todo.expectCount(0);
  });

  test('US-101 AC-4: empty input does not create an item @negative', async () => {
    await todo.input().press('Enter');
    await todo.expectCount(0);
  });
});
