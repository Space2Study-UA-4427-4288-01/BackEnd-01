const { serverInit, serverCleanup, stopServer } = require('~/test/setup')
const questionService = require('~/services/question')
const userService = require('~/services/user')
const Question = require('~/models/question')
const ResourcesCategory = require('~/models/resourcesCategory')
const mongoose = require('mongoose')
const { roles } = require('~/consts/auth')

const createAuthor = async (email = `${Math.random().toString(16).slice(2)}@mail.com`) => {
  const user = await userService.createUser(
    roles.STUDENT,
    'Autor',
    'Test',
    email,
    'StrongPass1',
    'en',
    true
  )
  return user
}

const createCategory = async (authorId, name = 'General Category') => {
  return await ResourcesCategory.create({ name, author: authorId })
}

describe('questionService integration', () => {
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

  describe('createQuestion', () => {
    it('creates question and populates category', async () => {
      const author = await createAuthor()
      const category = await createCategory(author._id)

      const data = {
        title: 'Sample Question',
        text: 'What is 2 + 2?',
        answers: [
          { text: '3', isCorrect: false },
          { text: '4', isCorrect: true }
        ],
        type: 'oneAnswer',
        category: category._id
      }

      const created = await questionService.createQuestion(author._id, data)
      expect(created).toMatchObject({
        title: data.title,
        text: data.text,
        type: data.type,
        category: { _id: category._id, name: category.name }
      })
      expect(created.answers).toHaveLength(2)
    })
  })

  describe('getQuestionById', () => {
    it('returns question by id', async () => {
      const author = await createAuthor()
      const q = await Question.create({
        title: 'Title',
        text: 'Body',
        answers: [{ text: 'Yes', isCorrect: true }],
        type: 'oneAnswer',
        author: author._id
      })

      const found = await questionService.getQuestionById(q._id)
      expect(found.title).toBe('Title')
    })
  })

  describe('updateQuestion', () => {
    it('updates question fields when author matches', async () => {
      const author = await createAuthor()
      const q = await Question.create({
        title: 'Old',
        text: 'Old text',
        answers: [{ text: 'A', isCorrect: true }],
        type: 'oneAnswer',
        author: author._id
      })

      const updated = await questionService.updateQuestion(q._id, author._id.toString(), {
        title: 'New Title',
        text: 'New Body'
      })
      expect(updated.title).toBe('New Title')
      expect(updated.text).toBe('New Body')
    })

    it('throws forbidden when non-author tries to update', async () => {
      const author = await createAuthor('auth1@example.com')
      const other = await createAuthor('auth2@example.com')
      const q = await Question.create({
        title: 'Owned',
        text: 'Owned text',
        answers: [{ text: 'A', isCorrect: true }],
        type: 'oneAnswer',
        author: author._id
      })

      await expect(
        questionService.updateQuestion(q._id, other._id.toString(), { title: 'Hack' })
      ).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('deleteQuestion', () => {
    it('deletes question when author correct', async () => {
      const author = await createAuthor()
      const q = await Question.create({
        title: 'Del',
        text: 'Del text',
        answers: [{ text: 'B', isCorrect: true }],
        type: 'oneAnswer',
        author: author._id
      })

      await questionService.deleteQuestion(q._id, author._id.toString())
      const still = await Question.findById(q._id)
      expect(still).toBeNull()
    })

    it('throws forbidden when non-author deletes', async () => {
      const author = await createAuthor('dela@example.com')
      const other = await createAuthor('delb@example.com')
      const q = await Question.create({
        title: 'Keep',
        text: 'Keep text',
        answers: [{ text: 'B', isCorrect: true }],
        type: 'oneAnswer',
        author: author._id
      })

      await expect(
        questionService.deleteQuestion(q._id, other._id.toString())
      ).rejects.toMatchObject({ status: 403 })
      const exists = await Question.findById(q._id)
      expect(exists).not.toBeNull()
    })
  })

  describe('getQuestions', () => {
    it('returns paginated questions with count and sorting', async () => {
      const author = await createAuthor()
      const category = await createCategory(author._id, 'Cat1')
      const base = {
        answers: [{ text: 'Ans', isCorrect: true }],
        type: 'oneAnswer',
        author: author._id,
        category: category._id
      }
      await Question.create([
        { ...base, title: 'B title', text: 'b text' },
        { ...base, title: 'A title', text: 'a text' },
        { ...base, title: 'C title', text: 'c text' }
      ])

      const { items, count } = await questionService.getQuestions({}, { title: 1 }, 1, 2)
      expect(count).toBe(3)
      expect(items).toHaveLength(2)
      expect(items[0].title <= items[1].title).toBe(true)
    })
  })
})
