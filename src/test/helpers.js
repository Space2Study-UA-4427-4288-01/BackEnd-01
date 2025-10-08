const crypto = require('crypto')

const expectError = (statusCode, error, response) => {
  expect(response.body).toEqual({
    ...error,
    status: statusCode
  })
}

const genUUID = () => crypto.randomUUID().replace(/-/g, '')
const genEmail = (prefix = 'user') => `${prefix}.${genUUID().slice(0, 12)}@example.com`
const genValidPassword = () => `T_${genUUID().slice(0, 8)}1`

module.exports = { expectError, genUUID, genEmail, genValidPassword }
