import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LOCALE_ID, NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { SharedModule } from './theme/shared/shared.module';

import { ElectronService } from 'ngx-electron';
import { AppComponent } from './app.component';
import { AdminComponent } from './theme/layout/admin/admin.component';
import { AuthComponent } from './theme/layout/auth/auth.component';
import { NavigationComponent } from './theme/layout/admin/navigation/navigation.component';
import { NavContentComponent } from './theme/layout/admin/navigation/nav-content/nav-content.component';
import { NavGroupComponent } from './theme/layout/admin/navigation/nav-content/nav-group/nav-group.component';
import { NavCollapseComponent } from './theme/layout/admin/navigation/nav-content/nav-collapse/nav-collapse.component';
import { NavItemComponent } from './theme/layout/admin/navigation/nav-content/nav-item/nav-item.component';
import { NavBarComponent } from './theme/layout/admin/nav-bar/nav-bar.component';
import { ConfigurationComponent } from './theme/layout/admin/configuration/configuration.component';


/* Menu Items */
import { NavigationItem } from './theme/layout/admin/navigation/navigation';
import { NgbActiveModal, NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { IntlModule, } from '@progress/kendo-angular-intl';
import { LanguageService } from './service/language';
import { MessageService } from '@progress/kendo-angular-l10n';
import LocaleTr from '@angular/common/locales/tr';
import { registerLocaleData } from '@angular/common';
import { NavLeftComponent } from './theme/layout/admin/nav-bar/nav-left/nav-left.component';
import { NavRightComponent } from './theme/layout/admin/nav-bar/nav-right/nav-right.component';
import '@progress/kendo-angular-intl/locales/tr/all';
import '@progress/kendo-angular-intl/locales/tr/calendar';
import { UpdateModalComponent } from './ui/update-modal/update-modal.component';
import { OfflineRequestsComponent } from './ui/offline-requests/offline-requests.component';





registerLocaleData(LocaleTr);

@NgModule({
  declarations: [
    AppComponent,
    AdminComponent,
    AuthComponent,
    NavigationComponent,
    NavLeftComponent,
    NavRightComponent,
    NavContentComponent,
    NavGroupComponent,
    NavCollapseComponent,
    NavItemComponent,
    NavBarComponent,
    ConfigurationComponent,
    UpdateModalComponent,
    OfflineRequestsComponent
    
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    SharedModule,
    NgbDropdownModule,
    NgbTooltipModule,
    IntlModule,
  ],
  providers: [
    NavigationItem,
    NgbActiveModal, ElectronService,
    { provide: LOCALE_ID, useValue: "tr" },
    { provide: MessageService, useClass: LanguageService }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
