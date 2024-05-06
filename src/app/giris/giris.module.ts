import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GirisRoutingModule } from './giris-routing.module';
import { GirisComponent } from './giris.component';
import { SharedModule } from '../theme/shared/shared.module';


@NgModule({
  declarations: [GirisComponent],
  imports: [
    CommonModule,
    GirisRoutingModule,
    SharedModule
  ]
})
export class GirisModule { }
