import { test, expect } from '@playwright/test';

test.describe('WebRTC P2P Connectivity', () => {
  test('Both users can connect and see fake media streams', async ({ browser }) => {
    // 1. Create two distinct browser contexts for dual-party simulation
    const clientContext = await browser.newContext();
    const expertContext = await browser.newContext();

    const clientPage = await clientContext.newPage();
    const expertPage = await expertContext.newPage();

    // 2. Setup Client Intercepts
    await clientPage.route('**/api/v1/auth/me', route => route.fulfill({ status: 200, json: { success: true, data: { _id: 'client1', role: 'Client' } } }));
    await clientPage.route('**/api/v1/bookings/999', route => route.fulfill({ status: 200, json: { success: true, data: { _id: '999', client: 'client1', expert: 'expert1' } } }));
    await clientPage.route('**/api/v1/bookings/999/video-token', route => route.fulfill({ status: 200, json: { success: true, data: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } } }));
    
    // Setup Socket.io test token and ID
    await clientPage.addInitScript(() => {
      localStorage.setItem('token', 'mock_token');
      // Pass the userId into socket query or auth manually if needed, but our app.js uses 'test_user' or reads from somewhere.
      // We will let the app naturally inject the mock token into the socket handshake.
    });

    // 3. Setup Expert Intercepts
    await expertPage.route('**/api/v1/auth/me', route => route.fulfill({ status: 200, json: { success: true, data: { _id: 'expert1', role: 'Expert' } } }));
    await expertPage.route('**/api/v1/bookings/999', route => route.fulfill({ status: 200, json: { success: true, data: { _id: '999', client: 'client1', expert: 'expert1' } } }));
    await expertPage.route('**/api/v1/bookings/999/video-token', route => route.fulfill({ status: 200, json: { success: true, data: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } } }));
    
    await expertPage.addInitScript(() => {
      localStorage.setItem('token', 'mock_token');
    });

    // 4. Navigate both browsers to the video session
    await clientPage.goto('/video-session/999');
    await expertPage.goto('/video-session/999');

    // 5. Assert P2P Connection
    // If simple-peer successfully connects over Socket.io, the 'remoteStream' state will be populated
    // and the UI will render the main <video> element. 
    // The Chromium flag '--use-fake-ui-for-media-stream' will automatically provide a spinning radar stream.
    
    await expect(clientPage.locator('video.object-cover').first()).toBeVisible({ timeout: 15000 });
    await expect(expertPage.locator('video.object-cover').first()).toBeVisible({ timeout: 15000 });

    await clientContext.close();
    await expertContext.close();
  });
});
