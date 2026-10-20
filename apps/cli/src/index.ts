import { VERSION } from "@tripwire/engine";

export async function main() {
  console.log(`Tripwire CLI v${VERSION}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
