// Promise Pool implementation to limit concurrency
export class PromisePool {
  private concurrency: number
  private running: number
  private queue: (() => Promise<void>)[]

  constructor(concurrency: number) {
    this.concurrency = concurrency
    this.running = 0
    this.queue = []
  }

  async add<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        this.running++
        let timeoutId: NodeJS.Timeout | undefined

        try {
          if (timeoutMs) {
            const timeoutPromise = new Promise<never>((_, rej) => {
              timeoutId = setTimeout(() => {
                rej(new Error(`PromisePool task timed out after ${timeoutMs}ms`))
              }, timeoutMs)
            })
            const result = await Promise.race([fn(), timeoutPromise])
            resolve(result)
          } else {
            const result = await fn()
            resolve(result)
          }
        } catch (error) {
          reject(error)
        } finally {
          if (timeoutId) clearTimeout(timeoutId)
          this.running--
          this.next()
        }
      }

      if (this.running < this.concurrency) {
        run()
      } else {
        this.queue.push(run)
      }
    })
  }

  private next() {
    if (this.queue.length > 0 && this.running < this.concurrency) {
      const fn = this.queue.shift()
      if (fn) fn()
    }
  }

  async waitForAll(): Promise<void> {
    if (this.running === 0 && this.queue.length === 0) {
      return
    }

    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.running === 0 && this.queue.length === 0) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }
}
