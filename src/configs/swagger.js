const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')

const options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Space2Study API',
      version: '0.0.1',
      description: 'API documentation for Space2Study project'
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:8080',
        description: 'Development server'
      }
    ]
  },
  apis: ['./src/docs/components/*.yaml', './src/docs/paths/*.yaml']
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = {
  swaggerSpec,
  swaggerUi
}
