const { serverInit, serverCleanup, stopServer } = require('~/test/setup')
const userService = require('~/services/user')
const User = require('~/models/user')
const { ALREADY_REGISTERED, DOCUMENT_NOT_FOUND } = require('~/consts/errors')
const mongoose = require('mongoose')
const { roles } = require('~/consts/auth')

const createRawUser = async (overrides = {}) => {
    const base = {
        role: [roles.STUDENT],
        firstName: 'John',
        lastName: 'Doe',
        email: `${Math.random().toString(16).slice(2)}@mail.com`,
        password: 'Password123',
        appLanguage: 'en',
        isEmailConfirmed: true,
        lastLoginAs: 'student'
    }
    return await User.create({ ...base, ...overrides })
}

describe('userService integration', () => {
    let app, server

    beforeAll(async () => {
        ; ({ app, server } = await serverInit())
    })

    afterEach(async () => {
        await serverCleanup()
    })

    afterAll(async () => {
        await stopServer(server)
    })

    describe('createUser', () => {
        it('creates user successfully', async () => {
            const created = await userService.createUser(
                roles.STUDENT,
                'Alice',
                'Wonder',
                'alice@example.com',
                'StrongPass1',
                'en',
                true
            )

            expect(created).toMatchObject({
                email: 'alice@example.com',
                role: [roles.STUDENT],
                firstName: 'Alice',
                lastName: 'Wonder',
                isEmailConfirmed: true
            })
            const inDb = await User.findOne({ email: 'alice@example.com' }).lean()
            expect(inDb).toBeTruthy()
        })

        it('throws ALREADY_REGISTERED when duplicate email', async () => {
            await userService.createUser(
                roles.STUDENT,
                'Bob',
                'Marley',
                'bob@example.com',
                'StrongPass1',
                'en',
                true
            )
            await expect(
                userService.createUser(
                    [roles.STUDENT],
                    'Bobby',
                    'Marley',
                    'bob@example.com',
                    'StrongPass1',
                    'en',
                    true
                )
            ).rejects.toMatchObject({ code: ALREADY_REGISTERED.code, status: 409 })
        })
    })

    describe('getUserByEmail / getUserById', () => {
        it('returns null when user not found by email', async () => {
            const user = await userService.getUserByEmail('absent@example.com')
            expect(user).toBeNull()
        })

        it('finds user by email and id with selected fields', async () => {
            const created = await userService.createUser(
                roles.STUDENT,
                'Clark',
                'Kent',
                'clark@example.com',
                'StrongPass1',
                'en',
                true
            )
            const byEmail = await userService.getUserByEmail('clark@example.com')
            expect(byEmail).toMatchObject({ email: 'clark@example.com', firstName: 'Clark', lastName: 'Kent' })

            const byId = await userService.getUserById(created._id, null)
            expect(byId).toMatchObject({ firstName: 'Clark', lastName: 'Kent' })
        })
    })

    describe('updateUser', () => {
        it('updates allowed fields and merges mainSubjects per role', async () => {
            const tutorSubject = new mongoose.Types.ObjectId()

            const created = await createRawUser({
                role: [roles.STUDENT, roles.TUTOR],
                lastLoginAs: roles.STUDENT,
                mainSubjects: {
                    tutor: [tutorSubject],
                    student: []
                }
            })

            const studentSubjects = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()]
            await userService.updateUser(created._id, 'student', {
                firstName: 'EvaUpdated',
                mainSubjects: studentSubjects,
                password: 'ShouldBeIgnored'
            })

            const updated = await User.findById(created._id).select('+password').lean().exec()
            expect(updated.firstName).toBe('EvaUpdated')

            expect(updated.password).toBeDefined()
            expect(updated.mainSubjects.student.map(String)).toEqual(studentSubjects.map(String))
            expect(updated.mainSubjects.tutor).toHaveLength(1)
        })

        it('throws DOCUMENT_NOT_FOUND for non existing user', async () => {
            const fakeId = new mongoose.Types.ObjectId()
            await expect(
                userService.updateUser(fakeId, 'student', { firstName: 'Nope' })
            ).rejects.toMatchObject({ code: DOCUMENT_NOT_FOUND([User.modelName]).code, status: 404 })
        })
    })

    describe('privateUpdateUser', () => {
        it('updates directly and throws when user not found', async () => {
            const created = await createRawUser()
            await userService.privateUpdateUser(created._id, { lastName: 'Changed' })
            const updated = await User.findById(created._id).lean()
            expect(updated.lastName).toBe('Changed')

            const fakeId = new mongoose.Types.ObjectId()
            await expect(userService.privateUpdateUser(fakeId, { lastName: 'X' })).rejects.toMatchObject({
                code: DOCUMENT_NOT_FOUND([User.modelName]).code,
                status: 404
            })
        })
    })

    describe('updateStatus', () => {
        it('updates nested status fields', async () => {
            const created = await createRawUser({ role: [roles.STUDENT, roles.TUTOR] })
            await userService.updateStatus(created._id, { student: 'blocked', tutor: 'active' })
            const updated = await User.findById(created._id).lean()
            expect(updated.status.student).toBe('blocked')
            expect(updated.status.tutor).toBe('active')
        })

        it('throws DOCUMENT_NOT_FOUND when user absent', async () => {
            const fakeId = new mongoose.Types.ObjectId()
            await expect(userService.updateStatus(fakeId, { student: 'blocked' })).rejects.toMatchObject({
                code: DOCUMENT_NOT_FOUND([User.modelName]).code,
                status: 404
            })
        })
    })

    describe('getUsers', () => {
        it('returns paginated users list with count', async () => {
            await Promise.all([
                createRawUser({ email: 'a@example.com', firstName: 'A' }),
                createRawUser({ email: 'b@example.com', firstName: 'B' }),
                createRawUser({ email: 'c@example.com', firstName: 'C' })
            ])

            const { items, count } = await userService.getUsers({
                match: {},
                sort: { firstName: 1 },
                skip: 1,
                limit: 2
            })

            expect(count).toBe(3)
            expect(items).toHaveLength(2)
            const firstNames = items.map((u) => u.firstName)
            expect(firstNames).toEqual(['B', 'C'])
        })
    })

    describe('deleteUser', () => {
        it('removes user', async () => {
            const created = await createRawUser({ email: 'delete@example.com' })
            await userService.deleteUser(created._id)
            const inDb = await User.findById(created._id)
            expect(inDb).toBeNull()
        })
    })
})

