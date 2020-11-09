import * as express from 'express';
import { Observation } from '../models/Observation';

async function getObservations(req: express.Request, res: express.Response) {
  const retVal = await Observation.selectAll();
  res.json(retVal);
}

/**
 * Records a single observation and returns the database record
 */
async function addObservation(req: express.Request, res: express.Response) {
  const observation = Observation.createFromObject({
    ...req.body,
    observationTime: Date.now()
  });

  if (observation) {
    try {
      await observation.sync();
      res.json(observation);
    } catch (err) {
      console.log('Error adding observation: ', err);
      res.status(500).send();
    }
  } else {
    res.status(400).send();
  }
}

/**
 * Records multiple observations and returns the database records
 */
async function addObservations(req: express.Request, res: express.Response) {
  try {
    const observations = Array.isArray(req.body) && req.body.map(item => {
      return Observation.createFromObject({
        ...item,
        observationTime: Date.now(),
      });
    });

    try {
      const records = await Promise.all(observations.map(async (observation) => {
        await observation.sync();
        return observation;
      }));
      res.json(records);
    } catch (err) {
      console.error('There was an error syncing observations: ', err);
      res.status(500).send();
    }

  } catch (err) {
    console.error('Error parsing observation records: ', err);
    res.status(400).send();
  }
}

export default function registerRoutes(app: express.Express) {
  app.get('/observations', getObservations);
  app.post('/observation', addObservation);
  app.post('/observations', addObservations);
}
