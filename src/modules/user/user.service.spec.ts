import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';

/** 仿 Mongoose E11000 重复键错误，按 keyPattern 区分字段 */
function duplicateKey(keyPattern: Record<string, number>) {
  const err = new Error('E11000 duplicate key') as Error & {
    code: number;
    keyPattern: Record<string, number>;
  };
  err.code = 11000;
  err.keyPattern = keyPattern;
  return err;
}

describe('UserService.create', () => {
  const dto: CreateUserDto = {
    username: ' Alice ',
    email: 'ALICE@Example.com',
    password: 'abc12345',
  };

  type UserModel = { create: jest.Mock };

  function setup(create: jest.Mock): {
    service: UserService;
    model: UserModel;
  } {
    const model: UserModel = { create };
    // @ts-expect-error 注入最小 model 桩，无需 Nest DI
    const service: UserService = new UserService(model);
    return { service, model };
  }

  it('persists normalized fields, hashes the password, forces isAdmin=false, and returns a sanitized view', async () => {
    const inserted = {
      _id: '65ab00000000000000000001',
      username: 'Alice',
      email: 'alice@example.com',
      isAdmin: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const create = jest.fn().mockResolvedValue(inserted);
    const { service } = setup(create);

    const result = await service.create(dto);

    expect(create).toHaveBeenCalledTimes(1);
    const saved = create.mock.calls[0][0];
    expect(saved).toMatchObject({
      username: 'Alice',
      usernameLower: 'alice',
      email: 'alice@example.com',
      isAdmin: false,
    });
    expect(saved.password).not.toBe('abc12345');
    await expect(bcrypt.compare('abc12345', saved.password)).resolves.toBe(
      true,
    );

    expect(result).toEqual({
      id: '65ab00000000000000000001',
      username: 'Alice',
      email: 'alice@example.com',
      isAdmin: false,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    });
    expect(result).not.toHaveProperty('password');
  });

  it('maps usernameLower duplicate key to 409 USERNAME_EXISTS', async () => {
    const { service } = setup(
      jest.fn().mockRejectedValue(duplicateKey({ usernameLower: 1 })),
    );
    await expect(service.create(dto)).rejects.toMatchObject({
      status: 409,
      message: 'USERNAME_EXISTS',
    });
  });

  it('maps email duplicate key to 409 EMAIL_EXISTS', async () => {
    const { service } = setup(
      jest.fn().mockRejectedValue(duplicateKey({ email: 1 })),
    );
    await expect(service.create(dto)).rejects.toMatchObject({
      status: 409,
      message: 'EMAIL_EXISTS',
    });
  });

  it('treats differently cased/spaced usernames as the same usernameLower at normalization', async () => {
    const create = jest.fn().mockResolvedValue({
      _id: '1',
      username: 'Bob',
      email: 'bob@example.com',
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { service } = setup(create);
    await service.create({
      ...dto,
      username: '  BoB  ',
      email: 'bob@example.com',
    });
    expect(create.mock.calls[0][0].usernameLower).toBe('bob');
  });
});

describe('UserService.findById', () => {
  const sanitized = {
    _id: '65ab00000000000000000001',
    username: 'Alice',
    email: 'alice@example.com',
    isAdmin: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  function setup(findOne: jest.Mock) {
    // @ts-expect-error 注入最小 model 桩
    const service: UserService = new UserService({ findOne });
    return { service };
  }

  it('returns a sanitized user for a valid existing id', async () => {
    const findOne = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(sanitized) }),
    });
    const { service } = setup(findOne);

    const result = await service.findById('65ab00000000000000000001');
    expect(result).toMatchObject({
      id: '65ab00000000000000000001',
      username: 'Alice',
    });
    expect(result).not.toHaveProperty('password');
  });

  it('throws 400 INVALID_ID for a malformed ObjectId', async () => {
    const { service } = setup(jest.fn());
    await expect(service.findById('not-an-id')).rejects.toMatchObject({
      status: 400,
      message: 'INVALID_ID',
    });
  });

  it('throws 404 USER_NOT_FOUND when missing or soft-deleted', async () => {
    const findOne = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    });
    const { service } = setup(findOne);
    await expect(
      service.findById('65ab00000000000000000002'),
    ).rejects.toMatchObject({
      status: 404,
      message: 'USER_NOT_FOUND',
    });
  });
});

