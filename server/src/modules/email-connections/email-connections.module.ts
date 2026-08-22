import { Module } from "@nestjs/common";
import { EmailConnectionsController } from "./email-connections.controller";
import { EmailConnectionsService } from "./email-connections.service";

@Module({
  controllers: [EmailConnectionsController],
  providers: [EmailConnectionsService],
  exports: [EmailConnectionsService],
})
export class EmailConnectionsModule {}
