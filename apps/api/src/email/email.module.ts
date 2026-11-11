import { Module } from '@nestjs/common';
import { EmailService } from '@recuidado/core';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
