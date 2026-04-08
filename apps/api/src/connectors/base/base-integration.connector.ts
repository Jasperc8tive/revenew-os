import axios, { AxiosInstance } from 'axios';
import { IntegrationProvider, IntegrationSyncStatus } from '@prisma/client';
import {
  ConnectorSyncResult,
  IntegrationHealth,
  NormalizedRecord,
} from '../../integrations/types/integration.types';

export interface ConnectorAuthPayload {
  accessToken: string;
  refreshToken?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorAuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  errorMessage?: string;
}

export interface ConnectorCredentialState {
  accessToken: string;
  refreshToken?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailConnectorDispatchPayload {
  kind: 'email';
  to: string;
  subject: string;
  text: string;
  fromEmail?: string;
}

export interface SmsConnectorDispatchPayload {
  kind: 'sms';
  to: string;
  message: string;
  senderId?: string;
}

export type ConnectorDispatchPayload =
  | EmailConnectorDispatchPayload
  | SmsConnectorDispatchPayload;

export interface ConnectorDispatchResult {
  provider: IntegrationProvider;
  sentAt: string;
  providerMessageId?: string;
}

export abstract class BaseIntegrationConnector {
  protected readonly httpClient: AxiosInstance;
  private credentialState?: ConnectorCredentialState;

  protected constructor(
    protected readonly provider: IntegrationProvider,
    protected readonly category: string,
  ) {
    this.httpClient = axios.create({
      timeout: 15_000,
    });
  }

  getProvider(): IntegrationProvider {
    return this.provider;
  }

  getCategory(): string {
    return this.category;
  }

  setCredentials(credentials: ConnectorCredentialState): void {
    this.credentialState = { ...credentials };
  }

  getCredentialState(): ConnectorCredentialState | undefined {
    return this.credentialState;
  }

  async authenticate(payload: ConnectorAuthPayload): Promise<ConnectorAuthResult> {
    if (!payload.accessToken) {
      return {
        success: false,
        errorMessage: 'Access token is required.',
      };
    }

    this.setCredentials({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      metadata: payload.metadata,
    });

    try {
      await this.validateCredential();
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to validate credentials.',
      };
    }

    const state = this.credentialState;
    if (!state) {
      return {
        success: false,
        errorMessage: 'Credential state is unavailable after authentication.',
      };
    }

    return {
      success: true,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
    };
  }

  async refreshToken(refreshToken?: string): Promise<ConnectorAuthResult> {
    const effectiveRefreshToken = refreshToken ?? this.credentialState?.refreshToken;

    if (!effectiveRefreshToken) {
      return {
        success: false,
        errorMessage: 'Refresh token not available.',
      };
    }

    const tokenUrl = process.env[`OAUTH_TOKEN_URL_${this.provider}`];
    const clientId = process.env[`OAUTH_CLIENT_ID_${this.provider}`];
    const clientSecret = process.env[`OAUTH_CLIENT_SECRET_${this.provider}`];

    if (!tokenUrl || !clientId || !clientSecret) {
      return {
        success: false,
        errorMessage: `OAuth refresh configuration is missing for ${this.provider}.`,
      };
    }

    try {
      const response = await this.httpClient.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: effectiveRefreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const refreshedAccessToken: string | undefined = response.data?.access_token;
      const refreshedRefreshToken: string = response.data?.refresh_token ?? effectiveRefreshToken;

      if (!refreshedAccessToken) {
        return {
          success: false,
          errorMessage: `OAuth refresh response for ${this.provider} did not include access_token.`,
        };
      }

      this.setCredentials({
        accessToken: refreshedAccessToken,
        refreshToken: refreshedRefreshToken,
        metadata: this.credentialState?.metadata,
      });

      return {
        success: true,
        accessToken: refreshedAccessToken,
        refreshToken: refreshedRefreshToken,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Token refresh failed.',
      };
    }
  }

  async sync(): Promise<ConnectorSyncResult> {
    if (!this.credentialState?.accessToken) {
      return {
        provider: this.provider,
        status: IntegrationSyncStatus.FAILED,
        records: [],
        syncedAt: new Date().toISOString(),
        health: 'error',
        errorMessage: 'Connector credentials were not hydrated before sync.',
      };
    }

    try {
      const records = await this.ingest();
      return {
        provider: this.provider,
        status: records.length > 0 ? IntegrationSyncStatus.SUCCESS : IntegrationSyncStatus.PARTIAL,
        records,
        syncedAt: new Date().toISOString(),
        health: records.length > 0 ? 'healthy' : 'degraded',
      };
    } catch (error) {
      return {
        provider: this.provider,
        status: IntegrationSyncStatus.FAILED,
        records: [],
        syncedAt: new Date().toISOString(),
        health: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown sync error.',
      };
    }
  }

  async dispatch(_payload: ConnectorDispatchPayload): Promise<ConnectorDispatchResult> {
    throw new Error(`Provider ${this.provider} does not support outbound dispatch.`);
  }

  protected async authenticatedGet<T>(url: string, queryParams?: Record<string, unknown>): Promise<T> {
    try {
      return await this.rawGet<T>(url, queryParams);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;

      if (status !== 401) {
        throw error;
      }

      const refreshResult = await this.refreshToken();
      if (!refreshResult.success) {
        throw new Error(refreshResult.errorMessage ?? `Failed to refresh token for ${this.provider}.`);
      }

      return this.rawGet<T>(url, queryParams);
    }
  }

  protected getAccessTokenOrThrow(): string {
    const token = this.credentialState?.accessToken;
    if (!token) {
      throw new Error(`Missing access token for ${this.provider}.`);
    }
    return token;
  }

  protected getMetadataValue<T>(key: string): T | undefined {
    return this.credentialState?.metadata?.[key] as T | undefined;
  }

  protected buildBearerHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getAccessTokenOrThrow()}`,
    };
  }

  protected async validateCredential(): Promise<void> {
    return;
  }

  private async rawGet<T>(url: string, queryParams?: Record<string, unknown>): Promise<T> {
    const response = await this.httpClient.get<T>(url, {
      params: queryParams,
      headers: this.buildBearerHeaders(),
    });

    return response.data;
  }

  health(lastSyncAt?: Date): IntegrationHealth {
    return {
      status: 'healthy',
      message: `${this.provider} connector is available.`,
      lastSyncAt: lastSyncAt?.toISOString(),
    };
  }

  protected abstract ingest(): Promise<NormalizedRecord[]>;
}
