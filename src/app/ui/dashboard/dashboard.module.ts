import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { SahaSecimiComponent } from './saha-secimi/saha-secimi.component';


@NgModule({
  declarations: [
    DashboardComponent,
    SahaSecimiComponent
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    SharedModule
  ]
})
export class DashboardModule { }
