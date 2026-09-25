import {
  cliCandidates,
  connectorCandidates,
  diagnoseAccount,
  diagnoseConnection,
  resolveYapsCli,
  resolveYapsConnector,
  resolveYapsSession,
} from "./yaps-cli-discovery.js";

export { diagnoseAccount, diagnoseConnection };

export function candidatePaths(options = {}) {
  return connectorCandidates(options).map(({ path }) => path);
}

export function cliCandidatePaths(options = {}) {
  return cliCandidates(options).map(({ path }) => path);
}

export function resolveYapsMcpBinary(options = {}) {
  return resolveYapsConnector(options).path || undefined;
}

export async function resolveYapsCliBinary(options = {}) {
  return (await resolveYapsCli(options)).path || undefined;
}

export async function resolveYapsCliResult(options = {}) {
  return resolveYapsCli(options);
}

export async function resolveYapsSessionResult(options = {}) {
  return resolveYapsSession(options);
}
