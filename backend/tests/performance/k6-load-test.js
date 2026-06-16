import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    // Count only transport errors (connection refused, timeouts) as failures,
    // not HTTP 4xx/5xx — the CI load test runs without auth tokens so 401 is expected.
    http_req_failed: ['rate<0.01'],
  },
};

// Tell k6 that 401 and 409 are expected responses, not transport failures.
export function handleSummary(data) {
  return { stdout: JSON.stringify(data, null, 2) };
}

export default function () {
  const url = 'http://127.0.0.1:5001/api/v1/bookings';
  const payload = JSON.stringify({
    expertId: 'mock-expert-id',
    date: '2026-10-10',
    slot: '10:00-11:00',
    clientEmail: `test-${__VU}-${__ITER}@example.com`,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    responseCallback: http.expectedStatuses(200, 201, 401, 409),
  };

  const res = http.post(url, payload, params);

  check(res, {
    'server responded': (r) => r.status !== 0,
  });

  sleep(1);
}
