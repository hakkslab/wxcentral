export enum ObservationType {
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  BAROMETRIC_PRESSURE = 'barometric_pressure',
  AIR_QUALITY_PM25 = 'air_quality_pm25',
  AIR_QUALITY_PM10 = 'air_quality_pm10',
  WIND_SPEED = 'wind_speed',
  WIND_RIECTION = 'wind_direction',
}

export interface IObservation {
  stationKey: string;
  stationName: string;
  observationTime: number;
  observationType: ObservationType;
  observationValue: number;
}
