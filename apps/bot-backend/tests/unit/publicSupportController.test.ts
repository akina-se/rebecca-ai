import { PublicSupportController } from '../../src/features/support/publicController';
import config from '../../src/config';
import { createMockDeps } from './core/testUtils';
import { Request, Response } from 'express';
import Stripe from 'stripe';

/**
 * Builds an expanded Stripe PaymentIntent stub whose `created` (epoch seconds) is `minutesAgo` minutes in the past.
 * `PaymentIntent.created` is the authoritative payment time for the 30-minute reward download window.
 */
const paidIntent = (minutesAgo = 0) => ({
  id: 'pi_test_paid',
  created: Math.floor((Date.now() - minutesAgo * 60 * 1000) / 1000),
});

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
      setHeader: jest.fn(),
      send: jest.fn().mockReturnThis(),
    };
    req = {
      query: {},
      headers: {},
      body: {},
    };

    mockStripe = {
      checkout: {
        sessions: {
          retrieve: jest.fn().mockResolvedValue({ payment_status: 'paid', payment_intent: paidIntent(0) }),
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
    it('returns 500 fail-closed if stripe is not configured', async () => {
      const unconfiguredController = new PublicSupportController(
        deps,
        {
          ...config.support,
          stripeSecretKey: '',
        },
      );
      req.headers = { 'x-stripe-session-id': 'cs_test_123' };
      await unconfiguredController.verifySession(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Payment gateway configuration error' });
    });

    it('returns 400 if the session ID is missing from both the header and the cookie', async () => {
      req.query = {};
      await controller.verifySession(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Missing or invalid session' }));
    });

    it('ignores the legacy session_id query parameter (never accepted from the URL)', async () => {
      req.query = { session_id: 'cs_test_from_url' };
      req.headers = {};
      await controller.verifySession(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });

    it('returns 400 for a malformed session ID in the header without any Stripe lookup', async () => {
      req.headers = { 'x-stripe-session-id': 'not-a-session; DROP' };
      await controller.verifySession(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });

    it('re-verifies on reload using only the reward_ticket cookie (no header, no query)', async () => {
      req.headers = { cookie: 'reward_ticket=cs_reload_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_reload_123',
        payment_status: 'paid',
        amount_total: 1000,
        payment_intent: paidIntent(1),
      });
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_reload_123',
        tier: 'silver',
        itemLabel: 'サーバーリソース差し入れ',
        safeName: 'アリス',
      });
      deps.firestore.getActiveRewardImage.mockResolvedValue(null);

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_reload_123', {
        expand: ['payment_intent'],
      });
    });

    it('returns 404 if Stripe session cannot be found', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_unknown' };
      mockStripe.checkout.sessions.retrieve.mockRejectedValue(new Error('No such checkout session'));

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        valid: false,
        error: 'Checkout session not found',
      });
    });

    it('returns 403 Forbidden if session payment_status is not paid (Strict Guard)', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_unpaid_123' };
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

    it('returns 200 with secure backend download endpoints (no session_id in URL) and sets HttpOnly ticket cookie when paid', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_paid_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_paid_123',
        payment_status: 'paid',
        payment_intent: paidIntent(1),
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

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(deps.firestore.incrementRewardImageDistributedCount).toHaveBeenCalledWith('reward_2026_10');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('reward_ticket='),
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('HttpOnly; SameSite=Lax'),
      );
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          tier: 'silver',
          itemLabel: 'サーバーリソース差し入れ',
          safeName: 'アリス',
          reward: expect.objectContaining({
            title: 'サポーター特典イラスト',
            imageUrl: '/api/v1/support/rewards/download?type=thumbnail',
            thumbnailUrl: '/api/v1/support/rewards/download?type=thumbnail',
            downloadUrl: '/api/v1/support/rewards/download?type=master',
          }),
        }),
      );
    });

    it('handles paid session gracefully when no active reward image exists', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_paid_no_img' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_paid_no_img',
        payment_status: 'paid',
        payment_intent: paidIntent(1),
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

    it('redacts safeName (returns null) when creditVisibility is hide to protect privacy', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_hidden_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_hidden_123',
        payment_status: 'paid',
        payment_intent: paidIntent(1),
        amount_total: 1000,
      });
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_hidden_123',
        safeName: '秘密のマスター',
        creditVisibility: 'hide',
        tier: 'silver',
        itemLabel: 'サーバーリソース',
        createdAt: new Date().toISOString(),
      });

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          safeName: null,
        }),
      );
    });

    it('returns isExpired: true and null reward when session was created more than 30 minutes ago', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_expired_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_expired_123',
        payment_status: 'paid',
        amount_total: 1000,
        payment_intent: paidIntent(40),
      });
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_expired_123',
        safeName: 'Test2',
        tier: 'gold',
        itemLabel: '開発サポート',
        createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      });

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          safeName: 'Test2',
          reward: null,
          isExpired: true,
        }),
      );
    });

    it('retrieves the Stripe session with payment_intent expanded to resolve the payment time', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_expand_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_expand_123',
        payment_status: 'paid',
        amount_total: 1000,
        payment_intent: paidIntent(1),
      });
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_expand_123',
        tier: 'silver',
        itemLabel: 'サーバーリソース差し入れ',
        safeName: 'アリス',
      });
      deps.firestore.getActiveRewardImage.mockResolvedValue(null);

      await controller.verifySession(req as Request, res as Response);

      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_expand_123', {
        expand: ['payment_intent'],
      });
    });

    it('returns 502 (fail closed, no local-clock fallback) when the payment time is unavailable', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_no_pi_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_no_pi_123',
        payment_status: 'paid',
        amount_total: 1000,
        created: Math.floor(Date.now() / 1000),
        payment_intent: 'pi_not_expanded',
      });

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(502);
      expect(jsonMock).toHaveBeenCalledWith({
        valid: false,
        error: 'Unable to determine payment time. Please retry.',
      });
      expect(deps.firestore.createSupportTransaction).not.toHaveBeenCalled();
      expect(deps.tasks.enqueueSupportTask).not.toHaveBeenCalled();
    });

    it('anchors the 30-minute window to Stripe payment time even if the stored record was re-created just now', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_recreated_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_recreated_123',
        payment_status: 'paid',
        amount_total: 1000,
        payment_intent: paidIntent(24 * 60), // paid yesterday
      });
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_recreated_123',
        safeName: 'Test3',
        tier: 'silver',
        itemLabel: 'サーバーリソース',
        createdAt: new Date().toISOString(), // stale/re-created record stamped "now"
      });

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ valid: true, reward: null, isExpired: true }),
      );
      expect(res.setHeader).not.toHaveBeenCalledWith('Set-Cookie', expect.anything());
    });

    it('auto-creates the missing transaction with createdAt set to the Stripe payment time (not Date.now())', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_autosync_123' };
      const intent = paidIntent(10);
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_autosync_123',
        payment_status: 'paid',
        amount_total: 1000,
        payment_intent: intent,
      });
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      deps.firestore.getActiveRewardImage.mockResolvedValue(null);

      await controller.verifySession(req as Request, res as Response);

      expect(deps.firestore.createSupportTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSessionId: 'cs_autosync_123',
          stripePaymentIntentId: 'pi_test_paid',
          createdAt: new Date(intent.created * 1000).toISOString(),
        }),
      );
    });

    it('returns 500 if unexpected error occurs during verification', async () => {
      req.headers = { 'x-stripe-session-id': 'cs_error' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_error',
        payment_status: 'paid',
        payment_intent: paidIntent(1),
      });
      deps.firestore.getSupportTransactionBySessionId.mockRejectedValue(new Error('Firestore DB failure'));

      await controller.verifySession(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('getCredits', () => {
    it('returns 200 with paginated list of public supporters', async () => {
      const mockResult = {
        credits: [
          { id: 'tx_1', safeName: 'マスターA', tier: 'gold', itemLabel: '¥3,000', createdAt: '2026-10-21T01:00:00Z' },
          { id: 'tx_2', safeName: 'マスターB', tier: 'silver', itemLabel: '¥1,000', createdAt: '2026-10-20T12:00:00Z' },
        ],
        total: 2,
        page: 1,
        limit: 120,
        totalPages: 1,
      };
      deps.firestore.getPublicSupporters.mockResolvedValue(mockResult as any);

      await controller.getCredits(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(deps.firestore.getPublicSupporters).toHaveBeenCalledWith(1, 120);
      expect(jsonMock).toHaveBeenCalledWith(mockResult);
    });

    it('respects page and limit query parameters', async () => {
      req.query = { page: '2', limit: '50' };
      const mockResult = {
        credits: [],
        total: 100,
        page: 2,
        limit: 50,
        totalPages: 2,
      };
      deps.firestore.getPublicSupporters.mockResolvedValue(mockResult as any);

      await controller.getCredits(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(deps.firestore.getPublicSupporters).toHaveBeenCalledWith(2, 50);
      expect(jsonMock).toHaveBeenCalledWith(mockResult);
    });

    it('returns 500 when getPublicSupporters throws an error', async () => {
      deps.firestore.getPublicSupporters.mockRejectedValue(new Error('DB read error'));

      await controller.getCredits(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('handleWebhook', () => {
    it('returns 500 when stripeWebhookSecret is not configured (Fail-Closed)', async () => {
      const unconfiguredController = new PublicSupportController(
        deps,
        {
          ...config.support,
          stripeWebhookSecret: '',
        },
        mockStripe as unknown as Stripe,
      );
      req.headers = { 'stripe-signature': 'sig_123' };
      (req as any).rawBody = Buffer.from('{}');

      await unconfiguredController.handleWebhook(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Webhook Error: Server webhook secret is not configured',
      });
    });

    it('returns 400 when stripe-signature header is missing (Fail-Closed)', async () => {
      req.headers = {};
      (req as any).rawBody = Buffer.from('{}');

      await controller.handleWebhook(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Webhook Error: Missing stripe-signature header',
      });
    });

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
      const paymentIntent = paidIntent(2);
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_abc123',
        payment_status: 'paid',
        payment_intent: { ...paymentIntent, id: 'pi_test_abc123' },
      });
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
          createdAt: new Date(paymentIntent.created * 1000).toISOString(),
        }),
      );
      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_abc123', {
        expand: ['payment_intent'],
      });
      expect(deps.tasks.enqueueSupportTask).toHaveBeenCalledWith({ transactionId: 'tx_abc123' });
      expect(jsonMock).toHaveBeenCalledWith({
        received: true,
        transactionId: 'tx_abc123',
      });
    });

    it('returns 500 so Stripe retries when the payment time cannot be resolved (no local-clock fallback)', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_nopi',
        payment_status: 'paid',
        payment_intent: 'pi_not_expanded',
      });
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_nopi', amount_total: 1000, custom_fields: [] } },
      });
      req.headers = { 'stripe-signature': 'valid_sig' };
      (req as any).rawBody = Buffer.from('{}');
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);

      await controller.handleWebhook(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(deps.firestore.createSupportTransaction).not.toHaveBeenCalled();
      expect(deps.tasks.enqueueSupportTask).not.toHaveBeenCalled();
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
      expect(data.contactEmail).toBeNull();
      expect(data.plans).toHaveLength(3);
      expect(data.plans[0]).toEqual(
        expect.objectContaining({
          tier: 'bronze',
          amount: 500,
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

    it('obfuscates contactEmail by replacing @ with [at mark] to prevent scraping', async () => {
      const emailController = new PublicSupportController(
        deps,
        {
          ...config.support,
          contactEmail: 'contact@example.com',
        },
        mockStripe,
      );

      await emailController.getSupportPlans(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];
      expect(data.contactEmail).toBe('contact [at mark] example.com');
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
      expect(data.contactEmail).toBeNull();
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
  describe('downloadReward', () => {
    it('returns 400 when the reward_ticket cookie is missing', async () => {
      req.query = {};
      await controller.downloadReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing or invalid session' });
    });

    it('does not accept the session ID from the URL query string (cookie only)', async () => {
      req.query = { session_id: 'cs_test_from_url', type: 'master' };
      req.headers = {};

      await controller.downloadReward(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(deps.firestore.getSupportTransactionBySessionId).not.toHaveBeenCalled();
      expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });

    it('does not accept the session ID from the x-stripe-session-id header (cookie only)', async () => {
      req.query = { type: 'master' };
      req.headers = { 'x-stripe-session-id': 'cs_test_from_header' };

      await controller.downloadReward(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(deps.firestore.getSupportTransactionBySessionId).not.toHaveBeenCalled();
      expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });

    it('returns 403 when session is not paid', async () => {
      req.query = {};
      req.headers = { cookie: 'reward_ticket=cs_unpaid_123' };
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_unpaid_123',
        payment_status: 'unpaid',
      });

      await controller.downloadReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Payment has not been completed or verified.' });
    });

    it('returns 404 when Stripe session retrieval fails', async () => {
      req.query = {};
      req.headers = { cookie: 'reward_ticket=cs_nonexistent' };
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      mockStripe.checkout.sessions.retrieve.mockRejectedValue(new Error('Session not found'));

      await controller.downloadReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Checkout session not found' });
    });

    it('returns 410 Gone when no record exists and Stripe payment time is older than 30 minutes', async () => {
      req.query = {};
      req.headers = { cookie: 'reward_ticket=cs_old_norec' };
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_old_norec',
        payment_status: 'paid',
        payment_intent: paidIntent(24 * 60),
      });

      await controller.downloadReward(req as Request, res as Response);

      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_old_norec', {
        expand: ['payment_intent'],
      });
      expect(statusMock).toHaveBeenCalledWith(410);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ expired: true }));
    });

    it('returns 502 when no record exists and the Stripe payment time is unavailable', async () => {
      req.query = {};
      req.headers = { cookie: 'reward_ticket=cs_nopi_norec' };
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_nopi_norec',
        payment_status: 'paid',
        created: Math.floor(Date.now() / 1000),
        payment_intent: 'pi_not_expanded',
      });

      await controller.downloadReward(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(502);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unable to determine payment time. Please retry.' });
    });

    it('returns 410 Gone when download window (> 30 mins) has expired', async () => {
      req.query = {};
      req.headers = { cookie: 'reward_ticket=cs_expired_123' };
      const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000).toISOString();
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_expired_123',
        createdAt: fortyMinutesAgo,
        rewardImageId: 'reward_1',
      });

      await controller.downloadReward(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(410);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ expired: true }),
      );
    });

    it('returns 200 and streams binary image within 30-minute window for master download', async () => {
      req.query = { type: 'master' };
      req.headers = { cookie: 'reward_ticket=cs_valid_123' };
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_valid_123',
        createdAt: tenMinutesAgo,
        rewardImageId: 'reward_1',
      });
      deps.firestore.getRewardImageById.mockResolvedValue({
        id: 'reward_1',
        title: 'Special Halloween Art',
        storagePath: 'rewards/art.png',
      });

      const fakeBuffer = Buffer.from('fake-image-bytes');
      deps.storage.downloadImage.mockResolvedValue(fakeBuffer);

      await controller.downloadReward(req as Request, res as Response);

      expect(deps.storage.downloadImage).toHaveBeenCalledWith('rewards/art.png');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment'));
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(fakeBuffer);
    });

    it('streams thumbnail with inline disposition when type=thumbnail', async () => {
      req.query = { type: 'thumbnail' };
      req.headers = { cookie: 'reward_ticket=cs_valid_thumb' };
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_valid_thumb',
        createdAt: new Date().toISOString(),
        rewardImageId: 'reward_1',
      });
      deps.firestore.getRewardImageById.mockResolvedValue({
        id: 'reward_1',
        title: 'Special Art',
        storagePath: 'rewards/art.png',
        thumbnailStoragePath: 'rewards/thumb.webp',
      });

      const fakeBuffer = Buffer.from('fake-thumb-bytes');
      deps.storage.downloadImage.mockResolvedValue(fakeBuffer);

      await controller.downloadReward(req as Request, res as Response);

      expect(deps.storage.downloadImage).toHaveBeenCalledWith('rewards/thumb.webp');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(fakeBuffer);
    });

    it('returns 404 when reward record does not exist', async () => {
      req.query = {};
      req.headers = { cookie: 'reward_ticket=cs_no_reward' };
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_no_reward',
        createdAt: new Date().toISOString(),
        rewardImageId: 'none',
      });
      deps.firestore.getActiveRewardImage.mockResolvedValue(null);

      await controller.downloadReward(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Reward asset not found' });
    });

    it('authenticates downloadReward via HttpOnly cookie without session_id in query string', async () => {
      // First call verifySession to issue the Set-Cookie header
      req.headers = { 'x-stripe-session-id': 'cs_cookie_auth_123' };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_cookie_auth_123',
        payment_status: 'paid',
        payment_intent: paidIntent(1),
        amount_total: 1000,
      });
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_cookie_auth_123',
        createdAt: new Date().toISOString(),
        rewardImageId: 'reward_1',
      });
      deps.firestore.getRewardImageById.mockResolvedValue({
        id: 'reward_1',
        title: 'Cookie Auth Art',
        storagePath: 'rewards/art.jpg',
      });

      await controller.verifySession(req as Request, res as Response);

      const setCookieCall = (res.setHeader as jest.Mock).mock.calls.find(
        (call) => call[0] === 'Set-Cookie',
      );
      expect(setCookieCall).toBeDefined();
      const cookiePair = (setCookieCall![1] as string).split(';')[0];
      // The cookie carries only the opaque session ID: no embedded expiry/payload that the server would have to trust
      expect(cookiePair).toBe('reward_ticket=cs_cookie_auth_123');

      // Now call downloadReward with only the Cookie header and NO session_id in req.query
      jest.clearAllMocks();
      req.query = { type: 'master' };
      req.headers = { cookie: `other_cookie=1; ${cookiePair}` };
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue({
        id: 'tx_cookie_auth_123',
        createdAt: new Date().toISOString(),
        rewardImageId: 'reward_1',
      });
      deps.firestore.getRewardImageById.mockResolvedValue({
        id: 'reward_1',
        title: 'Cookie Auth Art',
        storagePath: 'rewards/art.jpg',
      });
      const fakeBuffer = Buffer.from('jpg-bytes');
      deps.storage.downloadImage.mockResolvedValue(fakeBuffer);

      await controller.downloadReward(req as Request, res as Response);

      expect(deps.firestore.getSupportTransactionBySessionId).toHaveBeenCalledWith('cs_cookie_auth_123');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(fakeBuffer);
    });

    it('rejects a malformed reward_ticket cookie value without any Firestore or Stripe lookup', async () => {
      req.query = { type: 'master' };
      req.headers = { cookie: 'reward_ticket=tampered_payload.invalid_signature' };

      await controller.downloadReward(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing or invalid session' });
      expect(deps.firestore.getSupportTransactionBySessionId).not.toHaveBeenCalled();
      expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });

    it('returns 400 (not 500) for a reward_ticket cookie with invalid percent-encoding', async () => {
      req.query = { type: 'master' };
      req.headers = { cookie: 'reward_ticket=%E0%A4%A' };

      await controller.downloadReward(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing or invalid session' });
    });

    it('rejects a forged cookie for a session that does not exist in Stripe', async () => {
      req.query = { type: 'master' };
      req.headers = { cookie: 'reward_ticket=cs_forged_by_attacker' };
      deps.firestore.getSupportTransactionBySessionId.mockResolvedValue(null);
      mockStripe.checkout.sessions.retrieve.mockRejectedValue(new Error('No such checkout session'));

      await controller.downloadReward(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(deps.storage.downloadImage).not.toHaveBeenCalled();
    });
  });
});
