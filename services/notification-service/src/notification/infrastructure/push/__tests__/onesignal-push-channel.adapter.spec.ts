import { ConfigService } from '@nestjs/config';
import { OneSignalPushChannelAdapter } from '../onesignal-push-channel.adapter';

describe('OneSignalPushChannelAdapter', () => {
  let adapter: OneSignalPushChannelAdapter;

  describe('when disabled (no credentials)', () => {
    beforeEach(() => {
      const mockConfig = {
        get: jest.fn().mockReturnValue(undefined),
      };
      adapter = new OneSignalPushChannelAdapter(mockConfig as ConfigService);
    });

    it('should report as disabled', () => {
      expect(adapter.isEnabled()).toBe(false);
    });

    it('should return false on send', async () => {
      const result = await adapter.send(
        { userId: 'user-123' },
        'Test Title',
        'Test Body',
      );
      expect(result).toBe(false);
    });
  });

  describe('when enabled', () => {
    const mockConfig = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          ONESIGNAL_APP_ID: 'test-app-id',
          ONESIGNAL_REST_API_KEY: 'test-api-key',
        };
        return config[key];
      }),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      adapter = new OneSignalPushChannelAdapter(mockConfig as ConfigService);
    });

    it('should report as enabled', () => {
      expect(adapter.isEnabled()).toBe(true);
    });

    it('should send notification successfully', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'notif-123', recipients: 1 }),
      });
      global.fetch = mockFetch;

      const result = await adapter.send(
        { userId: 'user-123', deviceToken: 'player-456' },
        'Order Update',
        'Your order has been shipped',
        { orderId: '123' },
      );

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.onesignal.com/notifications',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic test-api-key',
          },
          body: expect.stringContaining('"include_player_ids":["player-456"]'),
        }),
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });
      global.fetch = mockFetch;

      const result = await adapter.send(
        { userId: 'user-123' },
        'Test',
        'Body',
      );

      expect(result).toBe(false);
    });
  });
});
