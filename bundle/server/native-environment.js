export function nativeConnectorEnvironment(environment = process.env) {
  const inherited = { ...environment };
  // This standalone Claude Desktop bundle is not one of the app's narrowly
  // trusted first-party auto-authorize clients. Never inherit or set the flag.
  delete inherited.YAPS_MCP_AUTO_AUTHORIZE_READ;
  inherited.YAPS_MCP_CLIENT_ID = inherited.YAPS_MCP_CLIENT_ID || "claude-desktop";
  return inherited;
}
