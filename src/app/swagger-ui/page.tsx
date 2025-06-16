'use client'

import { useEffect } from 'react'

// Add TypeScript interface for SwaggerUIBundle
declare global {
  interface Window {
    SwaggerUIBundle: any
  }
}

export default function SwaggerUIPage() {
  useEffect(() => {
    // Initialize Swagger UI when the component mounts
    const initSwagger = () => {
      if (window.SwaggerUIBundle) {
        const ui = window.SwaggerUIBundle({
          url: '/api/openapi-specs',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            window.SwaggerUIBundle.presets.apis,
            window.SwaggerUIBundle.SwaggerUIStandalonePreset,
          ],
          layout: 'BaseLayout',
          docExpansion: 'list',
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 1,
          displayRequestDuration: true,
          filter: true,
        })
      } else {
        // If SwaggerUIBundle is not loaded yet, retry after a delay
        setTimeout(initSwagger, 100)
      }
    }

    // Start initialization
    initSwagger()
  }, [])

  return <div id="swagger-ui"></div>
}
