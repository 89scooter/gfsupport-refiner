## Latest Release

Version: v1.1-beta
Release Date: 2026-06-01

Highlights:

* Added built-in guideline selector
* Added Short Answer generation
* Removed manual guideline upload
* Improved KB refinement guardrails
* Improved article structure preservation

Guideline Source:

* `public/guidelines/article.md`
* `public/guidelines/short-answer.md`

---

# GoFreight Support Universal AI Refiner - Internal Web Version

## What this is

A Vercel-ready internal web tool.

Users open the URL, enter the access code, select the refinement scenario, upload a document, and receive refined HTML output based on the latest approved guideline managed in GitHub.

Supported refinement scenarios:

* Knowledge Base Article
* Short Answer Generation

---

## Required Vercel Environment Variables

Set these in:

Vercel → Project → Settings → Environment Variables

* `OPENAI_API_KEY`
  OpenAI API key used for document refinement.

* `ACCESS_CODE`
  Access code configured in Vercel Environment Variables.

---

## How to change the access code later

1. Go to Vercel Project Settings
2. Open Environment Variables
3. Update `ACCESS_CODE`
4. Redeploy the project

No code change is required.

---

## Suggested Project Name / URL

Recommended Vercel project name:

`gfsupport-refiner`

Expected URL:

`https://gfsupport-refiner.vercel.app`

If unavailable, choose another project name during deployment.

---

## Notes

* API requests are executed server-side.
* API keys are not exposed to users.
* Guidelines are centrally managed in GitHub and loaded automatically.
* This tool uses lightweight access protection and is intended for internal usage.
* Recommended: configure OpenAI usage monitoring and monthly budget controls.

---

## Current Architecture

Document
↓
Refinement Scenario Selection
↓
Guideline (GitHub Managed)
↓
AI Refinement
↓
HTML Preview
↓
Copy to HubSpot / Export

---

Maintainer:
GoFreight Support Team
