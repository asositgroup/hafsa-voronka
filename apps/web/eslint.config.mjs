import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const EMOJI = "/[\\p{Emoji_Presentation}\\u{FE0F}]/u";
const noEmoji = "Web pages must not contain emojis; use an SVG icon from components/icons.tsx instead.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${EMOJI}]`, message: noEmoji },
        { selector: `TemplateElement[value.raw=${EMOJI}]`, message: noEmoji },
        { selector: `JSXText[value=${EMOJI}]`, message: noEmoji },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/js/**",
  ]),
]);

export default eslintConfig;
