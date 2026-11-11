import { Controller, Get, Logger, type OnModuleInit, Query } from '@nestjs/common';
import { type MedicineResult, searchMedicines } from '@recuidado/data';

@Controller('medications')
export class MedicationsController implements OnModuleInit {
  private readonly logger = new Logger(MedicationsController.name);

  /** Loads the CMED list once at boot (about 1 s), so the first keystroke is fast. */
  onModuleInit() {
    try {
      searchMedicines('aa', 1);
    } catch (error) {
      this.logger.warn(`Medicine list not loaded: ${String(error)}`);
    }
  }

  /**
   * Autocomplete while the family types a medicine name: GET /medications/search?q=losar&limit=10.
   * Matches brand names and active ingredients (accents and case ignored); numbers filter the strengths.
   */
  @Get('search')
  search(@Query('q') q?: string, @Query('limit') limit?: string): MedicineResult[] {
    const max = Number.parseInt(limit ?? '', 10);
    return searchMedicines(q ?? '', Number.isFinite(max) ? max : 10);
  }
}
