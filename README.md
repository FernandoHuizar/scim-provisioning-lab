# SCIM Provisioning Server Lab

## Overview

This lab is a SCIM 2.0 provisioning server built from scratch in Node.js and connected to a live Okta tenant. Instead of configuring an existing pre-built app to receive provisioning events, this lab builds the receiving side of the integration itself, the actual API endpoints an application needs to support automated user creation and deactivation from an Identity Provider.

The server handles the full Joiner and Leaver flow. Okta checks whether a user exists, creates the user if not, and deactivates them on offboarding, matching the real SCIM 2.0 spec that products like Salesforce and Zendesk implement to support provisioning from an IdP.

## Environment

- Runtime: Node.js v24.20.0, Express.js
- Identity Provider: Okta (Integrator Free Plan)
- Public tunnel: Cloudflare Tunnel
- Protocol: SCIM 2.0

## What I Built

### SCIM Server

Built a SCIM 2.0 server in Express with the core endpoints Okta's SCIM client requires.

<img width="448" height="154" alt="image" src="https://github.com/user-attachments/assets/82327593-f65f-44ec-97d2-c09cee8e6005" />

- GET /scim/v2/ServiceProviderConfig, describes what the server supports
- GET /scim/v2/Users, lists users and supports Okta's filter query (userName eq "user@example.com") used to check if a user already exists
- POST /scim/v2/Users, creates a new user from the data Okta sends
- GET /scim/v2/Users/:id, retrieves one user by ID
- PATCH /scim/v2/Users/:id, updates a user, mainly used for deactivation on offboarding
- GET /scim/v2/Groups, returns an empty group list so Okta's sync cycle completes even without group provisioning in use

### Exposing the Server with Cloudflare Tunnel

Okta's cloud service needs a public URL to reach the server, so cloudflared was used to expose the local Node server on localhost:3000 through a public HTTPS endpoint without opening any inbound ports.

<img width="1050" height="150" alt="image" src="https://github.com/user-attachments/assets/50e88668-95ea-4937-bf8c-698640a0a7fc" />

### Connecting to Okta

Configured Okta's SCIM 2.0 Test App (Header Auth), pointed the Base URL at the live Cloudflare tunnel address, and enabled Create Users, Update User Attributes, and Deactivate Users under Provisioning to App.

<img width="1045" height="682" alt="image" src="https://github.com/user-attachments/assets/91bd0185-ffcb-4676-89be-e1cf815a437a" />

### Debugging the Integration

Getting real provisioning working end to end took several rounds of debugging. Added request and response logging directly into the server so I could see exactly what Okta was sending instead of guessing.

Issues found and fixed, in order:

1. Had two GET /scim/v2/Users routes by accident. Express only runs the first match, so a later fix to the response format was silently never taking effect.
2. Responses needed the Content-Type header set to application/scim+json, not just application/json, to match what Okta's SCIM client expects.
3. Okta's ListResponse expects startIndex and itemsPerPage alongside totalResults, the response was missing those.
4. Okta checks a /scim/v2/Groups endpoint as part of its sync even when groups aren't used. A missing route meant a 404 there, which needed a valid empty response instead.
5. The actual root cause blocking user creation the whole time. The Create Users, Update User Attributes, and Deactivate Users toggles in Okta's Provisioning to App settings were never enabled. Okta was correctly checking if the user existed but was never authorized to create one.
6. Okta sends POST and PATCH bodies with Content-Type application/scim+json, which Express's default JSON parser doesn't recognize by default, so the body came through as undefined. Had to explicitly tell express.json() to accept that content type.
7. Okta's deactivation PATCH request nested the active field inside the operation's value object instead of using a path field like I originally coded for. Had the PATCH handler support both formats.

<img width="1048" height="526" alt="image" src="https://github.com/user-attachments/assets/592b63d6-bdfa-447b-ae01-a9a72b686596" />

### Verifying the Full Flow

Confirmed the full lifecycle worked using a real Okta assignment:

- Assigned a test user to the app in Okta. Okta checked for an existing user with a filtered GET, got an empty result back, then sent a POST that created the user on the server (201 response).
- Unassigned the user in Okta, which triggered a PATCH request, and the server correctly set the user's active status to false.
- Verified both directly by hitting the live public endpoint with PowerShell and confirming the user data and active status matched.

<img width="850" height="217" alt="image" src="https://github.com/user-attachments/assets/1b962dac-deda-4ae1-8ea4-14ec9fe15a0c" />

## Key Concepts Demonstrated

- SCIM 2.0 protocol implementation, building the provisioning target side of an integration instead of just configuring one
- Full Joiner and Leaver lifecycle automation, driven entirely by Okta as the source of truth
- Debugging an API integration using real request and response logging instead of assumptions
- Exposing a local server to the internet for testing IdP integrations without needing permanent hosting infrastructure

## Technologies Used

Node.js, Express.js, SCIM 2.0, Okta, Cloudflare Tunnel, REST API
