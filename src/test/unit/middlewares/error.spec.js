const errorMiddleware = require('~/middlewares/error')
const logger = require('~/logger/logger')
const getUniqueFields = require('~/utils/getUniqueFields')
const errors = require('~/consts/errors')

jest.mock('~/logger/logger')
jest.mock('~/utils/getUniqueFields')

describe('errorMiddleware', () => {
  let res

  beforeEach(() => {
    jest.clearAllMocks()

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
  })

  it('handles MongoServerError with duplicate key (11000) -> DOCUMENT_ALREADY_EXISTS', () => {

    const uniqueFields = ['email']
    getUniqueFields.mockReturnValue(uniqueFields)

    const err = {
      name: 'MongoServerError',
      message: 'E11000 duplicate key error collection: test.users index: email_1 dup key: { : "a@a.com" }',
      code: 11000
    }

    errorMiddleware(err, null, res, null)

    expect(logger.error).toHaveBeenCalledWith(err)
    expect(getUniqueFields).toHaveBeenCalledWith(err.message)
    expect(res.status).toHaveBeenCalledWith(409)

    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.status).toBe(409)
    const expected = errors.DOCUMENT_ALREADY_EXISTS(uniqueFields)
    expect(jsonArg.code).toBe(expected.code)
    expect(jsonArg.message).toBe(expected.message)
  })

  it('handles MongoServerError with other code -> MONGO_SERVER_ERROR 500', () => {
    const err = { name: 'MongoServerError', message: 'some server issue', code: 123 }

    errorMiddleware(err, null, res, null)

    expect(logger.error).toHaveBeenCalledWith(err)
    expect(res.status).toHaveBeenCalledWith(500)

    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.status).toBe(500)
    const expected = errors.MONGO_SERVER_ERROR(err.message)
    expect(jsonArg.code).toBe(expected.code)
    expect(jsonArg.message).toBe(expected.message)
  })

  it('handles ValidationError -> VALIDATION_ERROR 409', () => {
    const message = 'validation failed'
    const err = { name: 'ValidationError', message }

    errorMiddleware(err, null, res, null)

    expect(logger.error).toHaveBeenCalledWith(err)
    expect(res.status).toHaveBeenCalledWith(409)

    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.status).toBe(409)
    const expected = errors.VALIDATION_ERROR(message)
    expect(jsonArg.code).toBe(expected.code)
    expect(jsonArg.message).toBe(expected.message)
  })

  it('handles generic error without status and code -> INTERNAL_SERVER_ERROR 500', () => {
    const err = { name: 'SomeError', message: 'boom' }

    errorMiddleware(err, null, res, null)

    expect(logger.error).toHaveBeenCalledWith(err)
    expect(res.status).toHaveBeenCalledWith(500)

    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.status).toBe(500)
    expect(jsonArg.code).toBe(errors.INTERNAL_SERVER_ERROR.code)
    expect(jsonArg.message).toBe(err.message)
  })

  it('passes through error with status and code', () => {
    const err = { status: 418, code: 'TEAPOT', message: "I'm a teapot", name: 'Teapot' }

    errorMiddleware(err, null, res, null)

    expect(logger.error).toHaveBeenCalledWith(err)
    expect(res.status).toHaveBeenCalledWith(418)

    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.status).toBe(418)
    expect(jsonArg.code).toBe('TEAPOT')
    expect(jsonArg.message).toBe("I'm a teapot")
  })
})
