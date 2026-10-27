# Security Policy

Loopy handles contact details for pet owners and records for community clinics, so we take security reports seriously.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting instead: open the **Security** tab of this repository and choose **Report a vulnerability**. Include what you found, how to reproduce it, and what you think the impact is.

This is a small, volunteer-run project, so please allow some time for a reply.

## Please don't include real data

Do not paste real client, pet, or email data into a report. If you reached real records while testing, say so and stop; don't copy or share them.

## Scope

In scope: the code in this repository, including the serverless functions in `api/`, the React app in `clinic-web/`, and the database migrations in `supabase/`.

Out of scope: third-party services we depend on (Supabase, Vercel, Resend, DeepL) and social engineering of volunteers or staff.

## Supported versions

Only the latest commit on `main` is supported.
