/** The canonical package name for the universal NusaJS core. */
export const CORE_PACKAGE_NAME = "@nusajs/core" as const;

/**
 * The coordinated framework version represented by this package build.
 *
 * This pre-release workspace value is replaced by the controlled release process once publishing
 * is authorized.
 */
export const CORE_VERSION = "0.0.0" as const;

/** The literal type of the canonical universal core package name. */
export type CorePackageName = typeof CORE_PACKAGE_NAME;

/** The literal type of the coordinated framework version. */
export type CoreVersion = typeof CORE_VERSION;

export type {
  ActiveDiagnosticCode,
  Diagnostic,
  DiagnosticCode,
  DiagnosticInput,
  DiagnosticSeverity,
  ProductionDiagnostic,
  SourcePosition,
  SourceRange
} from "./diagnostics.js";
export {
  createDiagnostic,
  formatDevelopmentDiagnostic,
  formatProductionDiagnostic,
  serializeDevelopmentDiagnostic
} from "./diagnostics.js";
export type {
  BufferedRenderResult,
  Renderer,
  RendererDelivery,
  RenderInput,
  RenderResult,
  StreamingRenderResult
} from "./renderer.js";
export { defineRenderer } from "./renderer.js";
export type { CreateRequestContextInput, RequestContext } from "./request-context.js";
export { createRequestContext } from "./request-context.js";
export type {
  CreateRequestHandlerOptions,
  EndpointRouteBinding,
  HandleRequestInput,
  PageRouteBinding,
  RequestHandler,
  RequestRouteBinding
} from "./request-handler.js";
export { createRequestHandler } from "./request-handler.js";
export type {
  MatchRoute,
  MatchRouteSegment,
  MatchRouteSegmentKind,
  RouteMatch,
  RouteMatcher
} from "./route-matcher.js";
export { createRouteMatcher } from "./route-matcher.js";
export type {
  CoopValue,
  CorpValue,
  CspDirectiveName,
  CspDirectives,
  CrossOriginIsolationOptions,
  FrameOptionsValue,
  HstsOptions,
  ReferrerPolicyValue,
  SecurityHeaderConflict,
  SecurityHeaderMergeResult,
  SecurityHeaderOptions
} from "./security-headers.js";
export {
  createSecurityHeaders,
  mergeSecurityHeaders,
  mergeSecurityHeadersStrict
} from "./security-headers.js";
export { createSecureToken } from "./secure-token.js";
