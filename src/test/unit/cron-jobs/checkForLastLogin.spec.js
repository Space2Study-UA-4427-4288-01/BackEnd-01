const userService = require('~/services/user')
const emailService = require('~/services/email')
const emailSubject = require('~/consts/emailSubject')
const { checkLastLogin } = require('~/cron-jobs/checkForLastLogin')

const DAYS_TO_SEND_EMAIL = process.env.DAYS_TO_SEND_EMAIL ? Number(process.env.DAYS_TO_SEND_EMAIL) : 172
const DAYS_TO_DELETE_USER = process.env.DAYS_TO_DELETE_USER ? Number(process.env.DAYS_TO_DELETE_USER) : 180

const mockedUser = {
  email: 'cat@gmail.com',
  firstName: 'cat',
  language: 'en',
  _id: 'testId'
}

jest.mock('~/services/user', () => ({
  deleteUser: jest.fn()
}))
jest.mock('~/services/email', () => ({
  sendEmail: jest.fn()
}))

const daysAgo = (baseDate, days) => new Date(baseDate.getTime() - days * 24 * 60 * 60 * 1000)

let mockedUsersList

describe('checkForLastUserLogin cron-job', () => {
  beforeEach(() => {
    const mockedNow = new Date('2023-08-23T12:00:00.000Z')
    const RealDate = Date
    jest.spyOn(global, 'Date').mockImplementation(
      ((Ctor) =>
        function MockDate(...args) {
          if (args.length === 0) return new Ctor(mockedNow)
          return new Ctor(...args)
        })(RealDate)
    )
    Object.assign(global.Date, {
      ...RealDate,
      now: jest.fn(() => mockedNow.getTime())
    })

    const loginForEmail = daysAgo(mockedNow, DAYS_TO_SEND_EMAIL)
    const loginForDelete = daysAgo(mockedNow, DAYS_TO_DELETE_USER)

    mockedUsersList = { items: [{ ...mockedUser, lastLogin: loginForEmail }] }
    userService.getUsers = jest.fn(() => mockedUsersList)

    global.__loginForDelete = loginForDelete
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('should send email if last login date is equal to days to send email', async () => {
    await checkLastLogin()

    expect(userService.getUsers).toHaveBeenCalledTimes(1)
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1)
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      mockedUser.email,
      emailSubject.LONG_TIME_WITHOUT_LOGIN,
      mockedUser.language,
      { firstName: mockedUser.firstName }
    )
  })

  it('should delete user if last login date is equal or more to days to delete user', async () => {
    mockedUsersList = { items: [{ ...mockedUser, lastLogin: global.__loginForDelete }] }
    userService.getUsers.mockImplementation(() => mockedUsersList)

    await checkLastLogin()

    expect(userService.getUsers).toHaveBeenCalledTimes(1)
    expect(userService.deleteUser).toHaveBeenCalledTimes(1)
    expect(userService.deleteUser).toHaveBeenCalledWith(mockedUser._id)
  })

  it('should return array of undefined if user lastLogin date is less than days to send email', async () => {
    const mockedNow = new Date(Date.now())
    const optimalDate = daysAgo(mockedNow, DAYS_TO_SEND_EMAIL - 1)
    mockedUsersList = { items: [{ ...mockedUser, lastLogin: optimalDate }] }
    userService.getUsers.mockImplementation(() => mockedUsersList)

    const res = await checkLastLogin()

    expect(userService.getUsers).toHaveBeenCalledTimes(1)
    expect(res.length).toBe(1)
    expect(res).toContain(undefined)
  })

  it('should return array of undefined if user has no lastLogin field', async () => {
    mockedUsersList = { items: [{ ...mockedUser }] }
    userService.getUsers.mockImplementation(() => mockedUsersList)

    const res = await checkLastLogin()

    expect(userService.getUsers).toHaveBeenCalledTimes(1)
    expect(res.length).toBe(1)
    expect(res).toContain(undefined)
  })
})
