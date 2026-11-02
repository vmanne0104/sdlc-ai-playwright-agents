# Sample requirements (replace with your own or paste in chat)

## US-101 Manage todo items (UI)  - https://demo.playwright.dev/todomvc
As a user I want to add, complete and delete todo items so that I can track my work.
- AC-1: Typing text and pressing Enter adds the item to the list and updates the counter.
- AC-2: Ticking an item's checkbox marks it completed.
- AC-3: Deleting an item removes it from the list.
- AC-4: Submitting an empty input does not create an item.

## US-201 Posts API  - https://jsonplaceholder.typicode.com
As a client I want to read, create and delete posts via REST.
- AC-1: GET /posts/{id} returns 200 with id, userId, title, body.
- AC-2: POST /posts with valid JSON returns 201 and the created resource with an id.
- AC-3: GET for a non-existent post returns 404.
- AC-4: DELETE /posts/{id} returns a 2xx status.
