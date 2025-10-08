const mongoose = require('mongoose')
const offerService = require('~/services/offer')
const Offer = require('~/models/offer')

jest.mock('~/models/offer')

describe('Offer Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create new offer', async () => {
    const authorId = new mongoose.Types.ObjectId()
    const authorRole = 'tutor'
    const data = {
      price: 50,
      proficiencyLevel: 'Intermediate',
      title: 'Physics Lessons',
      description: 'I teach physics',
      languages: ['English'],
      subject: new mongoose.Types.ObjectId(),
      category: new mongoose.Types.ObjectId(),
      status: 'active',
      FAQ: [{ question: 'How long?', answer: '1 hour' }]
    }

    const created = { _id: new mongoose.Types.ObjectId(), author: authorId, authorRole, ...data }

    Offer.create = jest.fn().mockResolvedValue(created)

    const result = await offerService.createOffer(authorId, authorRole, data)

    expect(Offer.create).toHaveBeenCalledWith({
      author: authorId,
      authorRole,
      price: data.price,
      proficiencyLevel: data.proficiencyLevel,
      title: data.title,
      description: data.description,
      languages: data.languages,
      subject: data.subject,
      category: data.category,
      status: data.status,
      FAQ: data.FAQ
    })

    expect(result).toEqual(created)
  })

  it('should get all offers', async () => {
    const pipeline = [{ $match: { status: 'active' } }]
    const aggregated = {
      offers: [
        { _id: new mongoose.Types.ObjectId(), title: 'A' },
        { _id: new mongoose.Types.ObjectId(), title: 'B' }
      ],
      count: 2
    }

    const exec = jest.fn().mockResolvedValue([aggregated])
    Offer.aggregate = jest.fn().mockReturnValue({ exec })

    const result = await offerService.getOffers(pipeline)

    expect(Offer.aggregate).toHaveBeenCalledWith(pipeline)
    expect(exec).toHaveBeenCalled()
    expect(result).toEqual(aggregated)
  })

  it('should get an offer by ID', async () => {
    const id = new mongoose.Types.ObjectId()
    const docFromDb = {
      _id: id,
      title: 'Tutoring',
      authorRole: 'tutor',
      author: {
        FAQ: { tutor: [{ question: 'Q', answer: 'A' }], student: [] }
      },
      subject: { name: 'Math' },
      category: { appearance: 'blue' }
    }

    const exec = jest.fn().mockResolvedValue(docFromDb)
    const lean = jest.fn().mockReturnValue({ exec })
    const populate = jest.fn().mockReturnValue({ lean })
    Offer.findById = jest.fn().mockReturnValue({ populate })

    const result = await offerService.getOfferById(id)

    expect(Offer.findById).toHaveBeenCalledWith(id)
    expect(populate).toHaveBeenCalled()
    expect(lean).toHaveBeenCalled()
    expect(exec).toHaveBeenCalled()

    expect(result.author.FAQ).toEqual([{ question: 'Q', answer: 'A' }])
  })

  it('should throw Document not found', async () => {
    const id = new mongoose.Types.ObjectId()
    const exec = jest.fn().mockResolvedValue(null)
    const lean = jest.fn().mockReturnValue({ exec })
    const populate = jest.fn().mockReturnValue({ lean })
    Offer.findById = jest.fn().mockReturnValue({ populate })

    await expect(offerService.getOfferById(id)).rejects.toThrow()

    expect(Offer.findById).toHaveBeenCalledWith(id)
  })

  it('should delete offer by ID', async () => {
    const id = new mongoose.Types.ObjectId()
    const exec = jest.fn().mockResolvedValue({ _id: id })
    Offer.findByIdAndRemove = jest.fn().mockReturnValue({ exec })

    await expect(offerService.deleteOffer(id)).resolves.toBeUndefined()

    expect(Offer.findByIdAndRemove).toHaveBeenCalledWith(id)
    expect(exec).toHaveBeenCalled()
  })
})
