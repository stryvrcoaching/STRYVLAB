# Client Access Email Flow Design

Date: 2026-06-14

## Goal

Fix the coach-side client access flow so STRYVR sends the correct email depending on the real account state:

- first access for truly new clients
- reconnection for existing active clients
- reactivation for suspended clients

Also improve the premium quality of the client-facing email wording, especially for the first message a client receives.

## Current Problem

The current `Renvoyer l'invitation` action hides multiple business cases behind one label.

Observed consequence:

- a client who already has an account can still receive the first-access email
- the email invites them to create a password again
- the CTA sends them to password onboarding even when the correct intent was simply to reconnect

This creates product confusion and weakens trust in the first STRYVR touchpoint.

## Scope

In scope:

- server-side decision logic for invite / reconnect / reactivate
- email templates and CTA structure
- coach UI labels for the access action
- response mode values returned by the invite endpoint

Out of scope:

- full redesign of all transactional emails
- auth architecture rewrite
- onboarding page redesign

## Entities

- `coach_clients`
  - `status`
  - `email`
  - `user_id`
  - `password_set`
- Supabase auth user
  - presence or absence of user
  - reliable signs that account was already activated or used

## Intended Business Rules

### 1. Suspended client

If `coach_clients.status === 'suspended'`:

- unban the auth user
- restore `coach_clients.status = 'active'`
- send a reactivation email

### 2. Existing active client

If the client already has a real usable account, send a reconnection email instead of a first-access email.

The recommended hybrid rule is:

- treat the client as existing if at least one strong activation signal is true
  - `password_set === true`, or
  - auth user exists and has already signed in, or
  - auth user exists and another reliable activation signal is available in metadata

Output behavior:

- keep account active
- generate a magic login link
- generate a password recovery/setup link
- send a reconnection email with:
  - primary CTA: `Se connecter`
  - secondary CTA: `Créer ou réinitialiser mon mot de passe`

### 3. Truly new client

Use first-access flow only if the account has never been activated.

Typical cases:

- no auth user exists yet
- auth user exists but there is still no reliable signal of activation

Output behavior:

- create user if needed
- generate onboarding password link
- send first-access email with onboarding CTA

## Decision Matrix

| Condition | Mode | Email type | Primary CTA |
|---|---|---|---|
| suspended | `reactivated` | reactivation | reconnect |
| active/inactive + activated account | `access_link` or new explicit reconnect mode | reconnection | one-click login |
| active/inactive + never activated | `invited` | first access | create access |

## Email Design

### First access email

Tone:

- premium
- concise
- clear

Message intent:

- STRYVR is the private client platform used by the coach
- it centralizes program, follow-up, check-ins, metrics, nutrition and progress visibility
- the email explains value without being long

Primary CTA:

- `Créer mon accès`

Suggested body direction:

- coach created your private STRYVR space
- this is where you will find your coaching follow-up, training structure, progress tracking and key interactions with your coach
- create your access to get started

### Reconnection email

Tone:

- premium
- reassuring
- minimal

Primary CTA:

- `Se connecter`

Secondary CTA:

- `Créer ou réinitialiser mon mot de passe`

Message intent:

- your STRYVR space is already active
- use the secure link to reconnect now
- if needed, recreate or reset your password

### Reactivation email

Keep existing behavior, but align copy style with the new premium tone.

## Coach UI Changes

Current wording is misleading because `Renvoyer l'invitation` suggests only one outcome.

Replace with status-aware labels:

- inactive client: `Envoyer l'invitation`
- active client: `Envoyer un lien de connexion`
- suspended client: `Restaurer l'accès`

Support text should match each case:

- inactive: client has not activated their STRYVR space yet
- active: client can connect with email and password; a new secure connection email can be sent
- suspended: access is suspended and can be restored

## API Contract

The invite endpoint should continue returning machine-readable modes and may add a clearer reconnect mode if useful.

Accepted return modes:

- `invited`
- `reactivated`
- `access_link`

Optional improvement:

- replace generic `access_link` with `reconnect`
- keep backward compatibility in UI if other callers already rely on `access_link`

## Error Handling

- if auth user creation fails, return a clear server error
- if magic link generation fails, do not silently fall back to first-access flow
- if email sending fails, return explicit error when the action is incomplete
- do not mark the operation as successful if the wrong email branch was taken

## Testing

Minimum validation cases:

1. Inactive client, no auth user:
   first-access email is sent

2. Active client, `password_set = true`:
   reconnection email is sent

3. Active client, auth user exists and already signed in:
   reconnection email is sent even if `password_set` is stale

4. Suspended client:
   account is reactivated and reactivation email is sent

5. Existing active client:
   never receives the first-access email

6. Coach UI labels:
   button and helper copy reflect the current branch

## Risks

- Supabase user signals may vary depending on how earlier accounts were created
- older rows may have stale `password_set` values
- some existing UI code may assume only `invited` versus `reactivated`

Mitigation:

- keep hybrid logic defensive
- prefer strong “already activated” signals over `password_set` alone
- avoid silent fallback to onboarding flow for existing users

## Recommended Implementation Order

1. Add a clear account-state resolver in the invite route
2. Add a dedicated reconnection email template
3. Improve first-access email wording
4. Update coach access UI labels and helper copy
5. Verify the three modes end-to-end
