import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals'
import { getPayload } from '../../../payload'
import { Payload } from 'payload'

describe('Accounts Collection', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  afterAll(async () => {
    if (payload) {
      await payload.delete({
        collection: 'accounts',
        where: {}
      })
      await payload.delete({
        collection: 'firms',
        where: {}
      })
    }
  })

  beforeEach(async () => {
    if (payload) {
      await payload.delete({
        collection: 'accounts',
        where: {}
      })
      await payload.delete({
        collection: 'firms',
        where: {}
      })
    }
  })

  describe('Account Creation', () => {
    it('should create a regular account', async () => {
      const firm = await payload.create({
        collection: 'firms',
        data: {
          firmId: 999,
          name: 'Test Firm',
          active: true
        }
      })

      const account = await payload.create({
        collection: 'accounts',
        data: {
          accountNumber: 1001,
          name: 'Test Account',
          firm: firm.id,
          isCentralAccount: false
        }
      })

      expect(account).toBeDefined()
      expect(account.accountNumber).toBe(1001)
      expect(account.firm).toBe(firm.id)
      expect(account.isCentralAccount).toBe(false)
      expect(account.parentAccount).toBeUndefined()
    })

    it('should create a central account', async () => {
      const firm = await payload.create({
        collection: 'firms',
        data: {
          firmId: 998,
          name: 'Test Firm 2',
          active: true
        }
      })

      const account = await payload.create({
        collection: 'accounts',
        data: {
          accountNumber: 1002,
          name: 'Central Account',
          firm: firm.id,
          isCentralAccount: true
        }
      })

      expect(account).toBeDefined()
      expect(account.accountNumber).toBe(1002)
      expect(account.firm).toBe(firm.id)
      expect(account.isCentralAccount).toBe(true)
      expect(account.parentAccount).toBeUndefined()
    })

    it('should not allow a sub-account to be a central account', async () => {
      const firm = await payload.create({
        collection: 'firms',
        data: {
          firmId: 996,
          name: 'Test Firm 4',
          active: true
        }
      })

      const centralAccount = await payload.create({
        collection: 'accounts',
        data: {
          accountNumber: 'ACC008',
          name: 'Central Account',
          firm: firm.id,
          isCentralAccount: true
        }
      })

      try {
        await payload.create({
          collection: 'accounts',
          data: {
            accountNumber: 'ACC009',
            name: 'Invalid Sub Account',
            firm: firm.id,
            isCentralAccount: true,
            parentAccount: centralAccount.id
          }
        })
        fail('Should not allow a sub-account to be a central account')
      } catch (error) {
        expect((error as Error).message).toBe('A sub-account cannot be a central account')
      }
    })

    it('should create a sub-account linked to central account', async () => {
      const firm = await payload.create({
        collection: 'firms',
        data: {
          firmId: 997,
          name: 'Test Firm 3',
          active: true
        }
      })

      const centralAccount = await payload.create({
        collection: 'accounts',
        data: {
          accountNumber: 'ACC003',
          name: 'Central Account',
          firm: firm.id,
          isCentralAccount: true
        }
      })

      const subAccount = await payload.create({
        collection: 'accounts',
        data: {
          accountNumber: 'ACC004',
          name: 'Sub Account',
          firm: firm.id,
          isCentralAccount: false,
          parentAccount: centralAccount.id
        }
      })

      expect(subAccount).toBeDefined()
      expect(subAccount.accountNumber).toBe('ACC004')
      expect(subAccount.firm).toBe(firm.id)
      expect(subAccount.isCentralAccount).toBe(false)
      expect(subAccount.parentAccount).toBe(centralAccount.id)
    })

    it('should not allow duplicate account numbers within the same firm', async () => {
      const firm = await payload.create({
        collection: 'firms',
        data: {
          firmId: 998,
          name: 'Test Firm 2',
          active: true
        }
      })

      await payload.create({
        collection: 'accounts',
        data: {
          accountNumber: 'ACC005',
          name: 'First Account',
          firm: firm.id,
          isCentralAccount: false
        }
      })

      try {
        await payload.create({
          collection: 'accounts',
          data: {
            accountNumber: 'ACC005',
            name: 'Duplicate Account',
            firm: firm.id,
            isCentralAccount: false
          }
        })
        fail('Should not allow duplicate account numbers within the same firm')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should allow same account number in different firms', async () => {
      const firm1 = await payload.create({
        collection: 'firms',
        data: {
          firmId: 997,
          name: 'Test Firm 3',
          active: true
        }
      })

      const firm2 = await payload.create({
        collection: 'firms',
        data: {
          firmId: 996,
          name: 'Test Firm 4',
          active: true
        }
      })

      await payload.create({
        collection: 'accounts',
        data: {
          accountNumber: 'ACC006',
          name: 'First Account',
          firm: firm1.id,
          isCentralAccount: false
        }
      })

      const account2 = await payload.create({
        collection: 'accounts',
        data: {
          accountNumber: 'ACC006',
          name: 'Second Account',
          firm: firm2.id,
          isCentralAccount: false
        }
      })

      expect(account2).toBeDefined()
      expect(account2.accountNumber).toBe('ACC006')
      expect(account2.firm).toBe(firm2.id)
      expect(account2.isCentralAccount).toBe(false)
    })
  })

  describe('Account Relationships', () => {
    it('should properly link accounts to firms', async () => {
      const firm = await payload.create({
        collection: 'firms',
        data: {
          firmId: 996,
          name: 'Test Firm 4',
          active: true
        }
      })

      const account = await payload.create({
        collection: 'accounts',
        data: {
          accountNumber: 'ACC007',
          name: 'Test Account 2',
          firm: firm.id,
          isCentralAccount: false
        }
      })

      const retrievedFirm = await payload.findByID({
        collection: 'firms',
        id: firm.id,
        depth: 1
      })

      expect(retrievedFirm.accounts).toBeDefined()
      expect(retrievedFirm.accounts).toContainEqual(expect.objectContaining({
        id: account.id
      }))
    })
  })
})
