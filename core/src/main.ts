import { ENV } from './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() { 
  await NestFactory.createApplicationContext(AppModule);
  console.log(`🚀 Application [${ENV.APPNAME}] Vers. ${ENV.VERSION}`);
}
bootstrap();
