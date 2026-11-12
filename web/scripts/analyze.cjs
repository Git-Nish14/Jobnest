const { spawn } = require("node:child_process");

const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  env: { ...process.env, ANALYZE: "true" },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
