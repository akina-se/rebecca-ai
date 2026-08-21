export function createMockCollection() {
  const mockGet = jest.fn().mockResolvedValue({ exists: false, empty: true, docs: [] });
  const mockSet = jest.fn().mockResolvedValue(undefined);
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDelete = jest.fn().mockResolvedValue(undefined);

  const queryObj: any = {
    get: mockGet,
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn()
  };
  queryObj.where.mockReturnValue(queryObj);
  queryObj.orderBy.mockReturnValue(queryObj);
  queryObj.limit.mockReturnValue(queryObj);

  const docObj: any = {
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
    delete: mockDelete
  };

  const collectionObj: any = {
    get: mockGet,
    doc: jest.fn().mockReturnValue(docObj),
    where: jest.fn().mockReturnValue(queryObj),
    orderBy: jest.fn().mockReturnValue(queryObj),
    limit: jest.fn().mockReturnValue(queryObj),
    withConverter: jest.fn().mockReturnThis()
  };

  return { collectionObj, docObj, queryObj, mockGet, mockSet, mockUpdate, mockDelete };
}

export function createMockFirestore() {
  const collectionsMap = new Map<string, any>();

  const firestore: any = {
    collection: jest.fn().mockImplementation((name: string) => {
      if (!collectionsMap.has(name)) {
        collectionsMap.set(name, createMockCollection().collectionObj);
      }
      return collectionsMap.get(name);
    }),
    batch: jest.fn().mockReturnValue({
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined)
    })
  };

  return {
    firestore,
    collectionsMap
  };
}
