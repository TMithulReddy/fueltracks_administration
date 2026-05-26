const withTimeout = (promise, ms = 8000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => 
        reject(new Error(`Request timed out after ${ms}ms`)), 
        ms
      )
    )
  ])
}

export default withTimeout
