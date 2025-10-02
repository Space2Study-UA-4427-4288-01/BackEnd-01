require('~/initialization/envSetup')
const idValidation = require('~/middlewares/idValidation')
const { INVALID_ID } = require('~/consts/errors')
const { default: mongoose } = require('mongoose')
const { createError } = require('~/utils/errorsHelper')

describe('idValidation middleware', () => {
  let req, res, next
  beforeEach(() => {
    req = {}
    res = {}
    next = jest.fn()
  })

  it('Should throw INVALID_ID error when id is invalid', () => {
    const invalidId = ''
    const expectedError = createError(400, INVALID_ID)

    const middlewareFunc = () => idValidation(req, res, next, invalidId)

    expect(middlewareFunc).toThrowError(
      expect.objectContaining({
        message: expectedError.message,
        status: expectedError.status,
        code: expectedError.code
      })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('Should call next when id is valid', () => {
    const validId = new mongoose.Types.ObjectId().toString()

    idValidation(req, res, next, validId)

    expect(next).toHaveBeenCalled()
  })
})
