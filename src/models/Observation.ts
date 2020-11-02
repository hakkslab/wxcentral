import {
  DbModel,
  tableName,
  tableSchema,
  ColumnTypes
} from '../lib/DbModel';

export enum ObservationType {
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  BAROMETRIC_PRESSURE = 'barometric_pressure',
  AIR_QUALITY_PM25 = 'air_quality_pm25',
  AIR_QUALITY_PM10 = 'air_quality_pm10',
  WIND_SPEED = 'wind_speed',
  WIND_DIRECTION = 'wind_direction',
  BATTERY_VOLTAGE = 'batt_voltage',
  SOLAR_VOLTAGE = 'solar_voltage',
}

export interface IObservation {
  stationKey: string;
  stationName: string;
  observationTime: number;
  observationType: ObservationType;
  observationValue: number;
}

@tableName('observation')
@tableSchema({
  id: { name: 'observationId', type: ColumnTypes.Number, primaryKey: true },
  stationKey: { name: 'stationKey', type: ColumnTypes.String },
  stationName: { name: 'stationName', type: ColumnTypes.String },
  observationType: { name: 'observationType', type: ColumnTypes.String },
  observationTime: { name: 'observationTime', type: ColumnTypes.Number },
  observationValue: { name: 'observationValue', type: ColumnTypes.Number },
})
export class Observation extends DbModel {
  public stationKey: string;
  public stationName: string;
  public observationTime: number;
  public observationType: ObservationType;
  public observationValue: number;

  constructor() {
    super();
  }

  public static create() {
    return new Observation();
  }

  public sync(): Promise<void> {
    this.observationTime = Date.now();
    return super.sync();
  }
}
