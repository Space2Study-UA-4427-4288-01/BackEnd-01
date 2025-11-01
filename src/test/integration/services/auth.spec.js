jest.mock('~/services/email', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }))

const { serverInit, serverCleanup, stopServer } = require('~/test/setup')
const authService = require('~/services/auth')
const tokenService = require('~/services/token')
const User = require('~/models/user')
const Token = require('~/models/token')
const { genValidPassword, genEmail } = require('~/test/helpers')
const {
  INCORRECT_CREDENTIALS,
  EMAIL_NOT_CONFIRMED,
  BAD_REFRESH_TOKEN,
  USER_NOT_FOUND,
  BAD_CONFIRM_TOKEN,
  EMAIL_ALREADY_CONFIRMED
} = require('~/consts/errors')
const { roles, SALT_ROUNDS } = require('~/consts/auth')

const createTestUser = async (overrides = {}) => {
  const base = {
    role: [roles.STUDENT],
    firstName: 'Test',
    lastName: 'User',
    email: genEmail(),
    password: genValidPassword(),
    appLanguage: 'en',
    isEmailConfirmed: false,
    lastLoginAs: roles.STUDENT
  }
  return await User.create({ ...base, ...overrides })
}

describe('authService integration', () => {
  let server

  beforeAll(async () => {
    ;({ server } = await serverInit())
  })

  afterEach(async () => {
    await serverCleanup()
  })

  afterAll(async () => {
    await stopServer(server)
  })

  describe('signup', () => {
    it('creates user and generates confirmation token', async () => {
      const email = genEmail()
      const password = genValidPassword()

      const result = await authService.signup(roles.STUDENT, 'John', 'Doe', email, password, 'en')

      expect(result.userId).toBeDefined()
      expect(result.userEmail).toBe(email)

      const user = await User.findById(result.userId).select('+isEmailConfirmed')
      expect(user.isEmailConfirmed).toBe(false)

      const token = await Token.findOne({ user: result.userId })
      expect(token.confirmToken).toBeDefined()
    })
  })

  describe('login', () => {
    it('returns tokens for valid credentials with confirmed email', async () => {
      const email = genEmail()
      const password = genValidPassword()

      await createTestUser({
        email,
        password: await require('bcrypt').hash(password, SALT_ROUNDS),
        isEmailConfirmed: true
      })

      const tokens = await authService.login(email, password)

      expect(tokens).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      })
    })

    it('throws INCORRECT_CREDENTIALS for wrong password', async () => {
      const email = genEmail()
      const password = genValidPassword()

      await createTestUser({
        email,
        password: await require('bcrypt').hash(password, SALT_ROUNDS),
        isEmailConfirmed: true
      })

      await expect(authService.login(email, 'WrongPassword123')).rejects.toMatchObject({
        code: INCORRECT_CREDENTIALS.code,
        status: 401
      })
    })

    it('throws EMAIL_NOT_CONFIRMED for unconfirmed email', async () => {
      const email = genEmail()
      const password = genValidPassword()

      await createTestUser({
        email,
        password: await require('bcrypt').hash(password, SALT_ROUNDS),
        isEmailConfirmed: false
      })

      await expect(authService.login(email, password)).rejects.toMatchObject({
        code: EMAIL_NOT_CONFIRMED.code,
        status: 401
      })
    })

    it('throws INCORRECT_CREDENTIALS for non-existent user', async () => {
      await expect(authService.login('nonexistent@example.com', 'Password123')).rejects.toMatchObject({
        code: INCORRECT_CREDENTIALS.code,
        status: 401
      })
    })
  })

  describe('confirmEmail', () => {
    it('confirms email successfully with valid token', async () => {
      const user = await createTestUser({ isEmailConfirmed: false })
      const confirmToken = tokenService.generateConfirmToken({
        id: user._id,
        role: roles.STUDENT
      })
      await tokenService.saveToken(user._id, confirmToken, 'confirmToken')

      await authService.confirmEmail(confirmToken, 'en')

      const updated = await User.findById(user._id).select('+isEmailConfirmed')
      expect(updated.isEmailConfirmed).toBe(true)

      const token = await Token.findOne({ confirmToken })
      expect(token).toBeNull()
    })

    it('throws BAD_CONFIRM_TOKEN for invalid token', async () => {
      await expect(authService.confirmEmail('invalid-token', 'en')).rejects.toMatchObject({
        code: BAD_CONFIRM_TOKEN.code,
        status: 400
      })
    })

    it('throws EMAIL_ALREADY_CONFIRMED when email already confirmed', async () => {
      const user = await createTestUser({ isEmailConfirmed: true })
      const confirmToken = tokenService.generateConfirmToken({
        id: user._id,
        role: roles.STUDENT
      })
      await tokenService.saveToken(user._id, confirmToken, 'confirmToken')

      await expect(authService.confirmEmail(confirmToken, 'en')).rejects.toMatchObject({
        code: EMAIL_ALREADY_CONFIRMED.code,
        status: 400
      })
    })
  })

  describe('logout', () => {
    it('removes refresh token', async () => {
      const user = await createTestUser({ isEmailConfirmed: true })
      const tokens = tokenService.generateTokens({
        id: user._id,
        role: roles.STUDENT,
        isFirstLogin: false
      })
      await tokenService.saveToken(user._id, tokens.refreshToken, 'refreshToken')

      await authService.logout(tokens.refreshToken)

      const token = await Token.findOne({ refreshToken: tokens.refreshToken })
      expect(token).toBeNull()
    })
  })

  describe('refreshAccessToken', () => {
    it('generates new tokens with valid refresh token', async () => {
      const user = await createTestUser({
        isEmailConfirmed: true,
        lastLoginAs: roles.STUDENT
      })
      const oldTokens = tokenService.generateTokens({
        id: user._id,
        role: roles.STUDENT,
        isFirstLogin: false
      })
      await tokenService.saveToken(user._id, oldTokens.refreshToken, 'refreshToken')

      const newTokens = await authService.refreshAccessToken(oldTokens.refreshToken)

      expect(newTokens).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      })
      expect(newTokens.refreshToken).not.toBe(oldTokens.refreshToken)
    })

    it('throws BAD_REFRESH_TOKEN for invalid token', async () => {
      await expect(authService.refreshAccessToken('invalid-token')).rejects.toMatchObject({
        code: BAD_REFRESH_TOKEN.code,
        status: 400
      })
    })
  })

  describe('sendResetPasswordEmail', () => {
    it('generates reset token for existing user', async () => {
      const user = await createTestUser({ isEmailConfirmed: true })

      await authService.sendResetPasswordEmail(user.email, 'en')

      const token = await Token.findOne({ user: user._id })
      expect(token.resetToken).toBeDefined()
    })

    it('throws USER_NOT_FOUND for non-existent email', async () => {
      await expect(authService.sendResetPasswordEmail('nonexistent@example.com', 'en')).rejects.toMatchObject({
        code: USER_NOT_FOUND.code,
        status: 404
      })
    })
  })

  describe('updatePassword', () => {
    it('updates password with valid reset token', async () => {
      const user = await createTestUser({ isEmailConfirmed: true })
      const resetToken = tokenService.generateResetToken({
        id: user._id,
        firstName: user.firstName,
        email: user.email
      })
      await tokenService.saveToken(user._id, resetToken, 'resetToken')

      const newPassword = genValidPassword()
      await authService.updatePassword(resetToken, newPassword, 'en')

      const updated = await User.findById(user._id).select('+password')
      const bcrypt = require('bcrypt')
      const isMatch = await bcrypt.compare(newPassword, updated.password)
      expect(isMatch).toBe(true)

      const token = await Token.findOne({ user: user._id })
      expect(token?.resetToken).toBeFalsy()
    })
  })

  describe('googleAuth', () => {
    const { OAuth2Client } = require('google-auth-library')
    const { genUUID } = require('~/test/helpers')

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('authenticates new user with valid Google token', async () => {
      const uniqueEmail = genEmail()
      await User.deleteOne({ email: uniqueEmail })

      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          iss: 'accounts.google.com',
          email_verified: true,
          sub: `test-${genUUID()}`,
          email: uniqueEmail,
          given_name: 'Google',
          family_name: 'User'
        })
      })

      const tokens = await authService.googleAuth('valid-google-token')

      expect(spy).toHaveBeenCalled()
      expect(tokens).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      })

      const user = await User.findOne({ email: uniqueEmail }).select('+isEmailConfirmed')
      expect(user).toBeTruthy()
      expect(user.isEmailConfirmed).toBe(true)
      expect(user.firstName).toBe('Google')

      spy.mockRestore()
    })

    it('authenticates existing user with Google token', async () => {
      const email = genEmail()
      await createTestUser({
        email,
        isEmailConfirmed: true,
        password: await require('bcrypt').hash(genValidPassword(), SALT_ROUNDS)
      })

      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          iss: 'accounts.google.com',
          email_verified: true,
          sub: `test-${genUUID()}`,
          email,
          given_name: 'Existing',
          family_name: 'User'
        })
      })

      const tokens = await authService.googleAuth('valid-google-token')

      expect(tokens).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      })

      spy.mockRestore()
    })

    it('throws INVALID_TOKEN_ISSUER for invalid issuer', async () => {
      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          iss: 'invalid-issuer.com',
          email_verified: true,
          sub: 'test123',
          email: genEmail(),
          given_name: 'Test',
          family_name: 'User'
        })
      })

      await expect(authService.googleAuth('invalid-issuer-token')).rejects.toMatchObject({
        code: 'INVALID_TOKEN_ISSUER',
        status: 422
      })

      spy.mockRestore()
    })

    it('throws EMAIL_NOT_VERIFIED for unverified email', async () => {
      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          iss: 'accounts.google.com',
          email_verified: false,
          sub: 'test123',
          email: genEmail(),
          given_name: 'Test',
          family_name: 'User'
        })
      })

      await expect(authService.googleAuth('unverified-email-token')).rejects.toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
        status: 422
      })

      spy.mockRestore()
    })

    it('throws MISSING_SUB_CLAIM when sub is missing', async () => {
      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          iss: 'accounts.google.com',
          email_verified: true,
          sub: null,
          email: genEmail(),
          given_name: 'Test',
          family_name: 'User'
        })
      })

      await expect(authService.googleAuth('missing-sub-token')).rejects.toMatchObject({
        code: 'MISSING_SUB_CLAIM',
        status: 422
      })

      spy.mockRestore()
    })

    it('throws error when token verification fails', async () => {
      const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockRejectedValue(new Error('Invalid token'))

      await expect(authService.googleAuth('invalid-token')).rejects.toThrow()

      spy.mockRestore()
    })
  })
})
