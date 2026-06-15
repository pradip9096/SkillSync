import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 VUs
    { duration: '1m', target: 100 },   // Ramp up to 100 VUs
    { duration: '2m', target: 500 },   // Ramp up to 500 VUs (stress phase)
    { duration: '30s', target: 0 },    // Ramp down to 0 VUs
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be < 1%
  },
};

export default function () {
  const url = 'http://127.0.0.1:5001/api/v1/bookings';
  const payload = JSON.stringify({
    expertId: 'mock-expert-id',
    date: '2026-10-10',
    slot: '10:00-11:00',
    clientEmail: `test-${__VU}-${__ITER}@example.com`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200 or 409': (r) => r.status === 200 || r.status === 409, // 409 is acceptable if lock is claimed
  });

  sleep(1);
}
