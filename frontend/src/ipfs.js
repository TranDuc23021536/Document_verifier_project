import { create } from "ipfs-http-client";

export const ipfs = create({
  url: "https://ipfs.io", // dùng gateway công cộng, không cần Infura
});
