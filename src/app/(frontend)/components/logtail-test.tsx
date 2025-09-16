'use client'

import { useLogger } from '../hooks/useLogger'
import { getWithErrorHandling, postWithErrorHandling } from '../helpers/fetch-helpers'

export const LogtailTest = () => {
  const logger = useLogger()

  const testConsoleRedirection = () => {
    console.log('Test console.log - this should appear in Logtail')
    console.info('Test console.info - this should appear in Logtail')
    console.warn('Test console.warn - this should appear in Logtail')
    console.error('Test console.error - this should appear in Logtail')
    console.debug('Test console.debug - this should appear in Logtail')
    
    console.log('Complex object:', { 
      user: 'test', 
      action: 'button_click', 
      timestamp: new Date(),
      nested: { data: 'value' }
    })
  }

  const testLoggerHook = () => {
    logger.info('Test logger.info - direct Logtail call')
    logger.warn('Test logger.warn - direct Logtail call')
    logger.error('Test logger.error - direct Logtail call')
    logger.debug('Test logger.debug - direct Logtail call')
  }

  const testApiCalls = async () => {
    try {
      console.log('Testing API calls...')
      
      // Test successful GET
      await getWithErrorHandling('/api/config')
      
      // Test POST (this might fail but that's OK for testing)
      try {
        await postWithErrorHandling('/api/test-endpoint', { test: 'data' })
      } catch (error) {
        console.log('Expected error for test endpoint')
      }
      
      // Test a call that will definitely fail (404)
      try {
        await getWithErrorHandling('/api/nonexistent-endpoint')
      } catch (error) {
        console.log('Expected 404 error for nonexistent endpoint')
      }
    } catch (error) {
      console.log('API test completed with some errors (expected)')
    }
  }

  if (!logger.isReady) {
    return <div>Logtail is initializing...</div>
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Logtail Test Component</h2>
      <p>Check your Logtail dashboard to see if logs are being sent correctly.</p>
      
      <div className="space-x-4 space-y-2">
        <button 
          onClick={testConsoleRedirection}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Console Redirection
        </button>
        
        <button 
          onClick={testLoggerHook}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test Logger Hook
        </button>
        
        <button 
          onClick={testApiCalls}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Test API Logging
        </button>
      </div>
    </div>
  )
}