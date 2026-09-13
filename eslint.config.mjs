import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  { files: ["**/*.js"], languageOptions: { sourceType: "script" } },
  { rules: {
    "no-magic-numbers": ["warn", { ignore: [0] }],
    "no-unused-vars": "warn",
    "no-shadow": "warn",
    "default-case": "warn",
    "eqeqeq": "error",
    "semi": "error",
  }}
]);
