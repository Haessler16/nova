import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with scrypt and verifies the original password', async () => {
    const hash = await service.hash('NovaDemo!2026');

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    await expect(service.verify('NovaDemo!2026', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('correct horse battery staple');

    await expect(service.verify('wrong password', hash)).resolves.toBe(false);
  });

  it('rejects malformed or missing hashes without throwing', async () => {
    await expect(service.verify('secret', null)).resolves.toBe(false);
    await expect(service.verify('secret', '')).resolves.toBe(false);
    await expect(service.verify('secret', 'bcrypt$whatever')).resolves.toBe(false);
    await expect(service.verify('secret', 'scrypt$1$2$3$bad$bad')).resolves.toBe(false);
  });
});
