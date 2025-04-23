export async function getBufferFromStream(stream: ReadableStream<Uint8Array<ArrayBufferLike>>) {
  // Convert the ReadableStream to a Buffer using the ReadableStream API
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks)
}
