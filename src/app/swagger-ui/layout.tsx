export const metadata = {
  title: 'API Documentation',
  description: 'Swagger UI API Documentation',
}

export default function SwaggerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }

          /* Improve contrast for better visibility */
          .swagger-ui .opblock-tag {
            color: #000 !important;
            font-weight: 600 !important;
          }

          .swagger-ui .opblock .opblock-summary-method {
            font-weight: bold !important;
          }

          .swagger-ui .info .title {
            color: #000 !important;
            font-size: 36px !important;
            font-weight: bold !important;
          }

          .swagger-ui .info {
            margin: 20px 0 !important;
          }

          /* Improve readability of operation summaries */
          .swagger-ui .opblock-summary-description {
            font-weight: 500 !important;
            color: #333 !important;
          }

          /* Add more contrast to operation blocks */
          .swagger-ui .opblock-post {
            background: rgba(73, 204, 144, 0.2) !important;
            border-color: #49cc90 !important;
          }

          .swagger-ui .opblock-get {
            background: rgba(97, 175, 254, 0.2) !important;
            border-color: #61affe !important;
          }

          /* Hide topbar */
          .swagger-ui .topbar {
            display: none;
          }
        `}} />
        <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" async></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
