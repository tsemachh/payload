export function checksum(checksumString: string) {
  // Create a simple hash from the string
  if (!checksumString) {
    return 'EmptyCheckSum'
  }
  let hash = 0
  for (let i = 0; i < checksumString.length; i++) {
    const char = checksumString.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  return hash.toString(16) // Return as hex string
}
