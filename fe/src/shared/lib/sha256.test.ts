import { afterEach, describe, expect, it, vi } from "vitest";

import { Sha256Error, sha256FileHex, sha256Hex } from "./sha256";

const ABC_DIGEST = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const EMPTY_DIGEST = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const LONG_DIGEST = "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sha256Hex", () => {
  it("uses the Web Crypto fast path when it is available", async () => {
    const digest = vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
    vi.stubGlobal("crypto", { subtle: { digest } });
    const input = new Uint8Array([97, 98, 99]).buffer;

    await expect(sha256Hex(input)).resolves.toBe("ab".repeat(32));
    expect(digest).toHaveBeenCalledWith("SHA-256", input);
  });

  it("calculates SHA-256 digests without Web Crypto", async () => {
    vi.stubGlobal("crypto", undefined);

    await expect(
      Promise.all([
        sha256Hex(new Uint8Array().buffer),
        sha256Hex(new Uint8Array([97, 98, 99]).buffer),
        sha256Hex(new Uint8Array(1000).fill(97).buffer),
      ]),
    ).resolves.toEqual([EMPTY_DIGEST, ABC_DIGEST, LONG_DIGEST]);
  });

  it("provides an actionable error when the selected file cannot be read", async () => {
    const unreadableFile: Pick<Blob, "arrayBuffer"> = {
      arrayBuffer: () => Promise.reject(new Error("file read failed")),
    };

    await expect(sha256FileHex(unreadableFile)).rejects.toEqual(
      expect.objectContaining({
        name: "Sha256Error",
        message:
          "Unable to calculate a checksum for this file. Try selecting it again or use a current browser.",
      }),
    );
    await expect(sha256FileHex(unreadableFile)).rejects.toBeInstanceOf(Sha256Error);
  });
});
