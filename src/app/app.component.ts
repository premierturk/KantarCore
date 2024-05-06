

import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectronService } from 'ngx-electron';
import helper from 'src/app/service/helper';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConnectionService } from 'ng-connection-service';
import * as Notiflix from 'notiflix';
import { UpdateModalComponent } from './ui/update-modal/update-modal.component';
import { OfflineRequestsComponent } from './ui/offline-requests/offline-requests.component';
import { DashboardComponent } from './ui/dashboard/dashboard.component';
import { AppNetworkStatus } from './network-status';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss',
  ]
})
export class AppComponent implements OnInit {
  static componentInstance: any;
  static isOffline: boolean = false;
  constructor(private rout: Router, private route: ActivatedRoute,
    private ref: ChangeDetectorRef,
    private _electronService: ElectronService,
    public help: helper,
    public modalService: NgbModal, private connectionService: ConnectionService) {
    AppComponent.componentInstance = this;
    if (this._electronService.ipcRenderer) {
      this._electronService.ipcRenderer.on('update_available', this.update);
      this._electronService.ipcRenderer.on('print', this.printAll);
      this._electronService.ipcRenderer.on('KantarId', (event, data) => window.localStorage.setItem("KantarId", data));
      this._electronService.ipcRenderer.on('KantarAdi', (event, data) => window.localStorage.setItem("KantarAdi", data));
      this._electronService.ipcRenderer.on('DepolamaAlanId', (event, data) => window.localStorage.setItem("DepolamaAlanId", data));
      this._electronService.ipcRenderer.on('basarili', (event, data) => Notiflix.Notify.success(data));
    }
    window.addEventListener("online", () => {
      setTimeout(() => {
        AppNetworkStatus.isOffline = false;
        this.checkOfflineRequests();
      }, 2000);
    });

    window.addEventListener("offline", () => {
      AppNetworkStatus.isOffline = true
    });
    this.checkOfflineRequests();

  }


  checkOfflineRequests() {
    if (!AppNetworkStatus.isOffline) {
      var s = window.localStorage.getItem("offlineRequests");
      if (s == null) return;

      var list = JSON.parse(s);
      if (list.length == 0) return;

      const modalRef = this.help.openModal(this.modalService, OfflineRequestsComponent);
      modalRef.result.then(() => {
        DashboardComponent.componentInstance.ngOnInit();

      });
    }
  }

  ngOnInit() {
    const userStorage = JSON.parse(window.localStorage.getItem('user'));
    if (userStorage == null || userStorage === 'null' || userStorage == undefined) {
      this.rout.navigate(['giris']);
    }
    else {
      if (this.rout.url == undefined || this.rout.url == "/")
        this.rout.config[0].children[0].redirectTo = "/dashboard";
    }
  }
  update(event, data) {
    const modalRef = AppComponent.componentInstance.help.openModal(AppComponent.componentInstance.modalService, UpdateModalComponent);
    setTimeout(() => {
      UpdateModalComponent.componentInstance.ref.detectChanges();
    }, 2000);
  }

  printAll(event, data) {
    console.log(data);
  }
}

