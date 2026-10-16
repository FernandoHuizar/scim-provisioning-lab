# SCIM Provisioning Lab

**The problem:** when someone joins or leaves, their accounts in every app need to be created or turned off. Doing that by hand is slow, and leavers get missed.

**What I did:** SCIM is the standard way an identity system like Okta tells an app "create this person" or "turn this person off." I wrote a small server that plays the part of the app, connected it to a real Okta tenant, and tested that assigning a user creates their account and unassigning turns it off.

*Lab from earlier in my learning, with code. My main project is [Havlund Pharma](https://github.com/FernandoHuizar/havlund-identity-lifecycle).*

## IAM ideas this lab shows

| Idea | What it means | Where it shows up here |
|---|---|---|
| Provisioning | Creating a person's account in an app automatically | Assigning a user to the app in Okta created their account on my server |
| Deprovisioning | Turning off access when someone leaves | Unassigning the user turned the account off. It wasn't deleted, so the history stays |
| Source of truth | One system decides who should have an account | Okta decides, the app follows |
| Joiner and leaver | The moments access has to change | Both were tested end to end |
| Troubleshooting with logs | Looking at what actually happened before changing settings | I logged every request Okta sent, which is how I found each problem |

## What I did

**1. Built the server.** A small Node.js app with the few addresses Okta needs: look up a user, create a user, update a user, and an empty group list.

<img width="448" height="154" alt="SCIM server routes" src="https://github.com/user-attachments/assets/82327593-f65f-44ec-97d2-c09cee8e6005" />

**2. Made it reachable.** Okta is in the cloud and my server was on my PC, so I used Cloudflare Tunnel to give it a public HTTPS address without opening any ports.

<img width="1050" height="150" alt="Cloudflare Tunnel running" src="https://github.com/user-attachments/assets/50e88668-95ea-4937-bf8c-698640a0a7fc" />

**3. Connected it to Okta.** Used Okta's SCIM test app, pointed it at my server, and turned on Create Users, Update User Attributes and Deactivate Users.

<img width="1045" height="682" alt="Okta provisioning settings" src="https://github.com/user-attachments/assets/91bd0185-ffcb-4676-89be-e1cf815a437a" />

**4. Tested the joiner and leaver.**
- Assigned a test user in Okta. Okta checked if they existed, saw they didn't, and created them.
- Unassigned the user. Okta told the server to turn the account off, and it did.
- Checked both results directly on the server with PowerShell.

<img width="850" height="217" alt="User created and turned off" src="https://github.com/user-attachments/assets/1b962dac-deda-4ae1-8ea4-14ec9fe15a0c" />

## What broke and how I fixed it

I added logging so I could see exactly what Okta sent instead of guessing. That found 7 problems:

1. **The real blocker was a setting.** Create Users and Deactivate Users were never turned on in Okta. Okta was checking for users but wasn't allowed to create them.
2. **Two copies of the same route.** Only the first one ran, so my fix in the second one never took effect.
3. **Wrong response type.** Okta expects `application/scim+json`, not plain JSON.
4. **Missing fields in the user list.** Okta also expects `startIndex` and `itemsPerPage`.
5. **Missing group address.** Okta checks groups even when you don't use them, so it needed an empty answer instead of an error.
6. **Request body came through empty.** The server didn't recognize Okta's content type until I told it to.
7. **Leaver request in a different shape.** Okta sent "turn off" in a format I hadn't planned for, so I made the server accept both.

<img width="1048" height="526" alt="Request logging" src="https://github.com/user-attachments/assets/592b63d6-bdfa-447b-ae01-a9a72b686596" />

## What I learned

- Most provisioning problems are settings or mismatched expectations, not broken code. Check the logs first.
- Turning an account off is safer than deleting it, because you keep the record of who had access.
- Apps like Salesforce and Zendesk do this same job when Okta provisions to them.

## Built with

Node.js, Express, SCIM 2.0, Okta (Integrator Free Plan), Cloudflare Tunnel.
