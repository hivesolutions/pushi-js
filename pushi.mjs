/**
 * ESM wrapper for pushi.js
 * This allows importing pushi in ESM environments while keeping
 * the main pushi.js file compatible with legacy browsers.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pushi = require("./pushi.js");

export const { Pushi, Channel, Observable } = pushi;
export default pushi;
