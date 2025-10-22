import pino from 'pino';

const isProduction = Bun.env.NODE_ENV === 'production';

export const logger = pino({
	level: isProduction ? 'error' : 'info',
	transport: isProduction
		? undefined
		: {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'SYS:standard',
				},
			},
});