describe('UserService.findByIdOrNull', () => {
  function setup(findOne: jest.Mock) {
    // @ts-expect-error 注入最小 model 桩
    const service: UserService = new UserService({ findOne });
    return { service };
  }

  it('returns a sanitized user for a valid existing id', async () => {
    const findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: '65ab00000000000000000001',
          username: 'Alice',
          email: 'alice@example.com',
          isAdmin: false,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        }),
      }),
    });
    const { service } = setup(findOne);
    const result = await service.findByIdOrNull('65ab00000000000000000001');
    expect(result).toMatchObject({ id: '65ab00000000000000000001' });
  });

  it('returns null (no throw) when the user is missing or soft-deleted', async () => {
    const findOne = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    });
    const { service } = setup(findOne);
    await expect(
      service.findByIdOrNull('65ab00000000000000000002'),
    ).resolves.toBeNull();
  });

  it('throws 400 INVALID_ID for a malformed ObjectId', async () => {
    const { service } = setup(jest.fn());
    await expect(service.findByIdOrNull('not-an-id')).rejects.toMatchObject({
      status: 400,
      message: 'INVALID_ID',
    });
  });
});

describe('UserService.updateEmail', () => {
  function setup(model: Record<string, jest.Mock>) {
    // @ts-expect-error 注入最小 model 桩
    const service: UserService = new UserService(model);
    return { service };
  }

  it('normalizes and persists the new email, returning the sanitized user', async () => {
    const updated = {
      _id: '65ab00000000000000000001',
      username: 'Alice',
      email: 'new@example.com',
      isAdmin: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    };
    const findOneAndUpdate = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) }),
    });
    const { service } = setup({ findOneAndUpdate });

    const result = await service.updateEmail('65ab00000000000000000001', {
      email: ' NEW@Example.com ',
    });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.anything(), deletedAt: null }),
      expect.objectContaining({ $set: { email: 'new@example.com' } }),
      expect.anything(),
    );
    expect(result.email).toBe('new@example.com');
  });

  it('maps email collision to 409 EMAIL_EXISTS', async () => {
    const findOneAndUpdate = jest.fn().mockReturnValue({
      lean: () => ({
        exec: () => Promise.reject(duplicateKey({ email: 1 })),
      }),
    });
    const { service } = setup({ findOneAndUpdate });
    await expect(
      service.updateEmail('65ab00000000000000000001', {
        email: 'taken@example.com',
      }),
    ).rejects.toMatchObject({ status: 409, message: 'EMAIL_EXISTS' });
  });

  it('throws 404 USER_NOT_FOUND when target is missing or soft-deleted', async () => {
    const findOneAndUpdate = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    });
    const { service } = setup({ findOneAndUpdate });
    await expect(
      service.updateEmail('65ab00000000000000000002', {
        email: 'x@example.com',
      }),
    ).rejects.toMatchObject({ status: 404, message: 'USER_NOT_FOUND' });
  });

  it('throws 400 INVALID_ID for a malformed ObjectId', async () => {
    const { service } = setup({});
    await expect(
      service.updateEmail('bad-id', { email: 'x@example.com' }),
    ).rejects.toMatchObject({ status: 400, message: 'INVALID_ID' });
  });
});

