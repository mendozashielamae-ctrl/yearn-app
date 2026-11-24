# Project documentation

Use this page to find setup steps and technical references for Yearn.

## Start here

- [Student guide](GUIDE.md): requirements, computer setup, Android builds,
  first launch, renaming, extension checklist, useful commands and
  troubleshooting.
- [Full project overview](PROJECT-OVERVIEW.md): features, navigation,
  onboarding, settings, offline flow and extension examples.

## Technical references

- [Architecture and data flow](ARCHITECTURE.md): screen routing, providers,
  persistence, backup, chat streaming and context handling.
- [Local AI](LOCAL-AI.md): Gemma 4 E2B setup, model lifecycle, hardware choices,
  local image and voice input, RAM and troubleshooting.
- [Cloud AI](CLOUD-AI.md): Gemini REST/SSE integration, model selection,
  attachment routing, adaptive quota fallback and API-key storage.
- [Android local-device module](LOCAL-DEVICE.md): RAM/storage probes, NNAPI and
  OpenCL detection, native audio conversion and module build notes.


# Project documentation — YEARN APP

**A Private Place to Remember, Feel, and Heal**  
**Program:** Bachelor of Science in Information Systems (BSIS) 3B — Group Number 3  
**Group Members:** Fidelino, Alfred; Ricafranca, Rex Mark; Mendoza, Shiela Mae  
**Instructor:** Raphael Dale Ogbac  
**Date of Submission:** November 25, 2026  
**Repository:** https://github.com/mendozashielamae-ctrl/yearn-app  
**Installable Release:** [Yearn Hub v1.0.0 (debug APK)](https://github.com/mendozashielamae-ctrl/yearn-app/releases/tag/v1.0.0) (`sha256:6acc79892c1bf08874c53d1c66cf77c80a4ce2da1b88f4b9105ec61d05483c8b`)

Use this page to find setup steps, submission details, and technical references for Yearn.

## Start here

- [Student guide](GUIDE.md): requirements, computer setup, Android builds, first launch, renaming, extension checklist, useful commands and troubleshooting.
- [Full project overview](PROJECT-OVERVIEW.md): features, navigation, onboarding, settings, offline flow and extension examples.

## Technical references

- [Architecture and data flow](ARCHITECTURE.md): screen routing, providers, persistence, backup, chat streaming and context handling.
- [Local AI](LOCAL-AI.md): Gemma 4 E2B setup, model lifecycle, hardware choices, local image and voice input, RAM and troubleshooting.
- [Cloud AI](CLOUD-AI.md): Gemini REST/SSE integration, model selection, attachment routing, adaptive quota fallback and API-key storage.
- [Android local-device module](LOCAL-DEVICE.md): RAM/storage probes, NNAPI and OpenCL detection, native audio conversion and module build notes.

## Project conventions

- App routes are in `src/app/` and use Expo Router.
- Android native configuration comes from `app.json` and the local Expo module; the generated `android/` folder is ignored.

## Device Specifications & Installation Summary

- **OS & Hardware:** Android 8.0 (Oreo / API Level 26) or higher (tested on Android 12–15), quad-core 1.8 GHz CPU or higher, minimum 3 GB RAM (4 GB recommended), and at least 100 MB free storage.
- **Installation & Usage:** Download **Yearn Hub v1.0.0 (debug APK)** from Releases, allow installation from unknown apps if prompted, launch **YEARN**, and use **Un-Sent Letters**, **Final Playlist** (with locally downloaded audio files), **Memory Archive**, **My Healing Journey**, and **Profile & Appearance**.
- **Security Note:** No passwords, API keys, or confidential credentials are included in this repository or APK build.

## CICS Generative AI Use Disclosure

Generative AI tools (such as Google Gemini / ChatGPT) were used only to assist with documentation structuring, language refinement, phrasing technical descriptions, and debugging support. Core concept design, Figma prototyping, application implementation, local audio integration, and repository setup were executed and verified by Group 3 members (Fidelino, Ricafranca, and Mendoza).
