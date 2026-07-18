import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

const CLAIMLENS_PREFIX = "claimlens/";

function assertClaimLensPath(pathname: string): void {
  if (!pathname.startsWith(CLAIMLENS_PREFIX)) {
    throw new Error(`Artifact path must start with ${CLAIMLENS_PREFIX}`);
  }
}

export interface ArtifactStore {
  putJpeg(pathname: string, bytes: Buffer): Promise<void>;
  get(pathname: string): Promise<Buffer | null>;
  withLocalFile<T>(
    pathname: string,
    callback: (localPath: string) => Promise<T> | T,
  ): Promise<T>;
  deletePrefix(prefix: string): Promise<void>;
}

abstract class BaseArtifactStore implements ArtifactStore {
  abstract putJpeg(pathname: string, bytes: Buffer): Promise<void>;
  abstract get(pathname: string): Promise<Buffer | null>;
  abstract deletePrefix(prefix: string): Promise<void>;

  async withLocalFile<T>(
    pathname: string,
    callback: (localPath: string) => Promise<T> | T,
  ): Promise<T> {
    const bytes = await this.get(pathname);
    if (!bytes) {
      throw new Error(`Artifact not found: ${pathname}`);
    }

    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "claimlens-artifact-"));
    const localPath = path.join(directory, path.basename(pathname));
    try {
      await fs.writeFile(localPath, bytes);
      return await callback(localPath);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}

/** Private Vercel Blob implementation for durable ClaimLens artifacts. */
export class PrivateBlobArtifactStore extends BaseArtifactStore {
  async putJpeg(pathname: string, bytes: Buffer): Promise<void> {
    assertClaimLensPath(pathname);
    await put(pathname, bytes, { access: "private", contentType: "image/jpeg" });
  }

  async get(pathname: string): Promise<Buffer | null> {
    assertClaimLensPath(pathname);
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  async deletePrefix(prefix: string): Promise<void> {
    assertClaimLensPath(prefix);

    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor });
      if (page.blobs.length > 0) {
        await del(page.blobs.map((blob) => blob.pathname));
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }
}

/** Deterministic in-memory store for tests. */
export class InMemoryArtifactStore extends BaseArtifactStore {
  private readonly artifacts = new Map<string, Buffer>();

  async putJpeg(pathname: string, bytes: Buffer): Promise<void> {
    assertClaimLensPath(pathname);
    this.artifacts.set(pathname, Buffer.from(bytes));
  }

  async get(pathname: string): Promise<Buffer | null> {
    assertClaimLensPath(pathname);
    const bytes = this.artifacts.get(pathname);
    return bytes ? Buffer.from(bytes) : null;
  }

  async deletePrefix(prefix: string): Promise<void> {
    assertClaimLensPath(prefix);
    for (const pathname of this.artifacts.keys()) {
      if (pathname.startsWith(prefix)) {
        this.artifacts.delete(pathname);
      }
    }
  }
}

export function createInMemoryArtifactStore(): ArtifactStore {
  return new InMemoryArtifactStore();
}
