import { open, Database } from 'sqlite';
import * as sqlite3 from 'sqlite3';

type Sqlite3Database = Database<sqlite3.Database, sqlite3.Statement>;

class DbClass {
  private _db: Sqlite3Database;

  get conn(): Sqlite3Database {
    return this._db;
  }

  async connect(filename: string) {
    this._db = await open({
      filename,
      driver: sqlite3.cached.Database
    });
  }
}

const Db = new DbClass();

export default Db;
