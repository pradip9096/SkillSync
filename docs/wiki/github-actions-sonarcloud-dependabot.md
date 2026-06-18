# GitHub Actions — SonarCloud and Dependabot Integration

Explains why SonarCloud is skipped on Dependabot pull requests, why this is correct long-term behaviour, and what the CI pipeline does on each type of trigger.

---

## The Problem

When Dependabot opens a pull request to bump a package version, GitHub Actions runs the CI workflow. But GitHub **blocks all repository secrets** from being available to Dependabot-triggered workflows. This is an intentional GitHub security policy, not a bug.

When SonarCloud runs on a Dependabot PR without the secret:
- `SONAR_TOKEN` arrives as an empty string
- SonarCloud rejects the request with "Not authorized"
- The SonarCloud job fails
- The entire CI run shows a failure even though all actual tests passed

---

## Why GitHub Blocks Secrets on Dependabot PRs

Dependabot runs code from external package maintainers. If secrets were passed to those workflows, a malicious package update could exfiltrate credentials such as `SONAR_TOKEN`, `AWS_SECRET`, or any other repository secret. GitHub enforces this boundary at the platform level — it cannot be disabled.

---

## The Fix

One condition added to the `sonarcloud` job in `.github/workflows/ci.yml`:

```yaml
if: github.actor != 'dependabot[bot]'
```

This tells GitHub Actions to skip the SonarCloud job entirely when Dependabot triggers the workflow. The job is not failed — it is skipped. All other jobs (`test-and-lint`, `secret-scan`, `k6`) still run normally on Dependabot PRs.

---

## Why Skipping is the Correct Long-Term Solution

Skipping SonarCloud on Dependabot PRs provides no loss of quality coverage because:

- Dependabot only modifies a version number in `package.json` or `package-lock.json`
- It does not touch source code in `backend/src/` or `frontend/src/`
- SonarCloud analyses source code — not dependency version numbers
- The SonarCloud result on a Dependabot PR would be identical to the result on the last human-authored commit

This is also the pattern explicitly recommended in SonarCloud's official documentation for GitHub Actions integration.

---

## CI Behaviour by Trigger Type

| Trigger | test-and-lint | SonarCloud | secret-scan | k6 Load Test |
|---|---|---|---|---|
| Push to `main` (your code) | ✅ Runs | ✅ Runs | — Skipped (push only) | ✅ Runs |
| Pull request (your code) | ✅ Runs | ✅ Runs | ✅ Runs | ✅ Runs |
| Dependabot PR | ✅ Runs | — Skipped | ✅ Runs | ✅ Runs |

`secret-scan` only runs on pull requests by design — scanning for secrets in a push after the code is already merged is too late.

---

## Is This a Workaround or Long-Term Solution?

It is a **long-term solution**.

| Question | Answer |
|---|---|
| Is the root cause fixed? | Yes — the cause is a GitHub platform security policy, not a code defect |
| Is anything hidden or deferred? | No — SonarCloud runs on every human-authored commit and PR |
| Will this break in the future? | No — the GitHub policy is stable and the pattern is officially documented |
| Is source code quality still checked? | Yes — every push and PR you author goes through full SonarCloud analysis |

---

## Related Files

- `.github/workflows/ci.yml` — CI pipeline definition
- `docs/wiki/github-actions-sonarcloud-dependabot.md` — this document
