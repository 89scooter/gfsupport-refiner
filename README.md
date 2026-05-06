# GoFreight Support Universal AI Refiner - Internal Web Version

## What this is
A Vercel-ready internal web tool. Users open the URL, enter the access code, upload a guideline and any document, then receive a refined HTML preview that can be copied into HubSpot.

## Required Vercel Environment Variables
Set these in Vercel > Project > Settings > Environment Variables:

- `OPENAI_API_KEY`: your OpenAI API key
- `ACCESS_CODE`: the access code users must enter, default proposal: `hardc0re@2026`

## How to change the access code later
1. Go to Vercel project settings
2. Open Environment Variables
3. Update `ACCESS_CODE`
4. Redeploy the project

No code change is required.

## Suggested project name / URL
Use Vercel project name:

`gfsupport-refiner`

Expected URL:

`https://gfsupport-refiner.vercel.app`

If the subdomain is already taken, Vercel will ask for another project name.

## Notes
- API key is only used server-side and is not exposed to users.
- This is protected by a simple access code. It is suitable for internal convenience, but not a full enterprise authentication system.
- Recommended: set a monthly OpenAI usage limit to control cost.
