# Customer Photo Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress every customer-selected intake photo in the browser before it is sent to the intake API.

**Architecture:** A client-only compression utility decodes an image once, draws bounded JPEG candidates to a canvas, and returns the first output at or below 350 KiB. The customer capture field holds the resulting `File`; intake submission replaces the original `FormData` entries with those compressed files.

**Tech Stack:** Next.js App Router, React 19, TypeScript, browser Canvas API, Vitest/jsdom.

## Global Constraints

- Encode only JPEG outputs.
- Cap the longest edge at 1024 pixels and each file at 350 KiB.
- Never submit the original image when compression fails.
- Preserve the existing captured-photo preview and retake flow.

---

### Task 1: Build and test the browser image compressor

**Files:**
- Create: `lib/client/image-compression.ts`
- Test: `tests/unit/customer-image-compression.test.ts`

**Interfaces:**
- Produces `compressCustomerImage(file: File, decode?: ImageDecoder): Promise<File>`.
- Produces `ImageCompressionError` for decode, canvas, encode, and exhausted-budget failures.
- `ImageDecoder` returns width, height, `encode(width, height, quality)`, and `release()` so the byte-budget loop is unit-testable without browser canvas.

- [ ] **Step 1: Write the failing tests**

```ts
it("returns a JPEG within the byte budget after scaling a large portrait image", async () => {
  const result = await compressCustomerImage(new File(["source"], "photo.png"), fakeDecoder);
  expect(result).toMatchObject({ name: "photo.jpg", type: "image/jpeg" });
  expect(fakeDecoder.decode).toHaveBeenCalledOnce();
  expect(fakeImage.encode).toHaveBeenCalledWith(768, 1024, 0.45);
  expect(result.size).toBeLessThanOrEqual(350 * 1024);
});

it("retries lower-quality candidates before returning a compressed file", async () => {
  // First candidate exceeds 350 KiB; the second fits.
  await expect(compressCustomerImage(file, fakeDecoder)).resolves.toMatchObject({ type: "image/jpeg" });
  expect(fakeImage.encode).toHaveBeenCalledTimes(2);
});

it("fails instead of returning the original file when no candidate meets the budget", async () => {
  await expect(compressCustomerImage(file, alwaysLargeDecoder)).rejects.toBeInstanceOf(ImageCompressionError);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:run -- tests/unit/customer-image-compression.test.ts`

Expected: FAIL because `lib/client/image-compression.ts` does not exist.

- [ ] **Step 3: Implement the compressor**

```ts
export const CUSTOMER_IMAGE_MAX_BYTES = 350 * 1024;

export async function compressCustomerImage(
  file: File,
  decode: ImageDecoder = decodeBrowserImage,
): Promise<File> {
  const image = await decode(file);
  try {
    for (const candidate of compressionCandidates(image.width, image.height)) {
      const blob = await image.encode(candidate.width, candidate.height, candidate.quality);
      if (blob && blob.size <= CUSTOMER_IMAGE_MAX_BYTES) {
        return new File([blob], jpegFileName(file.name), {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      }
    }
    throw new ImageCompressionError("That photo could not be compressed. Please retake it.");
  } finally {
    image.release();
  }
}
```

Use candidates at 1024 pixels with quality 0.45, 0.35, and 0.25, then at 768,
640, and 512 pixels with quality 0.25. `decodeBrowserImage` must revoke its
object URL in `release()` and must reject when the image or canvas cannot be
used.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test:run -- tests/unit/customer-image-compression.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add lib/client/image-compression.ts tests/unit/customer-image-compression.test.ts
git commit -m "feat: compress customer intake photos in browser"
```

### Task 2: Submit only compressed intake files

**Files:**
- Modify: `app/c/[token]/page.tsx:203-426`
- Test: `tests/unit/customer-image-compression.test.ts`

**Interfaces:**
- Consumes `compressCustomerImage` from `lib/client/image-compression.ts`.
- `PhotoField` reports `File | null` through `onCompressedFileChange(kind, file)`.
- `IntakeForm` replaces each `FormData` photo entry with its compressed file before `apiPostForm`.

- [ ] **Step 1: Extend the test with compression cleanup behavior**

```ts
it("releases the decoded browser image when compression fails", async () => {
  await expect(compressCustomerImage(file, alwaysLargeDecoder)).rejects.toBeInstanceOf(ImageCompressionError);
  expect(fakeImage.release).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:run -- tests/unit/customer-image-compression.test.ts`

Expected: FAIL until the release behavior is implemented.

- [ ] **Step 3: Wire compression into the capture form**

```tsx
const [compressedFiles, setCompressedFiles] = useState<Record<string, File>>({});

function onCompressedFileChange(kind: string, file: File | null) {
  setCompressedFiles((current) => {
    if (!file) {
      const { [kind]: _removed, ...remaining } = current;
      return remaining;
    }
    return { ...current, [kind]: file };
  });
}

const form = new FormData(formRef.current);
for (const field of UPLOAD_FIELDS) {
  const file = compressedFiles[field.kind];
  if (!file) return;
  form.set(field.kind, file);
}
```

`PhotoField` clears its previously captured file before compression begins. On a
compression error it clears the native file input, shows a field-level retry
message, and leaves no original file eligible for submission. On success it
uses the compressed file for its object-URL preview and reports the file to the
parent.

- [ ] **Step 4: Run the focused and type checks**

Run: `npm run test:run -- tests/unit/customer-image-compression.test.ts && npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit Task 2**

```bash
git add app/c/'[token]'/page.tsx tests/unit/customer-image-compression.test.ts
git commit -m "feat: send compressed customer photo files"
```

### Task 3: Verify the change against the project suite

**Files:**
- Verify only: `lib/client/image-compression.ts`, `app/c/[token]/page.tsx`, and the new unit test.

- [ ] **Step 1: Run formatting-sensitive and full project checks**

Run: `npm run test:run && npm run typecheck && npm run build`

Expected: all tests, typecheck, and Next.js production build pass.

- [ ] **Step 2: Inspect the working tree and commit the verified implementation**

```bash
git status --short
git log -2 --oneline
```

Expected: only the intentional compression files are committed; the pre-existing `.gitignore` change remains untouched.
