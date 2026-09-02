import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../catalog/entitlements.module';
import { ConversationalOperationsModule } from '../conversational-operations/conversational-operations.module';
import { ConsultantPortfolioController } from './consultant-portfolio.controller';
import { ConsultantPortfolioService } from './consultant-portfolio.service';
import { PortfolioCopilotService } from './portfolio-copilot.service';

@Module({
  imports: [EntitlementsModule, ConversationalOperationsModule],
  controllers: [ConsultantPortfolioController],
  providers: [ConsultantPortfolioService, PortfolioCopilotService],
  exports: [ConsultantPortfolioService],
})
export class ConsultantPortfolioModule {}
