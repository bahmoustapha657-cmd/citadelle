# Security Architecture

## Objective

The goal is not to promise a "perfect" system. The goal is to make `citadelle`
defensible:

- least privilege by default
- server-side control over sensitive operations
- no direct privilege escalation path
- secrets and payments protected against replay and misuse
- future changes guided by a stable security model

## Current High-Risk Findings

1. Role trust was too weak.
   The backend could copy a role from `ecoles/{schoolId}/comptes` into
   `users/{uid}` without enough validation.

2. Sensitive transfer actions were not consistently protected by session checks.

3. Firestore rules were too broad.
   Too many authenticated users could write to too many collections.

4. Payment webhook verification was too weak.
   A missing secret or a replayed transaction could lead to unintended behavior.

5. Bootstrap credentials were stored in `localStorage`.

## Target Model

### 1. Identity

- Firebase Auth identifies the user.
- `users/{uid}` is the authoritative application profile.
- `users/{uid}.role` must always be server-written.
- `users/{uid}.schoolId` binds the session to one school.
- `users/{uid}.compteDocId` links a user to the matching account document.

### 2. Account Directory

`ecoles/{schoolId}/comptes` is an account directory, not the final authority for
authorization.

- it may store login metadata and password hashes
- it may never create `superadmin`
- it may only store whitelisted school roles
- self-service changes must be limited to password rotation fields

### 3. Sensitive Operations

These operations must stay server-side:

- login and Auth user sync
- user provisioning
- inter-school transfers
- payment webhook processing
- plan activation

### 4. Firestore Rules

Rules must reflect real roles:

- `direction` and `admin` can manage school settings and accounts
- `enseignant` can write only to teaching collections that need it
- `parent` can write only to parent-facing messaging flows
- public reads are limited to explicitly public content

## Immediate Remediation Applied

- server-side login now validates the school role before syncing `users/{uid}`
- user provisioning now syncs only from an existing Firestore account record
- transfer API now requires a valid authenticated session
- transfer tokens are stronger for newly created transfers
- webhook signature verification is mandatory and replay-resistant
- Firestore rules now narrow writes on root school docs and sensitive collections
- signup no longer stores bootstrap secondary passwords in `localStorage`

## Next Steps

1. Move all `comptes` management behind server endpoints and remove client access
   to password hashes entirely.
2. Add rate limiting to login, signup, and transfer endpoints.
3. Add emulator-backed security tests for Firestore rules.
4. Split public school data from private school settings into separate documents.
5. Add incident logging, alerting, secret rotation, and backup validation.

## Operational Rule

Every future feature should answer two questions before shipping:

1. Can a lower-privilege user trigger this directly from the client?
2. If the client is hostile, what server or rule still prevents abuse?
