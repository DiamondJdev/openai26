# Customer photo compression

## Goal

Keep customer claim-intake uploads reliably below Vercel's server-upload limit
without changing the existing capture and preview experience.

## Chosen approach

Compress each selected browser image immediately, before it is attached to the
form. The compressed JPEG replaces the original file in the file input, so
`FormData` and the intake API receive only the small file.

Each output targets these bounds:

- JPEG format, regardless of the original supported browser image format.
- Longest edge at most 1024 pixels.
- At most 350 KiB per image.
- Start at JPEG quality 0.45; lower quality and then dimensions progressively
  until the byte budget is met.

The existing preview and captured-state indicator use the compressed JPEG. A
photo remains legible for the plate, odometer, and insurance-card capture
purposes while the three-photo multipart request stays around 1--1.5 MiB.

## Failure behavior

If a browser cannot decode or encode a selected image, the app rejects that
selection, clears its captured state, and shows a clear field-level error. It
must never fall back to posting the large original image.

## Boundaries and tests

The compression algorithm lives in a small client-only utility with browser
canvas dependencies injected at its boundary. Unit tests cover output sizing,
JPEG conversion, progressive retries, and failure without an original-file
fallback. The customer page owns applying a successful compressed file to the
input and preserving its current preview/retake controls.
