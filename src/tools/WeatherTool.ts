import { jsonSchema } from 'ai';

export const WeatherTool = {
  description: '查询指定城市的天气信息',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名称，如"北京"、"上海"' },
    },
    required: ['city'],
    additionalProperties: false,
  }),
  execute: async ({ city }: { city: string }) => {
    // 先用假数据，后面会接真实 API
    const mockWeather: Record<string, string> = {
      北京: '晴，15-25°C，东南风 2 级',
      上海: '多云，18-22°C，西南风 3 级',
      深圳: '阵雨，22-28°C，南风 2 级',
    };
    return await Promise.resolve(mockWeather[city] || `${city}：暂无数据`);
  },
};
