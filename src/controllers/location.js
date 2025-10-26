const locationService = require('../services/location')

const getCountries = async (req, res) => {
    const countries = await locationService.getCountries()

    res.status(200).json(countries)
}

const getCitiesByCountryId = async (req, res) => {
    const { id } = req.params
    const cities = await locationService.getCities(id)
    res.status(200).json(cities)
}

module.exports = {
    getCountries,
    getCitiesByCountryId
}