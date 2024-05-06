import { MessageService } from '@progress/kendo-angular-l10n';

const messages = {
  'kendo.grid.noRecords': 'Kayıt yok',
  'kendo.grid.filterBooleanAll':'Tümü',
  'kendo.grid.filterIsFalse':'Pasif',
  'kendo.grid.filterIsTrue':'Aktif',
  'kendo.grid.filterEqOperator':'Eşit',
  'kendo.grid.filterNotEqOperator':'Eşit Değil',
  'kendo.grid.filterContainsOperator':'İçeriyor',
  'kendo.grid.filterNotContainsOperator':'İçermiyor',
  'kendo.grid.filterStartsWithOperator':'İle Başlıyor',
  'kendo.grid.filterEndsWithOperator':'İle bitiyor',
  'kendo.grid.filterIsNullOperator':'Null',
  'kendo.grid.filterIsNotNullOperator':'Null Değil',
  'kendo.grid.filterIsEmptyOperator':'Boş',
  'kendo.grid.filterIsNotEmptyOperator':'Boş Değil',
  'kendo.grid.filterGtOperator':'Büyük',
  'kendo.grid.filterGteOperator':'Büyük ve Eşit',
  'kendo.grid.filterLtOperator':'Küçük',
  'kendo.grid.filterLteOperator':'Küçük ve Eşit',
  'kendo.grid.filterBeforeOrEqualOperator': 'Önce yada Eşit',
  'kendo.grid.filterAfterOrEqualOperator': 'Sonra yada Eşit',
  'kendo.grid.filterBeforeOperator': 'Önce',
  'kendo.grid.filterAfterOperator': 'Sonra',
  'kendo.scheduler.today':'Bugün',
  'kendo.scheduler.monthViewTitle':'Aylık',
  'kendo.scheduler.weekViewTitle':'Haftalık',
  'kendo.scheduler.dayViewTitle':'Günlük',
  'kendo.datepicker.today':'Bugün',

 
};

export class LanguageService extends MessageService {
  
  public override get(key: string): string {
    return messages[key];
  }
}
