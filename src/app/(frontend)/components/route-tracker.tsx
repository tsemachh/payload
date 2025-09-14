'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLogger } from '../hooks/useLogger'

export const RouteTracker = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const logger = useLogger()
  const previousRoute = useRef<string>('')
  const [hasLoggedInitialLoad, setHasLoggedInitialLoad] = useState(false)

  // Effect to handle initial page load - wait for logger to be ready
  useEffect(() => {
    const fullPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    
    if (!hasLoggedInitialLoad) {
      console.log('RouteTracker: Attempting to log initial page load')
      console.log('RouteTracker: User landed on:', fullPath)
      console.debug('RouteTracker: Logger ready status:', logger.isReady)
      
      if (logger.isReady) {
        console.log('RouteTracker: Logger is ready, sending to Logtail')
        logger.info('User landed on page', {
          route: fullPath,
          pathname,
          searchParams: searchParams.toString(),
          type: 'page_load'
        })
        previousRoute.current = fullPath
        setHasLoggedInitialLoad(true)
      } else {
        console.debug('RouteTracker: Logger not ready yet, will retry when ready')
        // Set a timeout as fallback in case logger never becomes ready
        setTimeout(() => {
          if (!hasLoggedInitialLoad) {
            console.debug('RouteTracker: Fallback - logging page load even though logger might not be ready')
            logger.info('User landed on page', {
              route: fullPath,
              pathname,
              searchParams: searchParams.toString(),
              type: 'page_load'
            })
            previousRoute.current = fullPath
            setHasLoggedInitialLoad(true)
          }
        }, 2000)
      }
    }
  }, [pathname, searchParams, logger.isReady, hasLoggedInitialLoad])

  // Effect to handle route changes
  useEffect(() => {
    if (!hasLoggedInitialLoad || !logger.isReady) return

    const fullPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    
    if (previousRoute.current !== fullPath) {
      console.log('User navigated from:', previousRoute.current, 'to:', fullPath)
      console.debug('Logger ready status:', logger.isReady)
      
      logger.info('User navigated to new route', {
        from: previousRoute.current,
        to: fullPath,
        pathname,
        searchParams: searchParams.toString(),
        type: 'route_change'
      })
      previousRoute.current = fullPath
    }
  }, [pathname, searchParams, logger, hasLoggedInitialLoad])

  // This component doesn't render anything
  return null
}