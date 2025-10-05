jest.mock('~/services/email', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }))
jest.mock('~/logger/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }))

const { serverInit, serverCleanup, stopServer } = require('~/test/setup')
const { expectError } = require('~/test/helpers')
const { UNAUTHORIZED, FORBIDDEN } = require('~/consts/errors')
const tokenService = require('~/services/token')
const User = require('~/models/user')
const {
  roles: { TUTOR }
} = require('~/consts/auth')

const endpointUrl = '/resources-categories/'

const testResourceCategoryData = { name: 'Chemical Category' }
const updateResourceCategoryData = { name: 'Computer Science' }

const tutorUserData = {
  role: 'tutor',
  firstName: 'Res',
  lastName: 'Tutor',
  email: 'res.tutor@example.com',
  password: 'Valid_pass1'
}
const studentUserData = {
  role: 'student',
  firstName: 'Yamada',
  lastName: 'Kizen',
  email: 'yamakai@gmail.com',
  password: 'ninpopass1',
  appLanguage: 'en',
  isEmailConfirmed: true,
  lastLogin: new Date().toJSON(),
  lastLoginAs: 'student'
}

async function signupConfirmAndLogin(app, { role, firstName, lastName, email, password }, lastLoginAs = role) {
  const signup = await app.post('/auth/signup').send({ role, firstName, lastName, email, password })
  expect(signup.statusCode).toBe(201)

  await User.updateOne({ _id: signup.body.userId }, { $set: { isEmailConfirmed: true, lastLoginAs } }).exec()

  const uniqueIp = '10.' + (email.length % 250) + '.0.' + (email.charCodeAt(0) % 250)

  const loginRes = await app.post('/auth/login').set('X-Forwarded-For', uniqueIp).send({ email, password })

  expect(loginRes.statusCode).toBe(200)

  const cookies = loginRes.headers['set-cookie'] || []
  const payload = tokenService.validateAccessToken(loginRes.body.accessToken)

  return { cookies, payload }
}

describe('ResourceCategory controller', () => {
  let app, server
  let tutorCookies, studentCookies, currentUser, testResourceCategory

  beforeAll(async () => {
    ;({ app, server } = await serverInit())
  })

  beforeEach(async () => {
    const tutor = await signupConfirmAndLogin(app, tutorUserData, TUTOR)
    tutorCookies = tutor.cookies
    currentUser = tutor.payload

    const student = await signupConfirmAndLogin(app, studentUserData, 'student')
    studentCookies = student.cookies

    testResourceCategory = await app.post(endpointUrl).send(testResourceCategoryData).set('Cookie', tutorCookies)
  })

  afterEach(async () => {
    await serverCleanup()
  })

  afterAll(async () => {
    await stopServer(server)
  })

  describe(`POST ${endpointUrl}`, () => {
    it('should create a new reesource category', async () => {
      expect(testResourceCategory.statusCode).toBe(201)
      expect(testResourceCategory._body).toMatchObject({
        _id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        author: currentUser.id,
        ...testResourceCategoryData
      })
    })

    it('should throw UNAUTHORIZED', async () => {
      const response = await app.post(endpointUrl)
      expectError(401, UNAUTHORIZED, response)
    })

    it('should throw FORBIDDEN', async () => {
      const response = await app.post(endpointUrl).send(testResourceCategoryData).set('Cookie', studentCookies)
      expectError(403, FORBIDDEN, response)
    })
  })

  describe(`PATCH ${endpointUrl}:id`, () => {
    it('should update resource category', async () => {
      const response = await app
        .patch(endpointUrl + testResourceCategory.body._id)
        .send(updateResourceCategoryData)
        .set('Cookie', tutorCookies)

      expect(response.statusCode).toBe(204)
    })

    it('should throw UNAUTHORIZED', async () => {
      const response = await app.patch(endpointUrl)
      expectError(401, UNAUTHORIZED, response)
    })

    it('should throw FORBIDDEN', async () => {
      const response = await app.patch(endpointUrl).send(updateResourceCategoryData).set('Cookie', studentCookies)

      expectError(403, FORBIDDEN, response)
    })
  })
})
