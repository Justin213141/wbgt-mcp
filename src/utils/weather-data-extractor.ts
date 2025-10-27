export class WeatherDataExtractor {
  buildOpenMeteoMap(hourlyData: any): any {
    const map: any = {};

    const times = hourlyData?.time || [];
    const temps = hourlyData?.temperature_2m || [];
    const humidity = hourlyData?.relative_humidity_2m || [];
    const srInstant = hourlyData?.shortwave_radiation_instant || [];

    times.forEach((time: string, idx: number) => {
      const hourKey = time.substring(0, 13);
      map[hourKey] = {
        temperature: temps[idx],
        humidity: humidity[idx],
        solarRadiationInstant: srInstant[idx]
      };
    });

    return map;
  }

  extractRadiationData(data: any) {
    return {
      shortwave_instant: data.solarRadiationInstant || 0,
      direct: data.solarRadiationDirect || 0,
      diffuse: data.solarRadiationDiffuse || 0
    };
  }
}
