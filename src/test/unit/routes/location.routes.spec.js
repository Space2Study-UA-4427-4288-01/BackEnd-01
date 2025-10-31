const express = require('express')
const request = require('supertest')

// Mock auth middleware to pass-through but let us assert calls
jest.mock('~/middlewares/auth', () => {
	const mockAuth = jest.fn((req, res, next) => next())
	return { authMiddleware: mockAuth }
})

// Mock controllers to assert they are hit and send stub responses
jest.mock('~/controllers/location', () => {
	return {
		getCountries: jest.fn((req, res) => res.status(200).json([{ iso2: 'UA', name: 'Ukraine' }])),
		getCitiesByCountryId: jest.fn((req, res) => res.status(200).json([{ name: 'Kyiv' }]))
	}
})

const locationRouter = require('~/routes/location')

const createApp = () => {
	const app = express()
	app.use('/locations', locationRouter)
	return app
}

describe('location routes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

	it('applies authMiddleware to routes', async () => {
		const app = createApp()
		const { authMiddleware } = require('~/middlewares/auth')
		await request(app).get('/locations/countries').expect(200)
		await request(app).get('/locations/cities/UA').expect(200)
		// Called for each route
		expect(authMiddleware).toHaveBeenCalledTimes(2)
	})

	it('GET /locations/countries calls controller.getCountries and returns data', async () => {
		const app = createApp()
		const res = await request(app).get('/locations/countries').expect(200)
		const ctrl = require('~/controllers/location')
		expect(ctrl.getCountries).toHaveBeenCalledTimes(1)
		expect(res.body).toEqual([{ iso2: 'UA', name: 'Ukraine' }])
	})

	it('GET /locations/cities/:id calls controller.getCitiesByCountryId with req.params.id', async () => {
		const app = createApp()
		const res = await request(app).get('/locations/cities/UA').expect(200)
		const ctrl = require('~/controllers/location')
		expect(ctrl.getCitiesByCountryId).toHaveBeenCalledTimes(1)
		const reqArg = ctrl.getCitiesByCountryId.mock.calls[0][0]
		expect(reqArg.params.id).toBe('UA')
		expect(res.body).toEqual([{ name: 'Kyiv' }])
	})

	it('GET /locations/cities?id=UA does not match :id route (404)', async () => {
		const app = createApp()
		const res = await request(app).get('/locations/cities?id=UA')
		expect(res.status).toBe(404)
		const ctrl = require('~/controllers/location')
		expect(ctrl.getCitiesByCountryId).not.toHaveBeenCalled()
	})
    
})

