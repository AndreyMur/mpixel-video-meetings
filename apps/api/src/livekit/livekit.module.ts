import { Module } from '@nestjs/common';
import { liveKitConfigProvider } from './livekit.options';
import { LiveKitService } from './livekit.service';

@Module({
  providers: [liveKitConfigProvider, LiveKitService],
  exports: [liveKitConfigProvider, LiveKitService],
})
export class LiveKitModule {}
