import { test, expect } from '../../fixtures/api';

test.describe('US-201 Posts API', () => {
  test('US-201 AC-1: GET /posts/1 returns the post @smoke', async ({ api }) => {
    const res = await api.get('/posts/1');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    expect(body).toMatchObject({ id: 1, userId: expect.any(Number), title: expect.any(String), body: expect.any(String) });
  });

  test('US-201 AC-2: POST /posts creates a post @regression', async ({ api }) => {
    const payload = { title: 'hello', body: 'world', userId: 1 };
    const res = await api.post('/posts', { data: payload });
    expect(res.status()).toBe(201);
    expect(await res.json()).toMatchObject({ ...payload, id: expect.any(Number) });
  });

  test('US-201 AC-3: GET unknown post returns 404 @negative', async ({ api }) => {
    const res = await api.get('/posts/999999');
    expect(res.status()).toBe(404);
  });

  test('US-201 AC-4: DELETE /posts/1 succeeds @regression', async ({ api }) => {
    const res = await api.delete('/posts/1');
    expect(res.ok()).toBeTruthy();
  });
});
