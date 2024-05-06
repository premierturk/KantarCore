import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LabelSettings, ProgressBarAnimation } from '@progress/kendo-angular-progressbar';
import { ElectronService } from 'ngx-electron';
import { ButtonType, DataSource } from 'src/app/service/datasource';

@Component({
  selector: 'app-offline-requests',
  templateUrl: './offline-requests.component.html',
  styleUrls: ['./offline-requests.component.scss']
})
export class OfflineRequestsComponent implements OnInit {
  static componentInstance: any;
  constructor(
    private _electronService: ElectronService,
    public activeModal: NgbActiveModal,
    private ref: ChangeDetectorRef,
    private ds: DataSource,) {
    OfflineRequestsComponent.componentInstance = this;
  }
  @Output() result: EventEmitter<any> = new EventEmitter();
  public list: any[] = [];
  public ButtonType = ButtonType;
  public percent: number = 0.0;
  public speed: string;
  public animation: ProgressBarAnimation = { duration: 2000 }
  public finished: boolean = false;

  public label: LabelSettings = {
    format: (value: number): string => {
      return `%${value.toFixed(2)}`;
    },
    position: "center",
  };

  ngOnInit(): void {
    this.main();
  }

  public async main() {
    this.list = JSON.parse(window.localStorage.getItem("offlineRequests"));
    for (let i = 0; i < this.list.length; i++) {
      const request = this.list[i];
      var res;
      if (request.type == "POST") res = await this.ds.postNoMess(request.url, request.data);
      if (request.type == "PUT") res = await this.ds.putNoMess(request.url, request.data);

      if (res.success) this.list[i] = null;
      this.percent = ((i + 1) / this.list.length) * 100;
    }
    this.list = this.list.filter(a => a != null);
    window.localStorage.setItem("offlineRequests", JSON.stringify(this.list));
    this.finished = true;
  }

  public close() {
    this.result.emit();
    this.activeModal.close();
  }
}
