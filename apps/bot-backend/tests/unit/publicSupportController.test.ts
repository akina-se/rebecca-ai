import { PublicSupportController } from '../../src/features/support/publicController';
import config from '../../src/config';
import { createMockDeps } from './core/testUtils';
import { Request, Response } from 'express';
import Stripe from 'stripe';

describe('PublicSupportController Unit Tests', () => {
  let deps: any;
  let mockStripe: any;
  let controller: PublicSupportController;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createMockDeps();

    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn().mockReturnThis();
    res = {
      status: statusMock,
      json: jsonMock,
    };
    req = {
      query: {},
      headers: {},
      body: {},
    };

    mockStripe = {
      checkout: {
        sessions: {
          retrieve: jest.fn(),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };

    controller = new PublicSupportController(
      deps,
      {
        ...config.support,
        stripeWebhookSecret: 'whsec_test_secret',
        stripeSecretKey: 'sk_test_secret',
      },
      mockStripe as unknown as Stripe,
    );
  });

  describe('verifySession', () => {
    it('returns 400 if session_id is missing or not a string', async () => {
      req.query = {};
      await controller.verifySession(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Missing or invalid session_id query parameter' }),
      );
    });

    it('returns 404 if Stripe session cannot be found', async () => {
      req.query = { session_id: 'cs_unknown' };
      mockStripe.checkout.sessions.retrieve.mockRejectedValue(new Error('No such checkout session'));

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        valid: false,
        error: 'Checkout session not found',
      });
    });

    it('returns 403 Forbidden if session payment_status is not paid (Strict Guard)', async () => {
      req.query = { session_id: 'cs_unpaid_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_unpaid_123',
        payment_status: 'unpaid',
      });

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        valid: false,
        error: 'Payment has not been completed or verified.',
      });
      expect(deps.storage.generateSignedUrl).not.toHaveBeenCalled();
    });

    it('returns 200 with signed reward URL and transaction details when paid', async () => {
      req.query = { session_id: 'cs_paid_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_paid_123',
        payment_status: 'paid',
        amount_total: 1000,
      });

      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_paid_123',
        tier: 'silver',
        itemLabel: 'サーバーリソース差し入れ',
        safeName: 'アリス',
      });

      deps.firestore.getActiveRewardImage.mockResolvedValue({
        id: 'reward_2026_10',
        title: 'サポーター特典イラスト',
        storagePath: 'rewards/2026-10/halloween.png',
      });

      deps.storage.generateSignedUrl.mockResolvedValue('https://storage.googleapis.com/signed-url');

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(deps.storage.generateSignedUrl).toHaveBeenCalledWith('rewards/2026-10/halloween.png', 30);
      expect(deps.firestore.incrementRewardImageDistributedCount).toHaveBeenCalledWith('reward_2026_10');
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          tier: 'silver',
          itemLabel: 'サーバーリソース差し入れ',
          safeName: 'アリス',
          reward: expect.objectContaining({
            title: 'サポーター特典イラスト',
            imageUrl: 'https://storage.googleapis.com/signed-url',
          }),
        }),
      );
    });

    it('handles paid session gracefully when no active reward image exists', async () => {
      req.query = { session_id: 'cs_paid_no_img' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_paid_no_img',
        payment_status: 'paid',
        amount_total: 300,
      });

      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      deps.firestore.getActiveRewardImage.mockResolvedValue(null);

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          tier: 'bronze',
          itemLabel: 'エナドリ1本差し入れ',
          reward: null,
        }),
      );
    });

    it('returns 500 if unexpected error occurs during verification', async () => {
      req.query = { session_id: 'cs_error' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_error',
        payment_status: 'paid',
      });
      deps.firestore.getSupportTransactionBySessionId.mockRejectedValue(new Error('Firestore DB failure'));

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('getCredits', () => {
    it('returns 200 with list of public supporters', async () => {
      const mockCredits = [
        { name: 'マスターA', tier: 'gold', count: 3, lastSupportedAt: '2026-10-21T01:00:00Z' },
        { name: 'マスターB', tier: 'silver', count: 1, lastSupportedAt: '2026-10-20T12:00:00Z' },
      ];
      deps.firestore.getPublicSupporters.mockResolvedValue(mockCredits);

      await controller.getCredits(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(deps.firestore.getPublicSupporters).toHaveBeenCalledWith(100);
      expect(jsonMock).toHaveBeenCalledWith({ credits: mockCredits });
    });

    it('returns 500 when getPublicSupporters throws an error', async () => {
      deps.firestore.getPublicSupporters.mockRejectedValue(new Error('DB read error'));

      await controller.getCredits(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('handleWebhook', () => {
    it('returns 400 when rawBody is missing on webhook signature check', async () => {
      req.headers = { 'stripe-signature': 'valid_sig' };
      await controller.handleWebhook(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Webhook Error: Missing raw request body',
      });
    });

    it('returns 400 when webhook signature verification fails', async () => {
      req.headers = { 'stripe-signature': 'invalid_sig' };
      (req as any).rawBody = Buffer.from('{"id":"evt_test"}');
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      await controller.handleWebhook(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Webhook Error: Signature verification failed',
      });
    });

    it('idempotency: skips processing if transaction for sessionId already exists', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_already_processed',
            amount_total: 300,
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      req.headers = { 'stripe-signature': 'valid_sig' };
      (req as any).rawBody = Buffer.from('{}');

      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_already_processed',
      });

      await controller.handleWebhook(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        received: true,
        status: 'already_processed',
      });
      expect(deps.firestore.createSupportTransaction).not.toHaveBeenCalled();
      expect(deps.tasks.enqueueSupportTask).not.toHaveBeenCalled();
    });

    it('successfully processes checkout.session.completed and enqueues Cloud Task', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_abc123',
            payment_intent: 'pi_test_abc123',
            amount_total: 3000,
            custom_fields: [
              {
                key: 'supporter_name',
                type: 'text',
                text: { value: '神プロデューサー' },
              },
              {
                key: 'credit_visibility',
                type: 'dropdown',
                dropdown: { value: 'show' },
              },
            ],
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      req.headers = { 'stripe-signature': 'valid_sig' };
      (req as any).rawBody = Buffer.from('{}');

      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      deps.firestore.getActiveRewardImage.mockResolvedValue({ id: 'reward_gold_oct' });

      await controller.handleWebhook(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(deps.firestore.createSupportTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tx_abc123',
          stripeSessionId: 'cs_test_abc123',
          stripePaymentIntentId: 'pi_test_abc123',
          rawName: '神プロデューサー',
          safeName: '神プロデューサー',
          tier: 'gold',
          itemLabel: '開発サポート',
          creditVisibility: 'show',
          rewardImageId: 'reward_gold_oct',
          status: 'pending',
        }),
      );
      expect(deps.tasks.enqueueSupportTask).toHaveBeenCalledWith({ transactionId: 'tx_abc123' });
      expect(jsonMock).toHaveBeenCalledWith({
        received: true,
        transactionId: 'tx_abc123',
      });
    });

    it('applies fallback name and hidden credit visibility when custom fields dictate', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_anon_456',
            amount_total: 1000,
            custom_fields: [
              {
                key: 'supporter_name',
                type: 'text',
                text: { value: '   ' }, // empty whitespace
              },
              {
                key: 'credit_visibility',
                type: 'dropdown',
                dropdown: { value: 'hide' },
              },
            ],
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      req.headers = { 'stripe-signature': 'valid_sig' };
      (req as any).rawBody = Buffer.from('{}');

      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      deps.firestore.getActiveRewardImage.mockResolvedValue(null);

      await controller.handleWebhook(req as Request, res as Response);

      expect(deps.firestore.createSupportTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          rawName: '',
          safeName: config.support.fallbackName,
          creditVisibility: 'hide',
          tier: 'silver',
          itemLabel: 'サーバーリソース差し入れ',
          rewardImageId: 'none',
        }),
      );
    });

    it('returns 500 when saving transaction fails', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_fail',
            amount_total: 300,
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      req.headers = { 'stripe-signature': 'valid_sig' };
      (req as any).rawBody = Buffer.from('{}');

      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      deps.firestore.createSupportTransaction.mockRejectedValue(new Error('Database write failure'));

      await controller.handleWebhook(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to record transaction' });
    });

    it('returns 200 for unhandled event types', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: { object: {} },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      req.headers = { 'stripe-signature': 'valid_sig' };
      (req as any).rawBody = Buffer.from('{}');

      await controller.handleWebhook(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('getSupportPlans', () => {
    it('returns 200 with the list of plans and configured payment URLs', async () => {
      const configuredController = new PublicSupportController(
        deps,
        {
          ...config.support,
          paymentLinks: {
            bronze: 'https://buy.stripe.com/test_bronze',
            silver: 'https://buy.stripe.com/test_silver',
            gold: 'https://buy.stripe.com/test_gold',
          },
        },
        mockStripe,
      );

      await configuredController.getSupportPlans(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];
      expect(data.plans).toHaveLength(3);
      expect(data.plans[0]).toEqual(
        expect.objectContaining({
          tier: 'bronze',
          amount: 300,
          currency: 'jpy',
          itemLabel: 'エナドリ1本差し入れ',
          available: true,
          paymentUrl: 'https://buy.stripe.com/test_bronze',
        }),
      );
      expect(data.plans[1]).toEqual(
        expect.objectContaining({
          tier: 'silver',
          amount: 1000,
          currency: 'jpy',
          itemLabel: 'サーバーリソース差し入れ',
          available: true,
          paymentUrl: 'https://buy.stripe.com/test_silver',
        }),
      );
      expect(data.plans[2]).toEqual(
        expect.objectContaining({
          tier: 'gold',
          amount: 3000,
          currency: 'jpy',
          itemLabel: '開発サポート',
          available: true,
          paymentUrl: 'https://buy.stripe.com/test_gold',
        }),
      );
    });

    it('returns available: false and paymentUrl: null when payment links are unconfigured', async () => {
      const unconfiguredController = new PublicSupportController(
        deps,
        {
          ...config.support,
          paymentLinks: {
            bronze: '',
            silver: '',
            gold: '',
          },
        },
        mockStripe,
      );

      await unconfiguredController.getSupportPlans(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];
      expect(data.plans).toHaveLength(3);
      expect(data.plans[0]).toEqual(
        expect.objectContaining({
          tier: 'bronze',
          available: false,
          paymentUrl: null,
        }),
      );
      expect(data.plans[1]).toEqual(
        expect.objectContaining({
          tier: 'silver',
          available: false,
          paymentUrl: null,
        }),
      );
      expect(data.plans[2]).toEqual(
        expect.objectContaining({
          tier: 'gold',
          available: false,
          paymentUrl: null,
        }),
      );
    });
  });
});
