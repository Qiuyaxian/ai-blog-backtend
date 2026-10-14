import { SchemaType } from 'mongoose';
import { User, UserSchema } from './user.schema';

/** 读取 SchemaType 上未在公共类型中暴露的选项（default/select），避免使用 any */
function pathOption(path: SchemaType, key: string): unknown {
  return (path as unknown as { options: Record<string, unknown> }).options[key];
}

describe('UserSchema', () => {
  it('maps to the users collection with timestamps', () => {
    expect(UserSchema.get('collection')).toBe('users');
    expect(UserSchema.get('timestamps')).toBe(true);
  });

  it('declares all business fields', () => {
    const paths = UserSchema.paths;
    for (const field of [
      'username',
      'usernameLower',
      'email',
      'password',
      'isAdmin',
      'deletedAt',
      'createdAt',
      'updatedAt',
    ]) {
      expect(paths[field]).toBeDefined();
    }
  });

  it('defaults isAdmin to false and deletedAt to null', () => {
    expect(pathOption(UserSchema.path('isAdmin'), 'default')).toBe(false);
    expect(pathOption(UserSchema.path('deletedAt'), 'default')).toBeNull();
  });

  it('hides password / usernameLower / deletedAt from default queries', () => {
    expect(pathOption(UserSchema.path('password'), 'select')).toBe(false);
    expect(pathOption(UserSchema.path('usernameLower'), 'select')).toBe(false);
    expect(pathOption(UserSchema.path('deletedAt'), 'select')).toBe(false);
  });

  it('normalizes usernameLower via lowercase + trim (defense in depth)', () => {
    expect(pathOption(UserSchema.path('usernameLower'), 'lowercase')).toBe(
      true,
    );
    expect(pathOption(UserSchema.path('usernameLower'), 'trim')).toBe(true);
  });

  it('puts unique indexes on usernameLower and email', () => {
    const indexes = UserSchema.indexes() as unknown as Array<
      [Record<string, number>, Record<string, unknown>]
    >;
    const uniqueKeys = indexes
      .filter(([, opts]) => opts.unique === true)
      .map(([keys]) => Object.keys(keys).sort());

    expect(uniqueKeys).toContainEqual(['email']);
    expect(uniqueKeys).toContainEqual(['usernameLower']);
  });

  it('exports a User class bound to the schema', () => {
    expect(User).toBeDefined();
    expect(UserSchema).toBeDefined();
  });
});
