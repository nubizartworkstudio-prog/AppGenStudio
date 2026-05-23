# Security Specification: AppGen Studio Firebase Hardening

## 1. Data Invariants

1. **User Invariant**: A user record (`/users/{userId}`) can only be created, read, or modified by the user whose `uid` matches the `userId` document path parameter. No administrative or general users can read or write to user profile documents of other users.
2. **Project Invariant**: No project can be stored under a user's subcollection (`/users/{userId}/projects/{projectId}`) with a `userId` field that doesn't match the authenticating user's `uid`.
3. **Immutability of Ownership**: Once a project is created, its `userId` and `id` must be immutable. No update operation can change the owner or the original identifier.
4. **Time Invariant**: The `createdAt` field on users and projects must equal `request.time`. On updates, `updatedAt` (if present) must equal `request.time`.

---

## 2. The "Dirty Dozen" Payloads

Here are 12 malicious payloads that security rules must block:

1. **Identity Spoofing - Creating Profile with Spoofed UID**:
   - Path: `users/attacker_uid`
   - Payload: `{ "uid": "victim_uid", "email": "victim@example.com", "createdAt": "request.time" }`
   - Expected: `PERMISSION_DENIED`

2. **Cross-User Snooping - Reading Other Profile**:
   - Path: `users/victim_uid`
   - Action: `get` by attacker_uid
   - Expected: `PERMISSION_DENIED`

3. **Orphan project - Creating Project in other user's collection**:
   - Path: `users/victim_uid/projects/proj1`
   - Payload: `{ "id": "proj1", "userId": "victim_uid", "name": "Fake", "prompt": "X", "code": "Y", "timestamp": 123, "createdAt": "request.time" }`
   - Expected: `PERMISSION_DENIED`

4. **Spoofed User ID inside Owner Collection**:
   - Path: `users/attacker_uid/projects/proj1`
   - Payload: `{ "id": "proj1", "userId": "victim_uid", "name": "Fake", "prompt": "X", "code": "Y", "timestamp": 123, "createdAt": "request.time" }`
   - Expected: `PERMISSION_DENIED`

5. **Invalid ID Character Injections (Resource Poisoning)**:
   - Path: `users/attacker_uid/projects/malicious_proj$$%#`
   - Expected: `PERMISSION_DENIED`

6. **Overly Large ID String Injection (Resource Poisoning)**:
   - Path: `users/attacker_uid/projects/a_very_long_project_id_over_128_characters_long_1234567890123456789012345678901234567890123456789012345678901234567890_abc`
   - Expected: `PERMISSION_DENIED`

7. **Immutability Breach - Changing Project ID**:
   - Action: `update` project
   - Existing: `{ "id": "proj1", "userId": "attacker_uid", ... }`
   - Payload: `{ "id": "proj2", "userId": "attacker_uid", ... }`
   - Expected: `PERMISSION_DENIED`

8. **Privilege Escalation - Modifying user field during project update**:
   - Payload: `{ "id": "proj1", "userId": "victim_uid", ... }`
   - Expected: `PERMISSION_DENIED`

9. **Skipping Schema Fields on Create**:
   - Payload: `{ "id": "proj1", "userId": "attacker_uid" }` (Missing code, name, prompt, timestamp, createdAt)
   - Expected: `PERMISSION_DENIED`

10. **Malicious Client Timestamp Injection**:
    - Payload: `{ "id": "proj1", "userId": "attacker_uid", "createdAt": 123456789 }` (Not using server timestamp placeholder)
    - Expected: `PERMISSION_DENIED`

11. **Injecting Arbitrary Shadow Fields (The Ghost Field / Shadow Update)**:
    - Payload: `{ "id": "proj1", "userId": "attacker_uid", "isVerifiedAdmin": true }`
    - Expected: `PERMISSION_DENIED`

12. **Unauthenticated Read Attempt (Secure List Queries)**:
    - Action: `list` on `users/victim_uid/projects` without a logged-in session.
    - Expected: `PERMISSION_DENIED`

---

## 3. Test Runner Concept

A local suite running `@firebase/rules-unit-testing` would mimic:
```typescript
it('rejects cross-user profile reading', async () => {
  const db = getAttackerAuthedDb({ uid: 'attacker_uid' });
  await assertFails(getDoc(doc(db, 'users', 'victim_uid')));
});
```
All of these behaviors are validated during deployment by the compiled engine.
