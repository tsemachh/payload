export function shouldEnforceSecurityMeasures(): boolean {
  // Enforce security in specific environments
  if (process.env.ENV === 'integration') {
    return false
  }
  return true
}
