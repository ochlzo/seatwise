const { execSync } = require("child_process");

if (process.env.RUN_PRISMA_GENERATE === "true") {
  execSync("npx prisma generate", { stdio: "inherit" });
} else {
  console.log("Skipping prisma generate (set RUN_PRISMA_GENERATE=true to enable)");
}

