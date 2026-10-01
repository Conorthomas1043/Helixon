# Helixon LinkedIn extension

A Chrome / Edge (Manifest V3) extension that saves the LinkedIn profile
you're viewing to Helixon, through the agency REST API (`/api/v1`).

## Install (unpacked)

1. In Helixon: Settings → Integrations → create an API key called
   "LinkedIn extension".
2. Open `chrome://extensions`, turn on Developer mode, click **Load
   unpacked** and choose this folder.
3. Open the extension's options, paste the key, and check the Helixon
   address (default `https://www.helixon.co.uk`).

## What it does

- Only reads the page when you open its popup on a `linkedin.com/in/...`
  profile (`activeTab` + `scripting` - no background access to LinkedIn).
- Shows the name, headline (split into title and company) and location it
  found, for you to check, plus an optional email, job and note.
- Sends them to `POST /api/v1/candidates` with the profile URL and
  `source: "linkedin"`. Someone already in Helixon with the same LinkedIn
  URL or email isn't duplicated - the popup links to their existing record.

## Publishing

To give it to a team without Developer mode, zip this folder and publish
it (unlisted is fine) on the Chrome Web Store, or deploy it via Google
Workspace / Microsoft Edge policies. Check LinkedIn's terms for your use:
the extension saves only what a recruiter is looking at, one profile at a
time, on their click.
