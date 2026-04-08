import { describe, expect, it, jest } from '@jest/globals';
import { AlertEvaluationScheduler } from './alert-evaluation.scheduler';

describe('AlertEvaluationScheduler', () => {
  it('evaluates active rules and logs summary', async () => {
    const alertRulesServiceMock = {
      evaluateAll: jest.fn(async () => ({ checked: 5, triggered: 2 })),
    };

    const scheduler = new AlertEvaluationScheduler(alertRulesServiceMock as never);
    const loggerMock = {
      log: jest.fn(),
      error: jest.fn(),
    };
    (scheduler as unknown as { logger: typeof loggerMock }).logger = loggerMock;

    await scheduler.evaluateScheduledAlerts();

    expect(alertRulesServiceMock.evaluateAll).toHaveBeenCalledTimes(1);
    expect(loggerMock.log).toHaveBeenCalledWith(
      'Evaluated 5 active alert rules and triggered 2 events.',
    );
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('captures errors from evaluateAll without throwing', async () => {
    const alertRulesServiceMock = {
      evaluateAll: jest.fn(async () => {
        throw new Error('boom');
      }),
    };

    const scheduler = new AlertEvaluationScheduler(alertRulesServiceMock as never);
    const loggerMock = {
      log: jest.fn(),
      error: jest.fn(),
    };
    (scheduler as unknown as { logger: typeof loggerMock }).logger = loggerMock;

    await expect(scheduler.evaluateScheduledAlerts()).resolves.toBeUndefined();
    expect(loggerMock.error).toHaveBeenCalledWith('Scheduled alert evaluation failed: boom');
  });
});