describe('UserService admin operations', () => {
  const userFields = {
    username: 'u',
    email: 'u@example.com',
    isAdmin: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
  const id = (n: number) => `65ab0000000000000000000${n.toString(16)}`;
  const doc = (n: number) => ({ _id: id(n), ...userFields });

  /** 模拟 mongoose 链式 query：find().sort().skip().limit().lean().exec() */
  function chain(result: unknown) {
    return {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(result),
    };
  }

  function setup(model: Record<string, unknown>) {
    // @ts-expect-error 注入最小 model 桩
    const service: UserService = new UserService(model);
    return { service };
  }

  describe('list', () => {
    it('filters soft-deleted, sorts by _id desc, skips/limits by page, sanitizes list, and computes page fields', async () => {
      const q = chain([doc(2), doc(1)]);
      const countDocuments = jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve(31) });
      const { service } = setup({ ...q, countDocuments });

      const result = await service.list({ page: 2, pageSize: 20 });

      expect(q.find).toHaveBeenCalledWith({ deletedAt: null });
      expect(q.sort).toHaveBeenCalledWith({ _id: -1 });
      expect(q.skip).toHaveBeenCalledWith(20);
      expect(q.limit).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        total: 31,
        list: [
          { id: id(2), ...userFields },
          { id: id(1), ...userFields },
        ],
        page: 2,
        pageTotal: 2,
        index: 21,
      });
      expect(result.list[0]).not.toHaveProperty('password');
    });

    it('returns empty page shape with index 1 when no data exists', async () => {
      const q = chain([]);
      const countDocuments = jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve(0) });
      const { service } = setup({ ...q, countDocuments });

      const result = await service.list({ page: 1, pageSize: 20 });

      expect(result).toEqual({
        total: 0,
        list: [],
        page: 1,
        pageTotal: 0,
        index: 1,
      });
      expect(q.skip).toHaveBeenCalledWith(0);
    });

    it('serves an out-of-range page as an empty list with computed index', async () => {
      const q = chain([]);
      const countDocuments = jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve(21) });
      const { service } = setup({ ...q, countDocuments });

      const result = await service.list({ page: 3, pageSize: 10 });

      expect(result.list).toEqual([]);
      expect(result.total).toBe(21);
      expect(result.pageTotal).toBe(3);
      expect(result.index).toBe(21);
      expect(q.skip).toHaveBeenCalledWith(20);
    });
  });

  describe('setAdmin', () => {
    function findOneAndUpdateChain(result: unknown) {
      return {
        findOneAndUpdate: jest.fn().mockReturnValue({
          lean: () => ({ exec: () => Promise.resolve(result) }),
        }),
      };
    }

    it('promotes an existing user and returns the sanitized user', async () => {
      const updated = { ...doc(1), isAdmin: true };
      const model = {
        countDocuments: jest.fn(),
        ...findOneAndUpdateChain(updated),
      };
      const { service } = setup(model);
      const result = await service.setAdmin({ id: id(1), isAdmin: true });
      expect(result.isAdmin).toBe(true);
    });

    it('blocks demoting the last admin with 409 LAST_ADMIN_PROTECTED', async () => {
      const model = {
        findOne: jest.fn().mockReturnValue({
          lean: () => ({
            exec: () => Promise.resolve({ ...doc(1), isAdmin: true }),
          }),
        }),
        countDocuments: jest
          .fn()
          .mockReturnValue({ exec: () => Promise.resolve(1) }),
      };
      const { service } = setup(model);
      await expect(
        service.setAdmin({ id: id(1), isAdmin: false }),
      ).rejects.toMatchObject({ status: 409, message: 'LAST_ADMIN_PROTECTED' });
    });

    it('throws 404 USER_NOT_FOUND when target is missing or soft-deleted', async () => {
      const model = {
        countDocuments: jest.fn(),
        ...findOneAndUpdateChain(null),
      };
      const { service } = setup(model);
      await expect(
        service.setAdmin({ id: id(9), isAdmin: true }),
      ).rejects.toMatchObject({ status: 404, message: 'USER_NOT_FOUND' });
    });

    it('throws 400 INVALID_ID for a malformed id', async () => {
      const { service } = setup({});
      await expect(
        service.setAdmin({ id: 'bad', isAdmin: true }),
      ).rejects.toMatchObject({ status: 400, message: 'INVALID_ID' });
    });
  });

  describe('softDelete', () => {
    function nonAdminLookup() {
      return {
        findOne: jest.fn().mockReturnValue({
          lean: () => ({
            exec: () => Promise.resolve({ ...doc(1), isAdmin: false }),
          }),
        }),
      };
    }

    it('sets deletedAt on the target', async () => {
      const updateOne = jest.fn().mockReturnValue({
        exec: () => Promise.resolve({ matchedCount: 1 }),
      });
      const { service } = setup({ ...nonAdminLookup(), updateOne });
      const result = await service.softDelete({ id: id(1) });
      expect(result).toBeNull();
      expect(updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.anything(), deletedAt: null }),
        expect.objectContaining({ $set: { deletedAt: expect.any(Date) } }),
      );
    });

    it('blocks deleting the last admin with 409 LAST_ADMIN_PROTECTED', async () => {
      const countDocuments = jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve(1) });
      const findOne = jest.fn().mockReturnValue({
        lean: () => ({
          exec: () => Promise.resolve({ ...doc(1), isAdmin: true }),
        }),
      });
      const { service } = setup({ countDocuments, findOne });
      await expect(service.softDelete({ id: id(1) })).rejects.toMatchObject({
        status: 409,
        message: 'LAST_ADMIN_PROTECTED',
      });
    });

    it('throws 404 USER_NOT_FOUND on deleting an already-deleted user', async () => {
      // findOne（deletedAt:null）查不到，说明不存在或已软删；链式桩保留 this
      const query = {
        exec: () => Promise.resolve(null),
      };
      const findOne = jest.fn().mockReturnValue({
        lean() {
          return query;
        },
      });
      const updateOne = jest.fn();
      const { service } = setup({ findOne, updateOne });
      await expect(service.softDelete({ id: id(9) })).rejects.toMatchObject({
        status: 404,
        message: 'USER_NOT_FOUND',
      });
      expect(updateOne).not.toHaveBeenCalled();
    });

    it('throws 400 INVALID_ID for a malformed id', async () => {
      const { service } = setup({});
      await expect(service.softDelete({ id: 'bad' })).rejects.toMatchObject({
        status: 400,
        message: 'INVALID_ID',
      });
    });
  });

  describe('getAuthPrincipal', () => {
    const id = '65ab00000000000000000001';

    function setup(doc: unknown, execReject?: Error) {
      const exec = execReject
        ? jest.fn().mockRejectedValue(execReject)
        : jest.fn().mockResolvedValue(doc);
      const lean = jest.fn().mockReturnValue({ exec });
      const select = jest.fn().mockReturnValue({ lean });
      const findOne = jest.fn().mockReturnValue({ select, lean });
      // @ts-expect-error 注入最小 model 桩
      const service: UserService = new UserService({ findOne });
      return { service, findOne, select, lean, exec };
    }

    it('returns {id,isAdmin} for a live user and queries by _id + deletedAt:null', async () => {
      const { service, findOne } = setup({ _id: id, isAdmin: true });
      await expect(service.getAuthPrincipal(id)).resolves.toEqual({
        id,
        isAdmin: true,
      });
      expect(findOne).toHaveBeenCalledWith({ _id: id, deletedAt: null });
    });

    it('returns null when the user does not exist', async () => {
      const { service } = setup(null);
      await expect(service.getAuthPrincipal(id)).resolves.toBeNull();
    });

    it('returns null for a soft-deleted user (query filters deletedAt:null)', async () => {
      const { service, findOne } = setup(null);
      const result = await service.getAuthPrincipal(id);
      expect(result).toBeNull();
      expect(findOne.mock.calls[0][0]).toMatchObject({
        _id: id,
        deletedAt: null,
      });
    });

    it('projects only _id and isAdmin (no password/usernameLower/deletedAt materialized)', async () => {
      const { service, select } = setup({ _id: id, isAdmin: false });
      await service.getAuthPrincipal(id);
      expect(select).toHaveBeenCalledWith('_id isAdmin');
    });

    it('propagates query errors so the Guard can fail closed', async () => {
      const { service } = setup(undefined, new Error('mongo down'));
      await expect(service.getAuthPrincipal(id)).rejects.toThrow('mongo down');
    });
  });

  describe('findLoginCredential', () => {
    const id = '65ab00000000000000000001';
    const normalized = 'alice';
    const userFields = {
      username: 'Alice',
      email: 'alice@example.com',
      isAdmin: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    function setup(doc: unknown) {
      const exec = jest.fn().mockResolvedValue(doc);
      const lean = jest.fn().mockReturnValue({ exec });
      const select = jest.fn().mockReturnValue({ lean });
      const findOne = jest.fn().mockReturnValue({ select, lean });
      // @ts-expect-error 注入最小 model 桩
      const service: UserService = new UserService({ findOne });
      return { service, findOne, select, exec };
    }

    it('queries by $or usernameLower/email with deletedAt:null and selects password', async () => {
      const { service, findOne, select } = setup({
        _id: id,
        ...userFields,
        password: 'hash',
      });
      const result = await service.findLoginCredential(normalized);
      expect(findOne).toHaveBeenCalledWith({
        $or: [{ usernameLower: normalized }, { email: normalized }],
        deletedAt: null,
      });
      expect(select).toHaveBeenCalledWith('+password');
      expect(result).toEqual({
        id,
        passwordHash: 'hash',
        user: { id, ...userFields },
      });
    });

    it('returns null when no live account matches', async () => {
      const { service } = setup(null);
      await expect(service.findLoginCredential('nobody')).resolves.toBeNull();
    });
  });
});
