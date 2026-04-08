import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IntegrationCryptoService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plainText: string): string {
    const secret = this.getSecret();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', secret, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(cipherText: string): string {
    const secret = this.getSecret();
    const [ivHex, encryptedHex] = cipherText.split(':');
    const decipher = createDecipheriv('aes-256-cbc', secret, Buffer.from(ivHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private getSecret(): Buffer {
    const raw = this.configService.get<string>('JWT_SECRET', 'revenew-default-secret');
    return createHash('sha256').update(raw).digest();
  }
}
