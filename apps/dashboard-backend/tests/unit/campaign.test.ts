import { CampaignsRepository } from '../../src/features/campaign/repository';
import {
  CampaignsUseCase,
  generateSlotsForSchedule,
  getTimePeriodForHour,
} from '../../src/features/campaign/usecase';
import { CampaignsController } from '../../src/features/campaign/controller';
import { initializeCampaignsModule } from '../../src/features/campaign';
import { CampaignDoc, CampaignDocWithId } from '@rebecca/types';
import { createMockFirestore } from './testUtils';
import { Request, Response } from 'express';

const mockSave = jest.fn().mockResolvedValue(undefined);
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        save: mockSave,
      }),
    }),
  })),
}));

describe('Campaigns Feature Unit Tests (Dashboard Backend)', () => {
  let mock: ReturnType<typeof createMockFirestore>;

  const sampleCampaign: CampaignDoc = {
    title: 'Kyoto Autumn 2026',
    description: 'Momiji viewing event in Kyoto',
    status: 'scheduled',
    isPaused: false,
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    dailySlotTimes: ['08:00', '12:00', '19:00'],
    masterContext: 'Rebecca traveling through Arashiyama and Gion.',
    replyContextSummary: 'Rebecca is wearing a kimono in Kyoto.',
    slots: [
      {
        slotId: 'slot-1-0800',
        dayNumber: 1,
        timePeriod: 'morning',
        scheduledTime: '2026-11-01T08:00:00Z',
        theme: 'Togetsukyo Bridge',
        status: 'pending',
      },
      {
        slotId: 'slot-1-1200',
        dayNumber: 1,
        timePeriod: 'afternoon',
        scheduledTime: '2026-11-01T12:00:00Z',
        theme: 'Bamboo Forest',
        status: 'pending',
      },
    ],
    totalSlotsCount: 2,
    completedSlotsCount: 0,
    isAnnualRecurring: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockFirestore();
  });

  describe('Slot Generation Helpers', () => {
    it('getTimePeriodForHour should map time strings correctly', () => {
      expect(getTimePeriodForHour('08:00')).toBe('morning');
      expect(getTimePeriodForHour('12:30')).toBe('afternoon');
      expect(getTimePeriodForHour('17:00')).toBe('evening');
      expect(getTimePeriodForHour('19:00')).toBe('night');
      expect(getTimePeriodForHour('21:00')).toBe('night');
      expect(getTimePeriodForHour('23:00')).toBe('night');
      expect(getTimePeriodForHour('02:00')).toBe('night');
    });

    it('generateSlotsForSchedule should generate slots for multi-day date range', () => {
      const slots = generateSlotsForSchedule('2026-07-01', '2026-07-02', ['09:00', '18:00']);
      expect(slots).toHaveLength(4);
      expect(slots[0]).toEqual({
        slotId: 'slot-1-0900',
        dayNumber: 1,
        timePeriod: 'morning',
        scheduledTime: '2026-07-01T09:00:00Z',
        theme: 'Day 1 Morning',
        status: 'pending',
      });
      expect(slots[1].dayNumber).toBe(1);
      expect(slots[1].timePeriod).toBe('evening');
      expect(slots[2].dayNumber).toBe(2);
      expect(slots[2].timePeriod).toBe('morning');
      expect(slots[3].dayNumber).toBe(2);
      expect(slots[3].timePeriod).toBe('evening');
    });

    it('generateSlotsForSchedule should throw if dates are invalid', () => {
      expect(() => generateSlotsForSchedule('invalid', 'dates', ['08:00'])).toThrow('Dates must be in YYYY-MM-DD format.');
      expect(() => generateSlotsForSchedule('2026-07-05', '2026-07-01', ['08:00'])).toThrow('startDate cannot be after endDate.');
    });
  });

  describe('CampaignsRepository', () => {
    let repo: CampaignsRepository;

    beforeEach(() => {
      repo = new CampaignsRepository(mock.firestore);
    });

    it('getPaginated should return paginated campaign documents with sorting', async () => {
      const mockDocs = [
        {
          id: 'camp_2',
          data: () => ({ ...sampleCampaign, title: 'Later Campaign', startDate: '2026-12-01' }),
        },
        {
          id: 'camp_1',
          data: () => ({ ...sampleCampaign, title: 'Earlier Campaign', startDate: '2026-10-01' }),
        },
      ];

      const coll = mock.firestore.collection('campaigns');
      coll.get.mockResolvedValue({ docs: mockDocs, empty: false });

      const res = await repo.getPaginated({ page: 1, limit: 10 });
      expect(res.data).toHaveLength(2);
      expect(res.data[0].id).toBe('camp_2'); // Later startDate sorted first
      expect(res.data[1].id).toBe('camp_1');
      expect(res.meta.totalItems).toBe(2);
      expect(res.meta.totalPages).toBe(1);
      expect(res.meta.currentPage).toBe(1);
    });

    it('getById should return single campaign or null', async () => {
      const coll = mock.firestore.collection('campaigns');
      const docObj = coll.doc('camp_1');

      docObj.get.mockResolvedValueOnce({
        exists: true,
        id: 'camp_1',
        data: () => sampleCampaign,
      });

      const found = await repo.getById('camp_1');
      expect(found).not.toBeNull();
      expect(found?.title).toBe('Kyoto Autumn 2026');

      docObj.get.mockResolvedValueOnce({ exists: false });
      const notFound = await repo.getById('non_existent');
      expect(notFound).toBeNull();
    });

    it('findOverlapping should detect overlapping active/scheduled campaigns', async () => {
      const coll = mock.firestore.collection('campaigns');
      coll.get.mockResolvedValue({
        docs: [
          {
            id: 'camp_existing',
            data: () => ({
              ...sampleCampaign,
              startDate: '2026-11-01',
              endDate: '2026-11-05',
              status: 'scheduled',
            }),
          },
          {
            id: 'camp_archived',
            data: () => ({
              ...sampleCampaign,
              startDate: '2026-11-01',
              endDate: '2026-11-05',
              status: 'archived',
            }),
          },
        ],
      });

      // Overlapping window
      const overlap = await repo.findOverlapping('2026-11-03', '2026-11-07');
      expect(overlap).toHaveLength(1);
      expect(overlap[0].id).toBe('camp_existing');

      // Non-overlapping window
      const noOverlap = await repo.findOverlapping('2026-11-10', '2026-11-15');
      expect(noOverlap).toHaveLength(0);

      // Exclude self during update
      const excluded = await repo.findOverlapping('2026-11-03', '2026-11-07', 'camp_existing');
      expect(excluded).toHaveLength(0);
    });

    it('getPaginated should filter by status when provided', async () => {
      const coll = mock.firestore.collection('campaigns');
      coll.get.mockResolvedValue({ docs: [], empty: true });

      const res = await repo.getPaginated({ page: 1, limit: 10, status: 'scheduled' });
      expect(coll.where).toHaveBeenCalledWith('status', '==', 'scheduled');
      expect(res.data).toEqual([]);
    });

    it('update should throw if campaign not found after update', async () => {
      const coll = mock.firestore.collection('campaigns');
      const docObj = coll.doc('non_existent');
      docObj.get.mockResolvedValue({ exists: false });

      await expect(repo.update('non_existent', { title: 'New' })).rejects.toThrow(
        'Campaign non_existent not found after update',
      );
    });

    it('create should save and return created campaign', async () => {
      const coll = mock.firestore.collection('campaigns');
      const docObj = coll.doc('c_new');
      docObj.get.mockResolvedValue({ exists: true, id: 'c_new', data: () => sampleCampaign });

      const res = await repo.create('c_new', sampleCampaign);
      expect(res.id).toBe('c_new');
    });

    it('delete should remove document from collection', async () => {
      const coll = mock.firestore.collection('campaigns');
      const docObj = coll.doc('c_del');

      await repo.delete('c_del');
      expect(docObj.delete).toHaveBeenCalled();
    });
  });

  describe('CampaignsUseCase', () => {
    let repo: jest.Mocked<CampaignsRepository>;
    let useCase: CampaignsUseCase;

    beforeEach(() => {
      repo = {
        getPaginated: jest.fn(),
        getById: jest.fn(),
        findOverlapping: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any;
      useCase = new CampaignsUseCase(repo);
    });

    it('listCampaigns should delegate to repo.getPaginated', async () => {
      repo.getPaginated.mockResolvedValueOnce({
        data: [],
        meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 20 },
      });
      const res = await useCase.listCampaigns({ page: 1 });
      expect(repo.getPaginated).toHaveBeenCalledWith({ page: 1 });
      expect(res.data).toEqual([]);
    });

    it('getCampaign should delegate to repo.getById', async () => {
      repo.getById.mockResolvedValueOnce({ ...sampleCampaign, id: 'c1' });
      const res = await useCase.getCampaign('c1');
      expect(repo.getById).toHaveBeenCalledWith('c1');
      expect(res?.id).toBe('c1');
    });

    it('createCampaign should validate title and dates', async () => {
      await expect(useCase.createCampaign({ title: '' } as any)).rejects.toThrow('Campaign title is required');
      await expect(useCase.createCampaign({ title: 'Trip', startDate: '', endDate: '2026-12-01', dailySlotTimes: ['08:00'], status: 'draft' } as any)).rejects.toThrow('startDate and endDate must be valid dates in YYYY-MM-DD format.');
      await expect(
        useCase.createCampaign({ title: 'Trip', startDate: '2026-12-05', endDate: '2026-12-01', dailySlotTimes: ['08:00'], status: 'draft' } as any),
      ).rejects.toThrow('startDate cannot be after endDate');
    });

    it('createCampaign should reject overlapping dates with existing campaigns', async () => {
      repo.findOverlapping.mockResolvedValueOnce([
        { id: 'c1', title: 'Existing Event', startDate: '2026-07-01', endDate: '2026-07-05' } as any,
      ]);

      await expect(
        useCase.createCampaign({
          title: 'New Event',
          startDate: '2026-07-03',
          endDate: '2026-07-07',
          dailySlotTimes: ['08:00'],
          status: 'draft',
          masterContext: 'Ctx',
          replyContextSummary: 'Reply',
        }),
      ).rejects.toThrow('Campaign dates overlap with existing campaign: "Existing Event"');
    });

    it('createCampaign should auto-generate slots if not provided', async () => {
      repo.create.mockImplementation(async (id, data) => ({ ...data, id } as CampaignDocWithId));

      const created = await useCase.createCampaign({
        title: 'Summer Event',
        startDate: '2026-08-01',
        endDate: '2026-08-02',
        dailySlotTimes: ['08:00', '19:00'],
        status: 'draft',
        masterContext: 'Context',
        replyContextSummary: 'Reply summary',
      });

      expect(created.totalSlotsCount).toBe(4);
      expect(created.completedSlotsCount).toBe(0);
      expect(created.slots).toHaveLength(4);
      expect(repo.create).toHaveBeenCalled();
    });

    it('updateCampaign should reject invalid dates and overlapping dates', async () => {
      repo.getById.mockResolvedValueOnce({
        ...sampleCampaign,
        id: 'c1',
      } as CampaignDocWithId);

      await expect(
        useCase.updateCampaign('c1', { startDate: '2026-11-10', endDate: '2026-11-05' }),
      ).rejects.toThrow('startDate cannot be after endDate');

      repo.getById.mockResolvedValueOnce({
        ...sampleCampaign,
        id: 'c1',
      } as CampaignDocWithId);
      repo.findOverlapping.mockResolvedValueOnce([
        { id: 'c2', title: 'Clashing Event', startDate: '2026-11-05', endDate: '2026-11-10' } as any,
      ]);

      await expect(
        useCase.updateCampaign('c1', { startDate: '2026-11-05', endDate: '2026-11-12' }),
      ).rejects.toThrow('Updated dates overlap with existing campaign: "Clashing Event"');
    });

    it('updateCampaign should throw if campaign not found', async () => {
      repo.getById.mockResolvedValueOnce(null);
      await expect(useCase.updateCampaign('non_existent', { title: 'New' })).rejects.toThrow(
        'Campaign non_existent not found.',
      );
    });

    it('updateCampaign should update slots and recalculate counts', async () => {
      repo.getById.mockResolvedValueOnce({
        ...sampleCampaign,
        id: 'c1',
      } as CampaignDocWithId);
      repo.update.mockImplementation(async (id, data) => ({ ...sampleCampaign, id, ...data } as any));

      const updatedSlots = [
        {
          slotId: 'slot-1',
          dayNumber: 1,
          timePeriod: 'morning' as const,
          scheduledTime: '2026-11-01T08:00:00Z',
          theme: 'Arrival',
          status: 'posted' as const,
        },
        {
          slotId: 'slot-2',
          dayNumber: 1,
          timePeriod: 'evening' as const,
          scheduledTime: '2026-11-01T19:00:00Z',
          theme: 'Dinner',
          status: 'pending' as const,
        },
      ];

      const res = await useCase.updateCampaign('c1', { slots: updatedSlots });
      expect(res.totalSlotsCount).toBe(2);
      expect(res.completedSlotsCount).toBe(1);
    });

    it('cloneCampaign should duplicate campaign with draft status and reset slots', async () => {
      repo.getById.mockResolvedValueOnce({
        ...sampleCampaign,
        id: 'c1',
        slots: [
          {
            slotId: 'slot-1',
            dayNumber: 1,
            timePeriod: 'morning',
            scheduledTime: '2026-11-01T08:00:00Z',
            theme: 'Arrival',
            status: 'posted',
            postedTweetId: 'tweet_123',
            postedAt: '2026-11-01T08:00:05Z',
          },
        ],
      } as CampaignDocWithId);

      repo.create.mockImplementation(async (id, data) => ({ ...data, id } as CampaignDocWithId));

      const cloned = await useCase.cloneCampaign('c1', '2027-11-01', '2027-11-03');
      expect(cloned.title).toBe('Copy of Kyoto Autumn 2026');
      expect(cloned.status).toBe('draft');
      expect(cloned.startDate).toBe('2027-11-01');
      expect(cloned.slots[0].status).toBe('pending');
      expect(cloned.slots[0].postedTweetId).toBeUndefined();
    });

    it('cloneCampaign should throw if source not found', async () => {
      repo.getById.mockResolvedValueOnce(null);
      await expect(useCase.cloneCampaign('missing')).rejects.toThrow('Source campaign missing not found.');
    });

    it('pauseCampaign and resumeCampaign should update isPaused toggle', async () => {
      repo.getById.mockResolvedValue({ ...sampleCampaign, id: 'c1' });
      repo.update.mockImplementation(async (id, data) => ({ ...sampleCampaign, id, ...data } as any));

      const paused = await useCase.pauseCampaign('c1');
      expect(paused.isPaused).toBe(true);

      const resumed = await useCase.resumeCampaign('c1');
      expect(resumed.isPaused).toBe(false);
    });

    it('pauseCampaign and resumeCampaign should throw if campaign not found', async () => {
      repo.getById.mockResolvedValueOnce(null);
      await expect(useCase.pauseCampaign('missing')).rejects.toThrow('Campaign missing not found.');

      repo.getById.mockResolvedValueOnce(null);
      await expect(useCase.resumeCampaign('missing')).rejects.toThrow('Campaign missing not found.');
    });

    it('uploadCampaignAsset should save isolated file to GCS', async () => {
      repo.getById.mockResolvedValueOnce({
        ...sampleCampaign,
        id: 'c1',
      } as CampaignDocWithId);

      const res = await useCase.uploadCampaignAsset('c1', {
        originalname: 'temple.png',
        mimetype: 'image/png',
        buffer: Buffer.from('mock-bytes'),
      });

      expect(mockSave).toHaveBeenCalled();
      expect(res.url).toContain('campaigns/c1/');
      expect(res.filename).toContain('.png');
    });

    it('uploadCampaignAsset should throw if campaign not found', async () => {
      repo.getById.mockResolvedValueOnce(null);
      await expect(
        useCase.uploadCampaignAsset('missing', { originalname: 'a.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('a') }),
      ).rejects.toThrow('Campaign missing not found.');
    });

    it('deleteCampaign should invoke repo.delete', async () => {
      repo.getById.mockResolvedValueOnce({ ...sampleCampaign, id: 'c1' } as any);
      await useCase.deleteCampaign('c1');
      expect(repo.delete).toHaveBeenCalledWith('c1');
    });

    it('deleteCampaign should throw if campaign not found', async () => {
      repo.getById.mockResolvedValueOnce(null);
      await expect(useCase.deleteCampaign('missing')).rejects.toThrow('Campaign missing not found.');
    });
  });

  describe('CampaignsController', () => {
    let mockUseCase: jest.Mocked<CampaignsUseCase>;
    let controller: CampaignsController;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockUseCase = {
        listCampaigns: jest.fn(),
        getCampaign: jest.fn(),
        createCampaign: jest.fn(),
        updateCampaign: jest.fn(),
        cloneCampaign: jest.fn(),
        pauseCampaign: jest.fn(),
        resumeCampaign: jest.fn(),
        uploadCampaignAsset: jest.fn(),
        deleteCampaign: jest.fn(),
      } as any;
      controller = new CampaignsController(mockUseCase);
      mockReq = { query: {}, params: {}, body: {} };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('list should return 200 with paginated response', async () => {
      mockReq.query = { page: '1', limit: '20' };
      mockUseCase.listCampaigns.mockResolvedValueOnce({
        data: [{ ...sampleCampaign, id: 'c1' }],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 20 },
      });

      await controller.list(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Array) }));
    });

    it('getById should return 200 when found or 404 when missing', async () => {
      mockReq.params = { id: 'c1' };
      mockUseCase.getCampaign.mockResolvedValueOnce({ ...sampleCampaign, id: 'c1' });

      await controller.getById(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(200);

      mockUseCase.getCampaign.mockResolvedValueOnce(null);
      await controller.getById(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('create should return 201 on success or 400 on validation error', async () => {
      mockReq.body = { title: 'Event' };
      mockUseCase.createCampaign.mockResolvedValueOnce({ ...sampleCampaign, id: 'c1' });

      await controller.create(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(201);

      mockUseCase.createCampaign.mockRejectedValueOnce(new Error('Validation error: title is required'));
      await controller.create(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Validation error: title is required' });
    });

    it('list should handle errors securely and return 500 without leaking internal details', async () => {
      mockUseCase.listCampaigns.mockRejectedValueOnce(new Error('DB failure'));
      await controller.list(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('getById should handle errors securely and return 500', async () => {
      mockReq.params = { id: 'c1' };
      mockUseCase.getCampaign.mockRejectedValueOnce(new Error('Lookup failure'));
      await controller.getById(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('update should return 200 on success, 404 when not found, and 400 on validation error', async () => {
      mockReq.params = { id: 'c1' };
      mockReq.body = { title: 'Updated' };
      mockUseCase.updateCampaign.mockResolvedValueOnce({ ...sampleCampaign, id: 'c1', title: 'Updated' });

      await controller.update(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(200);

      mockUseCase.updateCampaign.mockRejectedValueOnce(new Error('Campaign c1 not found.'));
      await controller.update(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      mockUseCase.updateCampaign.mockRejectedValueOnce(new Error('Invalid dates: startDate cannot be after endDate'));
      await controller.update(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('clone should return 201 on success, 404 when not found, and 409 on overlap error', async () => {
      mockReq.params = { id: 'c1' };
      mockUseCase.cloneCampaign.mockResolvedValueOnce({ ...sampleCampaign, id: 'c2' });

      await controller.clone(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(201);

      mockUseCase.cloneCampaign.mockRejectedValueOnce(new Error('Source campaign c1 not found.'));
      await controller.clone(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      mockUseCase.cloneCampaign.mockRejectedValueOnce(new Error('Campaign dates overlap with existing campaign'));
      await controller.clone(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it('pause and resume should return 200 on success, 404 on not found, and 500 on server error', async () => {
      mockReq.params = { id: 'c1' };
      mockUseCase.pauseCampaign.mockResolvedValueOnce({ ...sampleCampaign, id: 'c1', isPaused: true });

      await controller.pause(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(200);

      mockUseCase.pauseCampaign.mockRejectedValueOnce(new Error('Campaign c1 not found'));
      await controller.pause(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      mockUseCase.pauseCampaign.mockRejectedValueOnce(new Error('GCS Error'));
      await controller.pause(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);

      mockUseCase.resumeCampaign.mockResolvedValueOnce({ ...sampleCampaign, id: 'c1', isPaused: false });
      await controller.resume(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(200);

      mockUseCase.resumeCampaign.mockRejectedValueOnce(new Error('Campaign c1 not found'));
      await controller.resume(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      mockUseCase.resumeCampaign.mockRejectedValueOnce(new Error('Server failure'));
      await controller.resume(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('uploadAsset should return 201 on success, 400 when missing file, 404 on not found, and 500 on unexpected error', async () => {
      mockReq.params = { id: 'c1' };

      // Missing file -> 400
      (mockReq as any).file = undefined;
      await controller.uploadAsset(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      // Success -> 201
      (mockReq as any).file = { originalname: 'pic.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('a') };
      mockUseCase.uploadCampaignAsset.mockResolvedValueOnce({
        url: 'https://storage.googleapis.com/test-bucket/campaigns/c1/pic.jpg',
        filename: 'pic.jpg',
      });
      await controller.uploadAsset(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(201);

      // Not found -> 404
      mockUseCase.uploadCampaignAsset.mockRejectedValueOnce(new Error('Campaign c1 not found.'));
      await controller.uploadAsset(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      // Storage failure -> 500
      mockUseCase.uploadCampaignAsset.mockRejectedValueOnce(new Error('Storage failure'));
      await controller.uploadAsset(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('delete should return 200 on success, 404 when not found, and 500 on server error', async () => {
      mockReq.params = { id: 'c1' };
      mockUseCase.deleteCampaign.mockResolvedValueOnce(undefined);

      await controller.delete(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Campaign deleted successfully.' });

      mockUseCase.deleteCampaign.mockRejectedValueOnce(new Error('Campaign c1 not found.'));
      await controller.delete(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      mockUseCase.deleteCampaign.mockRejectedValueOnce(new Error('Firestore delete failed'));
      await controller.delete(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('initializeCampaignsModule router factory', () => {
    it('should create express router with registered campaign routes', () => {
      const router = initializeCampaignsModule(mock.firestore);
      expect(router).toBeDefined();
      expect(router.stack.length).toBeGreaterThan(0);
    });
  });
});
