import * as express from 'express';
import { Observation } from '../models/Observation';

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

async function addObservations(req: express.Request, res: express.Response) {

}

export default function registerRoutes(app: express.Express) {
  app.post('/observation', addObservation);
  app.post('/observations', addObservations);
}
