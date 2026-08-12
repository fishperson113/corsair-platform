# Corsair Platform / Admin

This app is the control-plane/admin boundary for Corsair.

Owns:
- integration registry
- tenants, accounts, connections, encrypted credentials
- agent clients and permissions
- audit events
- Corsair runtime/API boundary

Must not contain job, candidate, CV, cover-letter, or application workflow logic.

Implementation status: scaffold only. Corsair primitives should be wrapped/composed rather than reimplemented.
