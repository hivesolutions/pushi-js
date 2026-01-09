import hiveConfig from "eslint-config-hive";

/**
 * ESLint configuration for pushi.js
 * @type {import("eslint").Linter.Config[]}
 */
export default [
    ...hiveConfig,
    {
        name: "pushi/overrides",
        rules: {
            "no-var": "off",
            "linebreak-style": "off"
        }
    }
];
