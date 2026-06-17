import { hashPassword, verifyPassword } from '../../src/lib/password';

describe('password', () => {
  it('hashes and verifies a password', async () => {
    const passwordHash = await hashPassword('testpassword');

    expect(passwordHash).not.toBe('testpassword');
    expect(await verifyPassword('testpassword', passwordHash)).toBe(true);
    expect(await verifyPassword('wrong-password', passwordHash)).toBe(false);
  });
});
