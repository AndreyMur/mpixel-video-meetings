import { Module } from '@nestjs/common';
import { liveKitConfigProvider } from './livekit.options';

@Module({
  providers: [liveKitConfigProvider],
  exports: [liveKitConfigProvider],
})
export class LiveKitModule {}
