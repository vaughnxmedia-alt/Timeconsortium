"use strict";

const { spawn } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

const packages = {
  supabase: {
    darwin: {
      arm64: ["@supabase/cli-darwin-arm64", "bin/supabase"],
      x64: ["@supabase/cli-darwin-x64", "bin/supabase"],
    },
    linux: {
      arm64: ["@supabase/cli-linux-arm64", "bin/supabase"],
      x64: ["@supabase/cli-linux-x64", "bin/supabase"],
    },
  },
  vercel: {
    darwin: {
      arm64: ["@vercel/vc-native-darwin-arm64", "bin/vercel"],
      x64: ["@vercel/vc-native-darwin-x64", "bin/vercel"],
    },
    linux: {
      arm64: ["@vercel/vc-native-linux-arm64", "bin/vercel"],
      x64: ["@vercel/vc-native-linux-x64", "bin/vercel"],
    },
  },
};

const name = process.argv[2];
const spec = packages[name]?.[process.platform]?.[os.arch()];
if (!spec) {
  console.error(`No ${name} binary for ${process.platform}-${os.arch()}.`);
  process.exit(1);
}

const bin = path.join(path.dirname(require.resolve(`${spec[0]}/package.json`)), spec[1]);
const child = spawn(bin, process.argv.slice(3), { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
