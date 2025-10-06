const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || `Test_${Math.random().toString(36).slice(2, 10)}A1!`

module.exports = { TEST_USER_PASSWORD }