import { describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret } from "../src/lib/encryption.js";

describe("encryption", () => {
  it("round trips secrets with AES-GCM", async () => {
    const secret = "super-secret-key";
    const payload = "test-value-123";

    const encrypted = await encryptSecret(payload, secret);
    expect(encrypted).not.toContain(payload);

    const decrypted = await decryptSecret(encrypted, secret);
    expect(decrypted).toBe(payload);
  });
});
