jest.setTimeout(60000);

afterAll(async () => {
  // Graceful shutdown hook: slight delay to allow asynchronous operations and sockets to drain
  await new Promise(resolve => setTimeout(resolve, 500));
});
