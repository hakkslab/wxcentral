import * as express from 'express';

import config from '../config';
import Db from './lib/Db';
import initObservationRoute from './routes/observation';

const app = express();
app.use(express.json());

app.listen(config.port, async () => {
  await Db.connect(config.dbFile);
  initObservationRoute(app);
  console.log('listening');
});
