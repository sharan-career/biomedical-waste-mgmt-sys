import { Controller, Get, Header, Query } from '@nestjs/common';
import { toCsv } from '../../common/utils/csv.util';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

function csvFilename(name: string) {
  return `attachment; filename="${name}.csv"`;
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('customer-outstanding')
  customerOutstanding(@Query() query: ReportQueryDto) {
    return this.reportsService.customerOutstanding(query);
  }

  @Get('customer-outstanding/export')
  @RawResponse()
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', csvFilename('customer-outstanding'))
  async exportCustomerOutstanding(@Query() query: ReportQueryDto) {
    return toCsv(await this.reportsService.customerOutstanding(query));
  }

  @Get('invoices')
  invoiceReport(@Query() query: ReportQueryDto) {
    return this.reportsService.invoiceReport(query);
  }

  @Get('invoices/export')
  @RawResponse()
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', csvFilename('invoice-report'))
  async exportInvoiceReport(@Query() query: ReportQueryDto) {
    return toCsv(await this.reportsService.invoiceReport(query));
  }

  @Get('payments')
  paymentCollectionReport(@Query() query: ReportQueryDto) {
    return this.reportsService.paymentCollectionReport(query);
  }

  @Get('payments/export')
  @RawResponse()
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', csvFilename('payment-collection-report'))
  async exportPaymentCollectionReport(@Query() query: ReportQueryDto) {
    return toCsv(await this.reportsService.paymentCollectionReport(query));
  }

  @Get('overdue')
  overdueReport(@Query() query: ReportQueryDto) {
    return this.reportsService.overdueReport(query);
  }

  @Get('overdue/export')
  @RawResponse()
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', csvFilename('overdue-report'))
  async exportOverdueReport(@Query() query: ReportQueryDto) {
    return toCsv(await this.reportsService.overdueReport(query));
  }

  @Get('aging')
  agingReport(@Query() query: ReportQueryDto) {
    return this.reportsService.agingReport(query);
  }

  @Get('collection-executive-performance')
  collectionExecutivePerformance(@Query() query: ReportQueryDto) {
    return this.reportsService.collectionExecutivePerformance(query);
  }

  @Get('collection-executive-performance/export')
  @RawResponse()
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    csvFilename('collection-executive-performance'),
  )
  async exportCollectionExecutivePerformance(@Query() query: ReportQueryDto) {
    return toCsv(
      await this.reportsService.collectionExecutivePerformance(query),
    );
  }

  @Get('customer-payment-history')
  customerPaymentHistory(@Query() query: ReportQueryDto) {
    return this.reportsService.customerPaymentHistory(query);
  }

  @Get('customer-payment-history/export')
  @RawResponse()
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', csvFilename('customer-payment-history'))
  async exportCustomerPaymentHistory(@Query() query: ReportQueryDto) {
    return toCsv(await this.reportsService.customerPaymentHistory(query));
  }

  @Get('monthly-collection')
  monthlyCollectionReport(@Query() query: ReportQueryDto) {
    return this.reportsService.monthlyCollectionReport(query);
  }

  @Get('monthly-collection/export')
  @RawResponse()
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', csvFilename('monthly-collection-report'))
  async exportMonthlyCollectionReport(@Query() query: ReportQueryDto) {
    return toCsv(await this.reportsService.monthlyCollectionReport(query));
  }
}
