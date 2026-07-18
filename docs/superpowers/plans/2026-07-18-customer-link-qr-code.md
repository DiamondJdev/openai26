# Customer Link QR Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private-link QR code and inert Share Link button to the employee claim-creation result.

**Architecture:** Generate an SVG data URL in the employee dashboard from the transient `created.url` value. The QR encodes only the existing private URL; the existing PIN remains displayed and copied separately.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, `qrcode`.

## Global Constraints

- The QR payload is exactly the private customer URL, never the PIN.
- `Share link` is enabled and intentionally has no click behavior.
- No automated tests are added, per the user’s direction.
- No private-link data is sent to a third-party QR service.

---

### Task 1: Add local QR generation and the sharing-panel controls

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app/employee/page.tsx`

**Interfaces:**
- Consumes: `CreatedClaim.url: string`
- Produces: an SVG QR image that encodes `CreatedClaim.url` and an inert enabled button.

- [ ] **Step 1: Install the QR package**

Run: `npm install qrcode@^1.5.4`

- [ ] **Step 2: Generate the QR data URL from the current private link**

Import `toDataURL` from `qrcode`, store its output in local component state, and refresh it when `created.url` changes. Use SVG output with a compact 160px width and error-correction level M.

- [ ] **Step 3: Render the QR and sharing guidance**

Within the existing created-result panel, display the QR image, explain that scanning opens the private link, and state that the PIN must be sent separately. Preserve both Copy controls.

- [ ] **Step 4: Add the visual Share Link placeholder**

Add an enabled `button` with the existing secondary button styling and no click handler.

- [ ] **Step 5: Verify the production build**

Run: `npm run build`

Expected: exit code 0.
