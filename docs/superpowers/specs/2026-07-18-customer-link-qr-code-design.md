# Customer Link QR Code Design

## Goal

Make a newly generated private customer link easy to hand off in person by displaying a scannable QR code in the employee console.

## Scope

- Display a QR code only after a claim is created, in the existing one-time sharing panel.
- Encode the exact private customer URL and never the PIN.
- Keep the PIN as a separately copied value and state that it must be shared separately.
- Add an enabled `Share link` button as a visual placeholder; it intentionally has no click behavior.

## Implementation

Use the `qrcode` package to render an SVG data URL on the client from `created.url`. The employee dashboard owns this transient state, so no API, database, or customer-page changes are needed. The QR image has explanatory alternative text and a fixed, compact display size.

## Constraints

- Do not add automated tests for this change, per the user’s direction.
- Do not send the private URL to a third-party QR service.
- Preserve the existing Copy controls and post-creation panel behavior.
