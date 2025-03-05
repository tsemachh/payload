// Wait for the dev server to start
setTimeout(async () => {
  try {
    fetch('http://localhost:3000/admin')
  } catch (error) {
    console.error('Failed to fetch admin data:', error)
  }
}, 10000) // 5000ms delay
