jest.mock('~/services/email', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }))
const User = require('~/models/user')
const { OAuth2Client } = require('google-auth-library')
const { serverInit, serverCleanup, stopServer } = require('~/test/setup')
const {
  lengths: { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH },
  enums: { ROLE_ENUM }
} = require('~/consts/validation')
const {
  tokenNames: { ACCESS_TOKEN, REFRESH_TOKEN }
} = require('~/consts/auth')
const errors = require('~/consts/errors')
const tokenService = require('~/services/token')
const Token = require('~/models/token')
const { expectError } = require('~/test/helpers')

const genEmail = (prefix = 'user') => `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`
const genValidPassword = () => `T_${Math.random().toString(36).slice(-8)}1`

describe('Auth controller', () => {
  let app, server, signupResponse, baseUser

  beforeAll(async () => {
    ;({ app, server } = await serverInit())
  })

  beforeEach(async () => {
    baseUser = {
      role: 'student',
      firstName: 'test',
      lastName: 'test',
      email: genEmail('signup'),
      password: genValidPassword()
    }
    signupResponse = await app.post('/auth/signup').send(baseUser)
  })

  afterEach(async () => {
    await serverCleanup()
  })

  afterAll(async () => {
    await stopServer(server)
  })

  describe('Signup endpoint', () => {
    it('should throw validation errors for the firstName field', async () => {
      const responseForFormat = await app.post('/auth/signup').send({
        ...baseUser,
        email: genEmail('firstNameFormat'),
        firstName: '12345'
      })
      const responseForNull = await app.post('/auth/signup').send({
        ...baseUser,
        email: genEmail('firstNameNull'),
        firstName: null
      })

      const formatError = errors.NAME_FIELD_IS_NOT_OF_PROPER_FORMAT('firstName')
      const nullError = errors.FIELD_IS_NOT_DEFINED('firstName')
      expectError(422, formatError, responseForFormat)
      expectError(422, nullError, responseForNull)
    })

    it('should throw validation errors for the email format', async () => {
      const responseForFormat = await app.post('/auth/signup').send({
        ...baseUser,
        email: 'test'
      })
      const responseForType = await app.post('/auth/signup').send({
        ...baseUser,
        email: 312938
      })

      const formatError = errors.FIELD_IS_NOT_OF_PROPER_FORMAT('email')
      const typeError = errors.FIELD_IS_NOT_OF_PROPER_TYPE('email', 'string')
      expectError(422, formatError, responseForFormat)
      expectError(422, typeError, responseForType)
    })

    it('should throw validation error for the role value', async () => {
      const signupResponseInvalidRole = await app.post('/auth/signup').send({
        ...baseUser,
        email: genEmail('invalidRole'),
        role: 'test'
      })

      const error = errors.FIELD_IS_NOT_OF_PROPER_ENUM_VALUE('role', ROLE_ENUM)
      expectError(422, error, signupResponseInvalidRole)
    })

    it('should throw validation errors for the password`s length', async () => {
      const responseForMax = await app.post('/auth/signup').send({
        ...baseUser,
        email: genEmail('passMax'),
        password: '1'.repeat(MAX_PASSWORD_LENGTH + 1)
      })

      const responseForMin = await app.post('/auth/signup').send({
        ...baseUser,
        email: genEmail('passMin'),
        password: '1'.repeat(MIN_PASSWORD_LENGTH - 1)
      })

      const error = errors.FIELD_IS_NOT_OF_PROPER_LENGTH('password', {
        min: MIN_PASSWORD_LENGTH,
        max: MAX_PASSWORD_LENGTH
      })
      expectError(422, error, responseForMax)
      expectError(422, error, responseForMin)
    })

    it('should throw ALREADY_REGISTERED error', async () => {
      const uniq = genEmail('dup')
      const u = { ...baseUser, email: uniq }
      await app.post('/auth/signup').send(u)
      const response = await app.post('/auth/signup').send(u)
      expectError(409, errors.ALREADY_REGISTERED, response)
    })
  })

  describe('Login endpoint', () => {
    it('should return 401 for wrong password', async () => {
      const email = genEmail('loginWrong')
      const PASS_OK = genValidPassword()
      const PASS_WRONG = PASS_OK.endsWith('1') ? PASS_OK.slice(0, -1) + '2' : PASS_OK + '2'

      const signup = await app.post('/auth/signup').send({
        role: 'student',
        firstName: 'Login',
        lastName: 'User',
        email,
        password: PASS_OK
      })
      expect(signup.status).toBe(201)

      await User.updateOne({ _id: signup.body.userId }, { $set: { isEmailConfirmed: true } }).exec()

      const res = await app.post('/auth/login').send({ email, password: PASS_WRONG })

      expect(res.status).toBe(401)
      expect(res.body).toMatchObject({ code: 'INCORRECT_CREDENTIALS' })
    })

    it('should return 200 and set cookies on successful login', async () => {
      const email = genEmail('loginOk')
      const password = genValidPassword()

      const signup = await app.post('/auth/signup').send({
        role: 'student',
        firstName: 'Login',
        lastName: 'Success',
        email,
        password
      })
      expect(signup.status).toBe(201)

      await User.updateOne({ _id: signup.body.userId }, { $set: { isEmailConfirmed: true } }).exec()

      const res = await app.post('/auth/login').send({ email, password })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('accessToken')

      const setCookie = res.headers['set-cookie'] || []
      const hasAccess = setCookie.some((c) => c.startsWith(`${ACCESS_TOKEN}=`))
      const hasRefresh = setCookie.some((c) => c.startsWith(`${REFRESH_TOKEN}=`))
      expect(hasAccess).toBe(true)
      expect(hasRefresh).toBe(true)
    })
  })

  describe('SendResetPasswordEmail endpoint', () => {
    it('should throw USER_NOT_FOUND error', async () => {
      const response = await app.post('/auth/forgot-password').send({ email: 'invalid@gmail.com' })
      expectError(404, errors.USER_NOT_FOUND, response)
    })
  })

  describe('UpdatePassword endpoint', () => {
    let resetToken
    let findOneSpy

    beforeEach(() => {
      const { firstName, email, role } = baseUser
      resetToken = tokenService.generateResetToken({
        id: signupResponse.body.userId,
        firstName,
        email,
        role
      })

      findOneSpy = jest.spyOn(Token, 'findOne').mockResolvedValue({
        save: jest.fn().mockResolvedValue(resetToken)
      })
    })

    afterEach(() => {
      if (findOneSpy) findOneSpy.mockRestore()
    })

    it('should throw BAD_RESET_TOKEN error', async () => {
      const response = await app.patch('/auth/reset-password/invalid-token').send({ password: genValidPassword() })

      expectError(400, errors.BAD_RESET_TOKEN, response)
    })
  })

  describe('Google Auth endpoint', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should authenticate user with valid Google token', async () => {
      const uniqueEmail = genEmail('google')
      await User.deleteOne({ email: uniqueEmail })

      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          iss: 'accounts.google.com',
          email_verified: true,
          sub: `test-${Date.now()}`,
          email: uniqueEmail,
          given_name: 'Google',
          family_name: 'User'
        })
      })

      const res = await app.post('/auth/google-auth').send({ token: 'valid-google-token' })

      expect(spy).toHaveBeenCalled()
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('accessToken')

      spy.mockRestore()
    })

    it('should throw error for invalid Google token', async () => {
      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockRejectedValue(new Error('Invalid token'))

      const res = await app.post('/auth/google-auth').send({ token: 'invalid-token' })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('TOKEN_NOT_VALID')

      spy.mockRestore()
    })

    it('should return 422 for invalid issuer', async () => {
      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          iss: 'invalid-issuer.com',
          email_verified: true,
          sub: 'test123',
          email: genEmail('issuer'),
          given_name: 'Test',
          family_name: 'User'
        })
      })

      const res = await app.post('/auth/google-auth').send({ token: 'invalid-issuer-token' })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('INVALID_TOKEN_ISSUER')

      spy.mockRestore()
    })

    it('should return 422 for unverified email', async () => {
      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          iss: 'accounts.google.com',
          email_verified: false,
          sub: 'test123',
          email: genEmail('unverified'),
          given_name: 'Test',
          family_name: 'User'
        })
      })

      const res = await app.post('/auth/google-auth').send({ token: 'unverified-email-token' })

      expect(res.status).toBe(422)
      expect(res.body.error).toBe('EMAIL_NOT_VERIFIED')

      spy.mockRestore()
    })

    it('should return 422 for missing token', async () => {
      const response = await app.post('/auth/google-auth').send({})
      expect(response.status).toBe(422)
      expect(response.body.error).toBe('MISSING_TOKEN')
    })
  })

  describe('Refresh endpoint', () => {
    it('should refresh access token with valid refresh cookie', async () => {
      const email = genEmail('refresh')
      const password = genValidPassword()

      const signup = await app.post('/auth/signup').send({
        role: 'student',
        firstName: 'Ref',
        lastName: 'Test',
        email,
        password
      })

      if (signup.status !== 201) {
        process.stdout.write('Signup failed:\n' + JSON.stringify(signup.body, null, 2) + '\n')
      }

      expect(signup.status).toBe(201)

      await User.updateOne(
        { _id: signup.body.userId },
        { $set: { isEmailConfirmed: true, lastLoginAs: 'student' } }
      ).exec()

      const loginRes = await app.post('/auth/login').send({ email, password })
      expect(loginRes.status).toBe(200)
      const cookies = loginRes.headers['set-cookie'] || []
      expect(cookies.length).toBeGreaterThan(0)
      const refreshRes = await app.get('/auth/refresh').set('Cookie', cookies)
      expect(refreshRes.status).toBe(200)
      expect(refreshRes.body).toHaveProperty('accessToken')
    })
  })
})
