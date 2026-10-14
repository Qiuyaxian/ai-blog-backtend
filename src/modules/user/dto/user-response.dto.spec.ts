import { Types } from 'mongoose';
import { toUserResponse } from './user-response.dto';

describe('toUserResponse', () => {
  const createdAt = new Date('2026-10-01T00:00:00.000Z');
  const updatedAt = new Date('2026-10-02T00:00:00.000Z');
  const id = new Types.ObjectId();

  function buildDoc() {
    return {
      _id: id,
      username: 'Alice',
      usernameLower: 'alice',
      email: 'alice@example.com',
      password: '$2b$10$abcdefghijklmnopqrstuv',
      isAdmin: false,
      deletedAt: null,
      createdAt,
      updatedAt,
      __v: 0,
    };
  }

  it('maps _id to id and returns only public fields', () => {
    const result = toUserResponse(buildDoc());

    expect(result).toEqual({
      id: id.toHexString(),
      username: 'Alice',
      email: 'alice@example.com',
      isAdmin: false,
      createdAt,
      updatedAt,
    });
  });

  it('never leaks internal storage fields', () => {
    const result = toUserResponse(buildDoc());

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('usernameLower');
    expect(result).not.toHaveProperty('deletedAt');
    expect(result).not.toHaveProperty('__v');
    expect(result).not.toHaveProperty('_id');
  });
});
