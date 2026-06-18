import { test, expect } from '@playwright/test';
import { ExpertDirectoryPage } from './pages/ExpertDirectoryPage';
import { ExpertProfilePage } from './pages/ExpertProfilePage';
import { LoginPage } from './pages/LoginPage';
import crypto from 'crypto';

test('debug ts-01 api flow', async ({ page, request }) => {
  test.setTimeout(60000);
  const seed = await (await request.post('http://localhost:5001/api/test/seed-payment-e2e')).json();
  await (new LoginPage(page)).navigate();
  await (new LoginPage(page)).login(seed.clientEmail, 'TestPassword123!');
  const jwt = await page.evaluate(() => localStorage.getItem('token'));

  await page.goto('/experts');
  await (new ExpertDirectoryPage(page)).searchForExpert('Payment Test Expert');
  await (new ExpertDirectoryPage(page)).clickExpertCard('Payment Test Expert');
  const profile = new ExpertProfilePage(page);
  await profile.selectFirstAvailableDate();
  await page.waitForTimeout(1500);
  await profile.selectFirstTimeSlot();

  const createPromise = page.waitForResponse(
    r => r.url().includes('/api/v1/bookings') && !r.url().includes('verify') && r.request().method() === 'POST',
    { timeout: 20000 }
  );
  await profile.clickBookSession();
  const createRes = await createPromise;
  const createBody = await createRes.json();
  console.log('CREATE BOOKING STATUS:', createRes.status());
  console.log('CREATE BOOKING BODY:', JSON.stringify(createBody, null, 2).substring(0, 500));

  const bookingDoc = createBody.data?.booking ?? createBody.data ?? createBody.booking ?? createBody;
  const bookingId = bookingDoc._id ?? bookingDoc.id ?? '';
  const razorpayOrderId = bookingDoc.razorpayOrderId ?? '';
  console.log('bookingId:', bookingId, 'razorpayOrderId:', razorpayOrderId);

  // Close Razorpay
  const rzpFrame = page.frameLocator('iframe[src*="razorpay"]').nth(1);
  if (await rzpFrame.locator('[data-testid="checkout-close"]').isVisible({ timeout: 5000 }).catch(() => false)) {
    await rzpFrame.locator('[data-testid="checkout-close"]').click();
  }
  await page.waitForTimeout(1000);

  // Try verify-payment
  const paymentId = `pay_test_${Date.now()}`;
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${paymentId}`).digest('hex');
  const verifyRes = await request.post('http://localhost:5001/api/v1/bookings/verify-payment', {
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    data: { razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: sig },
  });
  console.log('VERIFY STATUS:', verifyRes.status());
  console.log('VERIFY BODY:', JSON.stringify(await verifyRes.json(), null, 2).substring(0, 400));
});
