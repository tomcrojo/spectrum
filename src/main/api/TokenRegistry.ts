interface TokenScope {
  workspaceId: string
  projectId: string
}

const tokenScopes = new Map<string, TokenScope>()

export function registerToken(
  token: string,
  workspaceId: string,
  projectId: string
): void {
  tokenScopes.set(token, { workspaceId, projectId })
}

export function validateToken(token: string): TokenScope | null {
  return tokenScopes.get(token) ?? null
}

export function revokeToken(token: string): void {
  tokenScopes.delete(token)
}
