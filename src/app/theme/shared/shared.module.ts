import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AlertModule, BreadcrumbModule, CardModule, ModalModule } from './components';
import { PERFECT_SCROLLBAR_CONFIG, PerfectScrollbarConfigInterface, PerfectScrollbarModule } from 'ngx-perfect-scrollbar';
import { ClickOutsideModule } from 'ng-click-outside';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { ToastComponent } from './components/toast/toast.component';
import { ToastService } from './components/toast/toast.service';
import { HttpClientModule } from '@angular/common/http';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { ExcelModule, GridModule, PDFModule } from '@progress/kendo-angular-grid';
import { LabelModule } from '@progress/kendo-angular-label';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { DateInputsModule } from '@progress/kendo-angular-dateinputs';
import { ButtonComponent } from './components/button/button.component';
import { NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { PopupModule } from '@progress/kendo-angular-popup';
import { UploadModule } from '@progress/kendo-angular-upload';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { ProgressBarModule } from '@progress/kendo-angular-progressbar';

const DEFAULT_PERFECT_SCROLLBAR_CONFIG: PerfectScrollbarConfigInterface = {
  suppressScrollX: true,
};

@NgModule({
  imports: [
    CommonModule,
    PerfectScrollbarModule,
    FormsModule,
    ReactiveFormsModule,
    AlertModule,
    CardModule,
    BreadcrumbModule,
    ModalModule,
    ClickOutsideModule,
    DateInputsModule,
    HttpClientModule,
    GridModule,
    ExcelModule,
    PDFModule,
    DialogModule,
    LabelModule,
    InputsModule,
    DropDownsModule,
    NgbDropdownModule,
    NgbTooltipModule,
    PopupModule,
    ProgressBarModule,
    UploadModule,
    DialogsModule,
  ],
  exports: [
    CommonModule,
    PerfectScrollbarModule,
    FormsModule,
    ReactiveFormsModule,
    DateInputsModule,
    AlertModule,
    CardModule,
    BreadcrumbModule,
    ModalModule,
    ClickOutsideModule,
    SpinnerComponent,
    ToastComponent,
    HttpClientModule,
    GridModule,
    ExcelModule,
    PDFModule,
    LabelModule,
    ProgressBarModule,
    InputsModule,
    ButtonComponent,
    DialogModule,
    DropDownsModule,
    NgbDropdownModule,
    NgbTooltipModule,
    PopupModule,
    UploadModule,
    DialogsModule,
  ],
  declarations: [SpinnerComponent, ToastComponent, ButtonComponent],
  providers: [
    {
      provide: PERFECT_SCROLLBAR_CONFIG,
      useValue: DEFAULT_PERFECT_SCROLLBAR_CONFIG,
    },
    ToastService,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SharedModule { }
