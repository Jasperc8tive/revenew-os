import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { IntegrationProvider } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prismaMock = {
    membership: {
      findFirst: jest.fn(),
    },
    integration: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const connectorMock = {
    setCredentials: jest.fn(),
    dispatch: jest.fn(),
  };

  const connectorsServiceMock = {
    getConnector: jest.fn(),
  };

  const cryptoServiceMock = {
    decrypt: jest.fn(),
  };

  let service: NotificationsService;

  const originalEnv = {
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
    TERMII_API_KEY: process.env.TERMII_API_KEY,
    TERMII_SENDER_ID: process.env.TERMII_SENDER_ID,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.SENDGRID_API_KEY = 'sendgrid-env-key';
    process.env.SENDGRID_FROM_EMAIL = 'alerts@revenew.test';
    process.env.TERMII_API_KEY = 'termii-env-key';
    process.env.TERMII_SENDER_ID = 'Revenew';

    connectorsServiceMock.getConnector.mockImplementation(() => connectorMock);
    connectorMock.dispatch.mockImplementation(async () => ({
      provider: IntegrationProvider.TERMII,
      sentAt: new Date().toISOString(),
    }));

    service = new NotificationsService(
      prismaMock as never,
      connectorsServiceMock as never,
      cryptoServiceMock as never,
    );
  });

  afterEach(() => {
    process.env.SENDGRID_API_KEY = originalEnv.SENDGRID_API_KEY;
    process.env.SENDGRID_FROM_EMAIL = originalEnv.SENDGRID_FROM_EMAIL;
    process.env.TERMII_API_KEY = originalEnv.TERMII_API_KEY;
    process.env.TERMII_SENDER_ID = originalEnv.TERMII_SENDER_ID;
  });

  it('auto-resolves owner phone when channel is sms', async () => {
    prismaMock.$queryRaw.mockImplementation(async () => [{ phoneNumber: '+2348012345678' }]);
    prismaMock.integration.findFirst.mockImplementation(async () => null);

    const result = await service.dispatchAlert({
      organizationId: 'org-1',
      title: 'Alert',
      message: 'Something changed',
      channels: ['sms'],
    });

    expect(connectorsServiceMock.getConnector).toHaveBeenCalledWith(IntegrationProvider.TERMII);
    expect(connectorMock.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'sms',
        to: '+2348012345678',
      }),
    );
    expect(result.deliveries[0]).toMatchObject({
      channel: 'sms:+2348012345678',
      status: 'sent',
    });
  });

  it('uses explicit sms:+number channel without owner lookup', async () => {
    prismaMock.integration.findFirst.mockImplementation(async () => null);

    await service.dispatchAlert({
      organizationId: 'org-1',
      title: 'Alert',
      message: 'Threshold crossed',
      channels: ['sms:+2348098765432'],
    });

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(connectorMock.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'sms',
        to: '+2348098765432',
      }),
    );
  });

  it('skips sms delivery when owner phone is unavailable', async () => {
    prismaMock.$queryRaw.mockImplementation(async () => []);

    const result = await service.dispatchAlert({
      organizationId: 'org-1',
      title: 'Alert',
      message: 'No contact',
      channels: ['sms'],
    });

    expect(connectorMock.dispatch).not.toHaveBeenCalled();
    expect(result.deliveries[0]).toMatchObject({
      channel: 'sms',
      status: 'skipped',
      error: 'No owner phone number found for org',
    });
  });

  it('hydrates connector credentials from active integration when available', async () => {
    prismaMock.membership.findFirst.mockImplementation(async () => ({
      user: { email: 'owner@example.com' },
    }));
    prismaMock.integration.findFirst.mockImplementation(async () => ({
      credentials: [
        {
          encryptedToken: 'enc-token',
          refreshToken: 'enc-refresh',
        },
      ],
    }));
    cryptoServiceMock.decrypt
      .mockImplementationOnce(() => 'decrypted-token')
      .mockImplementationOnce(() => 'decrypted-refresh');

    await service.dispatchAlert({
      organizationId: 'org-1',
      title: 'Alert',
      message: 'Email dispatch',
      channels: ['email'],
    });

    expect(connectorMock.setCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'decrypted-token',
        refreshToken: 'decrypted-refresh',
      }),
    );
  });
});
