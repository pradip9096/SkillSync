import { request } from '@playwright/test';

async function globalSetup() {
  const requestContext = await request.newContext();
  
  // Wipe DB
  const response = await requestContext.delete('http://localhost:5001/api/test/teardown');
  if (!response.ok()) {
    console.warn('Failed to teardown DB in global setup');
  }

  await requestContext.dispose();
}

export default globalSetup;
