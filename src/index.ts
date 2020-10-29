import * as express from 'express';

import config from '../config';
import { IObservation } from './interfaces/observation';
import Db from './db';

const app = express();
app.use(express.json());

/**
 * Saves an weather observation value
 */
app.post('/observation', async (req, res) => {
  const data: IObservation = <IObservation>req.body;
  let success = false;

  try {
    await Db.conn.run(`
      INSERT INTO
        observation
      (
        stationKey,
        stationName,
        observationTime,
        observationType,
        observationValue
      ) VALUES (
        $stationKey,
        $stationName,
        $observationTime,
        $observationType,
        $observationValue
      )
    `, {
      $stationKey: data.stationKey,
      $stationName: data.stationName,
      $observationTime: Date.now(),
      $observationType: data.observationType,
      $observationValue: data.observationValue
    });

    success = true;
  } catch (exc) {
    console.error('Error adding observation');
    console.error(exc);
  }

  res.json({ success });
});

app.listen(config.port, () => {
  console.log('listening');
  Db.connect(config.dbFile);
});
