const { createError } = require('~/utils/errorsHelper')
const { BODY_IS_NOT_DEFINED } = require('~/consts/errors')
const validationMiddleware = require('~/middlewares/validation')
const validationHelper = require('~/utils/validationHelper')

jest.mock('~/utils/errorsHelper')
jest.mock('~/utils/validationHelper')

describe('validationMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should throw 422 when body is not provided', () => {
    const schema = {}
    const middleware = validationMiddleware(schema)
    const req = { body: null }

    const fakeError = new Error(BODY_IS_NOT_DEFINED)
    createError.mockReturnValue(fakeError)

    expect(() => middleware(req, null, jest.fn())).toThrow(fakeError)
    expect(createError).toHaveBeenCalled()
  })

  it('should validate required fields and call validate functions when body has fields', () => {
    const schema = {
      name: { required: true, type: 'string' },
      age: {required: false, type: 'number'}
    }
    const middleware = validationMiddleware(schema)

    const req = { body: { name: 'John', age: 35 } }
    const next = jest.fn()

    jest.spyOn(validationHelper, 'validateRequired').mockImplementation(() => {})
    jest.spyOn(validationHelper.validateFunc, 'type').mockImplementation(() => {})

    middleware(req, null, next)

    expect(validationHelper.validateRequired).toHaveBeenCalledWith('name', true, 'John')
    expect(validationHelper.validateFunc.type).toHaveBeenCalledWith('name', 'string', 'John')
    expect(next).toHaveBeenCalled()
  })

  it('should skip validateFunc when field value is falsy', () => {
    const schema = { name: { required: false, type: 'string' } }
    const middleware = validationMiddleware(schema)

    const req = { body: { name: '' } }
    const next = jest.fn()

    jest.spyOn(validationHelper, 'validateRequired').mockImplementation(() => {})
    jest.spyOn(validationHelper.validateFunc, 'type').mockImplementation(() => {})

    middleware(req, null, next)

    expect(validationHelper.validateRequired).toHaveBeenCalledWith('name', false, '')
    expect(validationHelper.validateFunc.type).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })
})
