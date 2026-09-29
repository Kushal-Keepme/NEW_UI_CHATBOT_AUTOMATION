module.exports = {
  default: {
    requireModule: [
      "ts-node/register/files"
    ],
    require: [
      "src/support/**/*.ts",
      "src/hooks/**/*.ts",
      "src/steps/**/*.ts",
      "src/commons/**/*.ts",
      "src/api/steps/**/*.ts"
    ],
    format: [
      "progress",
      `json:reports/cucumber/${process.env.CLIENT || "report"}/${process.env.CLIENT || "report"}.json`
    ],
    paths: ["src/features/**/*.feature"],
    parallel: 1,
    timeout: 90000
  }
};
