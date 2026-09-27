import QRCode from "qrcode";
import { writeFileSync } from "node:fs";

const url = process.argv[2] ?? "https://t.me/usetenth_bot";
for (const [file, dark] of [["bot-qr.svg", "#12131a"], ["bot-qr-dark.svg", "#ffffff"]]) {
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark, light: "#0000" } });
  writeFileSync(new URL(`../public/brand/${file}`, import.meta.url), svg);
}
console.log(`QR codes written for ${url}`);
