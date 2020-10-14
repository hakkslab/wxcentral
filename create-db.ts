import Db from './src/db';
import config from './config';

const main = async () => {
  try {
    console.log('Connecting to database');
    await Db.connect(config.dbFile);
    console.log('Creating [observation] table');
    await Db.conn.exec(`
      CREATE TABLE IF NOT EXISTS observation (
        observationId INTEGER PRIMARY KEY AUTOINCREMENT,
        stationKey TEXT NOT NULL,
        stationName TEXT NOT NULL,
        observationType TEXT NOT NULL,
        observationTime INTEGER NOT NULL,
        observationValue FLOAT NOT NULL
      )
    `);
  } catch (exc) {
    console.error('There was an error creating the database');
    console.error(exc);
  }
};

main();
