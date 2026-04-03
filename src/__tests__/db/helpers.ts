/**
 * Creates a lightweight in-memory SQLite mock that satisfies the expo-sqlite
 * interface used by our DB layer.
 */

type Row = Record<string, unknown>;

interface MockDb {
  execAsync: jest.Mock;
  runAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
  _data: Map<string, Row[]>;
  _seed: (table: string, rows: Row[]) => void;
}

export function createMockDb(): MockDb {
  const data: Map<string, Row[]> = new Map();

  const mock: MockDb = {
    _data: data,
    _seed(table, rows) {
      data.set(table, [...rows]);
    },
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
  };

  return mock;
}
