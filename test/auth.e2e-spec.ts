import type { INestApplication } from '@nestjs/common';
import { createTestApp, errorCode, gql, resetDb } from './utils/app.js';

const SIGN_UP = `mutation ($input: SignUpInput!) {
  signUp(input: $input) { token user { id email name } }
}`;
const LOG_IN = `mutation ($input: LogInInput!) { logIn(input: $input) { token user { email } } }`;
const ME = `{ me { id email name } }`;

describe('auth', () => {
  let app: INestApplication;
  const input = { email: 'Ada@Example.com', name: 'Ada Lovelace', password: 'Analytical1' };

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDb(app));
  afterAll(async () => {
    await app.close();
  });

  it('signs up, logs in and resolves the current user', async () => {
    const signUp = await gql(app, SIGN_UP, { input });
    expect(signUp.errors).toBeUndefined();
    expect(signUp.data?.signUp.user).toMatchObject({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });

    const logIn = await gql(app, LOG_IN, {
      input: { email: 'ada@example.com', password: input.password },
    });
    expect(logIn.data?.logIn.user.email).toBe('ada@example.com');

    const me = await gql(app, ME, {}, logIn.data?.logIn.token);
    expect(me.data?.me.name).toBe('Ada Lovelace');
  });

  it('never exposes the password hash in the schema', async () => {
    const res = await gql(app, `{ __type(name: "User") { fields { name } } }`);
    const fields = res.data?.__type.fields.map((f: { name: string }) => f.name);
    expect(fields).not.toContain('passwordHash');
  });

  it('rejects duplicate emails, weak passwords and bad credentials', async () => {
    await gql(app, SIGN_UP, { input });
    expect(errorCode(await gql(app, SIGN_UP, { input }))).toBe('CONFLICT');

    const weak = await gql(app, SIGN_UP, {
      input: { ...input, email: 'weak@example.com', password: 'short' },
    });
    expect(errorCode(weak)).toBe('BAD_USER_INPUT');
    expect(weak.errors?.[0]?.extensions?.details).toBeInstanceOf(Array);

    const wrong = await gql(app, LOG_IN, {
      input: { email: 'ada@example.com', password: 'wrong-pass1' },
    });
    expect(errorCode(wrong)).toBe('UNAUTHENTICATED');
  });

  it('requires a valid token for protected operations', async () => {
    expect(errorCode(await gql(app, ME))).toBe('UNAUTHENTICATED');
    expect(errorCode(await gql(app, ME, {}, 'garbage'))).toBe('UNAUTHENTICATED');
  });
});
