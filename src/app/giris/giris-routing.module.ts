import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { GirisComponent } from './giris.component';


const routes: Routes = [ {
  path: '',
  component: GirisComponent
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GirisRoutingModule { }
