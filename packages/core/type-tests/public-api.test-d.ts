import {
  CORE_PACKAGE_NAME,
  CORE_VERSION,
  type CorePackageName,
  type CoreVersion
} from "@nusajs/core";

const packageName: CorePackageName = CORE_PACKAGE_NAME;
const version: CoreVersion = CORE_VERSION;

packageName satisfies "@nusajs/core";
version satisfies "0.0.0";

// @ts-expect-error package identity is an exact literal type
const invalidPackageName: CorePackageName = "nusajs";

void invalidPackageName;
